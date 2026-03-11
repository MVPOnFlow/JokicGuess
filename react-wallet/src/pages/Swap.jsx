import React, { useState, useEffect, useMemo, useCallback } from 'react';
import * as fcl from '@onflow/fcl';
import './Swap.css';

/* ================================================================
   Constants
   ================================================================ */
// Dapper treasury wallet – receives TopShot moments from users
const TREASURY_DAPPER = '0xf853bd09d46e7db6';

const TIERS = [
  { key: 'COMMON',    label: 'Common',    emoji: '🟢', color: '#4ade80', mvpRate: 1.5  },
  { key: 'FANDOM',    label: 'Fandom',    emoji: '🩵', color: '#40e0d0', mvpRate: 1.5  },
  { key: 'RARE',      label: 'Rare',      emoji: '🔵', color: '#60a5fa', mvpRate: 75   },
  { key: 'LEGENDARY', label: 'Legendary', emoji: '🟡', color: '#fbbf24', mvpRate: 1500 },
];

const TIER_MVP = {};
TIERS.forEach(t => { TIER_MVP[t.key] = t.mvpRate; });

/* ================================================================
   Cadence: discover child Dapper account
   ================================================================ */
const CADENCE_GET_CHILD = `
import HybridCustody from 0xd8a7e05a7ac670c0
import TopShot from 0x0b2a3299cc857e29

access(all) fun main(parent: Address): [Address] {
  let acct = getAuthAccount<auth(Storage) &Account>(parent)
  let manager = acct.storage
    .borrow<auth(HybridCustody.Manage) &HybridCustody.Manager>(
      from: HybridCustody.ManagerStoragePath
    )
  if manager == nil { return [] }

  let children = manager!.getChildAddresses()
  for child in children {
    let account = getAccount(child)
    let ref = account.capabilities
      .borrow<&TopShot.Collection>(/public/MomentCollection)
    if ref != nil { return [child] }
  }
  return []
}
`;

/* ================================================================
   Cadence: list TopShot moments with on-chain metadata
   Returns [[id, playID, setName, serialNumber, isLocked]] as strings.
   Only Cadence calls — no TopShot API needed.
   ================================================================ */
const CADENCE_LIST_MOMENTS = `
import TopShot from 0x0b2a3299cc857e29
import TopShotLocking from 0x0b2a3299cc857e29

access(all) fun main(account: Address): [[String]] {
  let acct = getAccount(account)
  let ref = acct.capabilities
    .borrow<&TopShot.Collection>(/public/MomentCollection)!
  let ids = ref.getIDs()
  var setNames: {UInt32: String} = {}
  var result: [[String]] = []
  for id in ids {
    let nft = ref.borrowMoment(id: id)!
    let sid = nft.data.setID
    if setNames[sid] == nil {
      setNames[sid] = TopShot.getSetName(setID: sid) ?? ""
    }
    let locked = TopShotLocking.isLocked(nftRef: nft)
    result.append([
      id.toString(),
      nft.data.playID.toString(),
      setNames[sid]!,
      nft.data.serialNumber.toString(),
      locked ? "1" : "0"
    ])
  }
  return result
}
`;

/* ================================================================
   Cadence: transfer TopShot moments from child (Dapper) → recipient
   The signer is the Flow parent wallet; it accesses the child via
   HybridCustody's borrowable capability.
   ================================================================ */
function buildTransferMomentsCadence(childAddr) {
  return `
import HybridCustody from 0xd8a7e05a7ac670c0
import NonFungibleToken from 0x1d7e57aa55817448
import TopShot from 0x0b2a3299cc857e29

transaction(momentIds: [UInt64], recipient: Address) {

  let provider: auth(NonFungibleToken.Withdraw)
               &{NonFungibleToken.Provider, NonFungibleToken.CollectionPublic}

  prepare(signer: auth(Storage, Capabilities) &Account) {
    // 1. Borrow HybridCustody manager
    let mgr = signer.storage.borrow<auth(HybridCustody.Manage) &HybridCustody.Manager>(
      from: HybridCustody.ManagerStoragePath
    ) ?? panic("No HybridCustody manager")

    // 2. Borrow the child account
    let childAcct = mgr.borrowAccount(addr: ${childAddr})
      ?? panic("Child account not found")

    // 3. Get provider capability from child (interface-based type)
    let capType = Type<
      auth(NonFungibleToken.Withdraw)
      &{NonFungibleToken.Provider, NonFungibleToken.CollectionPublic}>()

    let controllerID = childAcct.getControllerIDForType(
      type: capType,
      forPath: /storage/MomentCollection
    ) ?? panic("Controller ID not found for TopShot collection on child")

    let cap = childAcct.getCapability(
      controllerID: controllerID,
      type: capType
    ) as! Capability<
      auth(NonFungibleToken.Withdraw)
      &{NonFungibleToken.Provider, NonFungibleToken.CollectionPublic}>

    assert(cap.check(), message: "Invalid provider capability")
    self.provider = cap.borrow()!
  }

  execute {
    // 4. Get the recipient's TopShot collection
    let recipientAcct = getAccount(recipient)
    let receiver = recipientAcct.capabilities
      .borrow<&{NonFungibleToken.Receiver}>(/public/MomentCollection)
      ?? panic("Recipient has no TopShot collection")

    // 5. Transfer each moment
    for id in momentIds {
      let nft <- self.provider.withdraw(withdrawID: id)
      receiver.deposit(token: <-nft)
    }
  }
}
`;
}

/* ================================================================
   Enrich moments via our backend (DB lookup, no TopShot API calls)
   ================================================================ */
async function enrichMoments(rawMoments) {
  // rawMoments = [{id, playID, setID, serial}, ...] from Cadence
  try {
    const resp = await fetch('/api/moment-lookup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ moments: rawMoments }),
    });
    if (!resp.ok) return [];
    const data = await resp.json();
    return (data.moments || []).map(m => ({
      id: m.id,
      serial: m.serial,
      player: m.player || 'Nikola Jokić',
      headline: m.headline || '',
      team: m.team || '',
      set: m.setName || '',
      seriesNumber: m.seriesNumber || null,
      tier: m.tier,
      imageUrl: m.imageUrl || null,
    }));
  } catch {
    return [];
  }
}

/* ================================================================
   SwapProgressStep – single step row in the progress modal
   ================================================================ */
function SwapProgressStep({ num, label, status, extra }) {
  const icons = {
    pending: <span className="sps-icon pending">{num}</span>,
    active:  <span className="sps-icon active"><span className="sps-spinner" /></span>,
    done:    <span className="sps-icon done">✓</span>,
    error:   <span className="sps-icon error">✗</span>,
  };
  return (
    <div className={`swap-progress-step ${status}`}>
      {icons[status] || icons.pending}
      <div className="sps-content">
        <div className="sps-label">{label}</div>
        {extra && <div className="sps-extra">{extra}</div>}
      </div>
    </div>
  );
}

/* ================================================================
   Component
   ================================================================ */
export default function Swap() {
  /* ── Auth ── */
  const [user, setUser] = useState({ loggedIn: null });
  useEffect(() => { fcl.currentUser().subscribe(setUser); }, []);

  /* ── Child (Dapper) account ── */
  const [childAddr, setChildAddr] = useState(null);
  const [childLoading, setChildLoading] = useState(false);
  const [childError, setChildError] = useState(null);

  /* ── Moments ── */
  const [moments, setMoments] = useState([]);
  const [momentsLoading, setMomentsLoading] = useState(false);
  const [selected, setSelected] = useState(new Set());

  /* ── Transaction ── */
  // (modal-based progress – see swapModal state below)

  /* ── Filter / sort ── */
  const [tierFilter, setTierFilter] = useState('ALL');
  const [searchText, setSearchText] = useState('');

  /* ── Discover child account when wallet connects ── */
  useEffect(() => {
    if (!user?.addr) {
      setChildAddr(null);
      setMoments([]);
      setSelected(new Set());
      return;
    }
    let cancelled = false;
    (async () => {
      setChildLoading(true);
      setChildError(null);
      try {
        const result = await fcl.query({
          cadence: CADENCE_GET_CHILD,
          args: (arg, t) => [arg(user.addr, t.Address)],
        });
        if (!cancelled) {
          if (result && result.length > 0) {
            setChildAddr(result[0]);
          } else {
            setChildError('No linked Dapper account found. Make sure your Dapper wallet is linked to this Flow wallet.');
          }
        }
      } catch (e) {
        if (!cancelled) setChildError('Could not discover Dapper child account.');
      } finally {
        if (!cancelled) setChildLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [user?.addr]);

  /* ── Load moments from child account ── */
  useEffect(() => {
    if (!childAddr) { setMoments([]); return; }
    let cancelled = false;
    (async () => {
      setMomentsLoading(true);
      try {
        const raw = await fcl.query({
          cadence: CADENCE_LIST_MOMENTS,
          args: (arg, t) => [arg(childAddr, t.Address)],
        });
        if (cancelled) return;
        // raw = [[id, playID, setName, serial, isLocked], ...] (all strings from Cadence)
        const parsed = (raw || []).map(r => ({
          id: parseInt(r[0], 10),
          playID: parseInt(r[1], 10),
          setName: r[2],
          serial: parseInt(r[3], 10),
          isLocked: r[4] === '1',
        }));
        // Filter out locked moments before enriching
        const unlocked = parsed.filter(m => !m.isLocked);
        const enriched = await enrichMoments(unlocked);
        if (!cancelled) {
          // Sort by serial number descending (highest first)
          enriched.sort((a, b) => b.serial - a.serial);
          setMoments(enriched);
        }
      } catch {
        if (!cancelled) setMoments([]);
      } finally {
        if (!cancelled) setMomentsLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [childAddr]);

  /* ── Filtered moments ── */
  const filtered = useMemo(() => {
    let list = moments;
    if (tierFilter !== 'ALL') list = list.filter(m => m.tier === tierFilter);
    if (searchText.trim()) {
      const q = searchText.toLowerCase();
      list = list.filter(m =>
        m.player.toLowerCase().includes(q) ||
        m.headline.toLowerCase().includes(q) ||
        m.set.toLowerCase().includes(q)
      );
    }
    return list;
  }, [moments, tierFilter, searchText]);

  /* ── Calculate $MVP total for selected moments ── */
  const selectedMvp = useMemo(() => {
    let total = 0;
    for (const id of selected) {
      const m = moments.find(x => x.id === id);
      if (m) total += TIER_MVP[m.tier] || 0;
    }
    return total;
  }, [selected, moments]);

  /* ── Toggle selection ── */
  const toggleSelect = useCallback((id) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const selectAll = useCallback(() => {
    setSelected(new Set(filtered.map(m => m.id)));
  }, [filtered]);

  const selectNone = useCallback(() => {
    setSelected(new Set());
  }, []);

  /* ── Swap progress modal state ── */
  const [swapModal, setSwapModal] = useState(null); // null = hidden
  // swapModal shape: { step, momentCount, mvpExpected, txId, mvpTxId, mvpAmount, error }
  // step: 'signing' | 'submitted' | 'sealing' | 'sending-mvp' | 'done' | 'error'

  const closeSwapModal = useCallback(() => setSwapModal(null), []);

  /* ── Execute swap: transfer moments → treasury, then claim $MVP ── */
  const handleSwap = useCallback(async () => {
    if (!user?.addr || !childAddr || selected.size === 0) return;

    const momentIds = [...selected];
    const mvpExpected = selectedMvp;

    // Open modal at step 1
    setSwapModal({ step: 'signing', momentCount: momentIds.length, mvpExpected, txId: null, mvpTxId: null, mvpAmount: null, error: null });

    try {
      /* Step 1: Sign & send moment transfer */
      const cadence = buildTransferMomentsCadence(childAddr);
      const authz = fcl.currentUser().authorization;

      const transactionId = await fcl.mutate({
        cadence,
        args: (arg, t) => [
          arg(momentIds.map(id => String(id)), t.Array(t.UInt64)),
          arg(TREASURY_DAPPER, t.Address),
        ],
        proposer: authz,
        payer: authz,
        authorizations: [authz],
        limit: 9999,
      });

      setSwapModal(prev => ({ ...prev, step: 'submitted', txId: transactionId }));

      /* Step 2: Wait for seal */
      setSwapModal(prev => ({ ...prev, step: 'sealing' }));
      await fcl.tx(transactionId).onceSealed();

      /* Step 3: Send $MVP */
      setSwapModal(prev => ({ ...prev, step: 'sending-mvp' }));

      const resp = await fetch('/api/swap/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          txId: transactionId,
          userAddr: user.addr,
          momentIds,
        }),
      });
      const data = await resp.json();

      if (!resp.ok) {
        throw new Error(data.error || 'Swap completion failed');
      }

      /* Step 4: Done */
      setSwapModal(prev => ({
        ...prev,
        step: 'done',
        mvpTxId: data.mvpTxId || null,
        mvpAmount: data.mvpAmount || mvpExpected,
      }));

      /* Remove swapped moments from the list */
      setMoments(prev => prev.filter(m => !selected.has(m.id)));
      setSelected(new Set());

    } catch (e) {
      const msg = String(e?.message || e);
      let errorMsg;
      if (msg.toLowerCase().includes('declined') || msg.toLowerCase().includes('rejected') || msg.toLowerCase().includes('user rejected')) {
        errorMsg = 'Transaction was declined.';
      } else {
        errorMsg = msg.length > 150 ? msg.slice(0, 150) + '…' : msg;
      }
      setSwapModal(prev => ({ ...(prev || {}), step: 'error', error: errorMsg }));
    }
  }, [user, childAddr, selected, selectedMvp]);

  /* ── Render ── */
  const walletConnected = !!user?.addr;

  return (
    <div className="swap-container" style={{ maxWidth: 720 }}>
      {/* Hero */}
      <div className="swap-hero">
        <h1>⇅ Swap Jokic Moments for $MVP</h1>
        <p>Send TopShot Jokic moments from your Dapper wallet to the treasury and receive $MVP instantly</p>
      </div>

      {/* ── Status / connect ── */}
      {!walletConnected && (
        <div className="swap-card" style={{ textAlign: 'center', padding: '2rem' }}>
          <p style={{ color: '#9CA3AF', marginBottom: '1rem' }}>Connect your Flow wallet to get started</p>
          <button className="swap-action-btn" style={{ maxWidth: 280 }} onClick={() => fcl.authenticate()}>
            Connect Wallet
          </button>
        </div>
      )}

      {walletConnected && childLoading && (
        <div className="swap-card" style={{ textAlign: 'center', padding: '2rem' }}>
          <p style={{ color: '#9CA3AF' }}>Discovering your Dapper account…</p>
        </div>
      )}

      {walletConnected && childError && (
        <div className="swap-card" style={{ textAlign: 'center', padding: '2rem' }}>
          <p style={{ color: '#ef4444' }}>{childError}</p>
        </div>
      )}

      {/* ── Moment picker ── */}
      {walletConnected && childAddr && (
        <>
          <div className="swap-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
              <div className="swap-panel-label" style={{ margin: 0 }}>
                Your TopShot Jokic Moments
                <span style={{ color: '#6B7280', fontWeight: 400, marginLeft: 6 }}>
                  ({moments.length} total)
                </span>
              </div>
              <div style={{ fontSize: '0.75rem', color: '#6B7280' }}>
                Dapper: {childAddr.slice(0, 6)}…{childAddr.slice(-4)}
              </div>
            </div>

            {/* Filters */}
            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.75rem', flexWrap: 'wrap' }}>
              <button
                className={`swap-tier-btn ${tierFilter === 'ALL' ? 'active' : ''}`}
                onClick={() => setTierFilter('ALL')}
              >
                All
              </button>
              {TIERS.map(t => (
                <button
                  key={t.key}
                  className={`swap-tier-btn ${tierFilter === t.key ? 'active' : ''}`}
                  onClick={() => setTierFilter(t.key)}
                >
                  <span className="tier-dot" style={{ background: t.color }} />
                  {t.label}
                </button>
              ))}
            </div>

            {/* Search */}
            <input
              type="text"
              placeholder="Search by player, play, or set…"
              value={searchText}
              onChange={e => setSearchText(e.target.value)}
              style={{
                width: '100%',
                padding: '0.5rem 0.75rem',
                borderRadius: 8,
                border: '1px solid #273549',
                background: '#141e2e',
                color: '#E5E7EB',
                fontSize: '0.85rem',
                marginBottom: '0.75rem',
                outline: 'none',
              }}
            />

            {/* Select all / none */}
            <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '0.75rem', fontSize: '0.8rem' }}>
              <button className="max-btn" onClick={selectAll} style={{ color: '#FDB927' }}>Select All ({filtered.length})</button>
              <button className="max-btn" onClick={selectNone} style={{ color: '#9CA3AF' }}>Clear</button>
            </div>

            {/* Moment grid */}
            {momentsLoading ? (
              <div style={{ textAlign: 'center', padding: '2rem', color: '#9CA3AF' }}>
                Loading your moments…
              </div>
            ) : filtered.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '2rem', color: '#6B7280' }}>
                {moments.length === 0 ? 'No TopShot moments found in your Dapper account.' : 'No moments match your filter.'}
              </div>
            ) : (
              <div className="swap-moment-grid">
                {filtered.map(m => {
                  const isSelected = selected.has(m.id);
                  const tierInfo = TIERS.find(t => t.key === m.tier);
                  return (
                    <div
                      key={m.id}
                      className={`swap-moment-card ${isSelected ? 'selected' : ''}`}
                      onClick={() => toggleSelect(m.id)}
                      style={{ borderColor: isSelected ? (tierInfo?.color || '#FDB927') : undefined }}
                    >
                      {m.imageUrl && (
                        <img
                          src={m.imageUrl}
                          alt={m.headline}
                          className="swap-moment-img"
                          loading="lazy"
                        />
                      )}
                      <div className="swap-moment-info">
                        <div className="swap-moment-player">{m.set}</div>
                        <div className="swap-moment-headline">
                          {m.seriesNumber ? `Series ${m.seriesNumber}` : ''}
                        </div>
                        <div className="swap-moment-meta">
                          <span style={{ color: tierInfo?.color || '#adb5bd' }}>
                            {tierInfo?.emoji} {tierInfo?.label || m.tier}
                          </span>
                          <span style={{ color: '#9CA3AF', fontSize: '0.75rem' }}>
                            #{m.serial}
                          </span>
                          <span style={{ color: '#FDB927', fontWeight: 600 }}>
                            {TIER_MVP[m.tier] || 0} $MVP
                          </span>
                        </div>
                      </div>
                      {isSelected && <div className="swap-moment-check">✓</div>}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* ── Swap summary & action ── */}
          {selected.size > 0 && (
            <div className="swap-card" style={{ marginTop: '1rem' }}>
              <div className="swap-panel">
                <div className="swap-panel-label">Swap Summary</div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <span style={{ fontSize: '1.2rem', fontWeight: 700, color: '#E5E7EB' }}>
                      {selected.size} moment{selected.size !== 1 ? 's' : ''}
                    </span>
                    <span style={{ color: '#6B7280', marginLeft: 8, fontSize: '0.85rem' }}>→ treasury</span>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <span style={{ fontSize: '1.4rem', fontWeight: 700, color: '#FDB927' }}>
                      {selectedMvp.toLocaleString()} $MVP
                    </span>
                  </div>
                </div>
              </div>

              <div className="swap-rate-info">
                Common/Fandom = <strong>1.5 $MVP</strong> · Rare = <strong>75 $MVP</strong> · Legendary = <strong>1,500 $MVP</strong>
              </div>

              <button
                className="swap-action-btn"
                disabled={!!swapModal}
                onClick={handleSwap}
              >
                {`Swap ${selected.size} moment${selected.size > 1 ? 's' : ''} → ${selectedMvp.toLocaleString()} $MVP`}
              </button>
            </div>
          )}
        </>
      )}

      {/* ── Swap progress modal ── */}
      {swapModal && (
        <div className="swap-modal-overlay">
          <div className="swap-modal">
            <h2 className="swap-modal-title">⇅ Swap in Progress</h2>
            <div className="swap-modal-summary">
              {swapModal.momentCount} moment{swapModal.momentCount !== 1 ? 's' : ''} → <span style={{ color: '#FDB927', fontWeight: 700 }}>{swapModal.mvpExpected?.toLocaleString()} $MVP</span>
            </div>

            <div className="swap-modal-steps">
              {/* Step 1: Transaction submitted */}
              <SwapProgressStep
                num={1}
                label="Transaction submitted"
                status={
                  swapModal.step === 'signing' ? 'active'
                    : ['submitted','sealing','sending-mvp','done'].includes(swapModal.step) ? 'done'
                    : swapModal.step === 'error' && !swapModal.txId ? 'error' : 'done'
                }
              />

              {/* Step 2: Moments sealed on-chain */}
              <SwapProgressStep
                num={2}
                label="Moments sealed on-chain"
                status={
                  ['signing'].includes(swapModal.step) ? 'pending'
                    : ['submitted','sealing'].includes(swapModal.step) ? 'active'
                    : ['sending-mvp','done'].includes(swapModal.step) ? 'done'
                    : swapModal.step === 'error' && swapModal.txId ? 'error' : 'pending'
                }
                extra={swapModal.txId && (
                  <a href={`https://www.flowdiver.io/tx/${swapModal.txId}`} target="_blank" rel="noopener noreferrer" className="swap-tx-link">
                    {swapModal.txId.slice(0, 12)}… ↗
                  </a>
                )}
              />

              {/* Step 3: Sending $MVP */}
              <SwapProgressStep
                num={3}
                label="Sending $MVP"
                status={
                  ['signing','submitted','sealing'].includes(swapModal.step) ? 'pending'
                    : swapModal.step === 'sending-mvp' ? 'active'
                    : swapModal.step === 'done' ? 'done'
                    : 'pending'
                }
              />

              {/* Step 4: Complete */}
              <SwapProgressStep
                num={4}
                label={swapModal.step === 'done'
                  ? `${swapModal.mvpAmount?.toLocaleString()} $MVP sent!`
                  : '$MVP received'}
                status={swapModal.step === 'done' ? 'done' : 'pending'}
                extra={swapModal.mvpTxId && (
                  <a href={`https://www.flowdiver.io/tx/${swapModal.mvpTxId}`} target="_blank" rel="noopener noreferrer" className="swap-tx-link">
                    {swapModal.mvpTxId.slice(0, 12)}… ↗
                  </a>
                )}
              />
            </div>

            {/* Error message */}
            {swapModal.step === 'error' && (
              <div className="swap-modal-error">
                {swapModal.error}
              </div>
            )}

            {/* Button */}
            {swapModal.step === 'done' || swapModal.step === 'error' ? (
              <button className="swap-action-btn" style={{ marginTop: '1.25rem' }} onClick={closeSwapModal}>
                {swapModal.step === 'done' ? '✓ Close' : 'Close'}
              </button>
            ) : (
              <div className="swap-modal-wait-btn">
                ⚠ Do not leave this page
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── How it works ── */}
      <div className="swap-how-card">
        <h3>How It Works</h3>
        <div className="swap-step">
          <div className="swap-step-num">1</div>
          <div className="swap-step-text">
            <h4>Connect &amp; pick moments</h4>
            <p>Connect your Flow wallet. We'll find your linked Dapper account and list your TopShot moments.</p>
          </div>
        </div>
        <div className="swap-step">
          <div className="swap-step-num">2</div>
          <div className="swap-step-text">
            <h4>Sign one transaction</h4>
            <p>Select moments to swap and click Swap. You sign a single Flow transaction that sends the moments to the treasury.</p>
          </div>
        </div>
        <div className="swap-step">
          <div className="swap-step-num">3</div>
          <div className="swap-step-text">
            <h4>Receive $MVP instantly</h4>
            <p>Once the transaction seals, the treasury wallet automatically sends $MVP to your Flow wallet.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
