import React, { useState, useEffect, useCallback } from 'react';
import * as fcl from '@onflow/fcl';

/* ── helpers ─────────────────────────────────────────── */

function formatUFix64(n) {
  const s = typeof n === 'number' ? n.toFixed(8) : String(n);
  const [i, d = '0'] = s.split('.');
  return `${i}.${(d + '00000000').slice(0, 8)}`.replace(/(\.\d*?[1-9])0+$/g, '$1');
}

const TREASURY = '0xcc4b6fa5550a4610';

const TRANSFER_CADENCE = `
import FungibleToken from 0xf233dcee88fe0abe
import StorageRent from 0x707adbad1428c624
import PetJokicsHorses from 0x6fd2465f3a22e34c

transaction(amount: UFix64, recipient: Address) {
  let sentVault: @{FungibleToken.Vault}
  prepare(signer: auth(Storage, BorrowValue) &Account) {
    let vaultRef = signer.storage.borrow<auth(FungibleToken.Withdraw) &PetJokicsHorses.Vault>(
      from: /storage/PetJokicsHorsesVault
    ) ?? panic("Could not borrow Vault!")
    self.sentVault <- vaultRef.withdraw(amount: amount)
  }
  execute {
    let r = getAccount(recipient).capabilities.borrow<&{FungibleToken.Vault}>(
      /public/PetJokicsHorsesReceiver
    ) ?? panic("Recipient missing receiver")
    r.deposit(from: <-self.sentVault)
    StorageRent.tryRefill(recipient)
  }
}
`;

async function sendMVP(amount) {
  const authz = fcl.currentUser().authorization;
  return fcl.mutate({
    cadence: TRANSFER_CADENCE,
    args: (arg, t) => [arg(formatUFix64(amount), t.UFix64), arg(TREASURY, t.Address)],
    proposer: authz, payer: authz, authorizations: [authz], limit: 9999,
  });
}

function timeLeft(endTime) {
  const diff = endTime - Math.floor(Date.now() / 1000);
  if (diff <= 0) return 'Ended';
  const d = Math.floor(diff / 86400);
  const h = Math.floor((diff % 86400) / 3600);
  const m = Math.floor((diff % 3600) / 60);
  const s = diff % 60;
  if (d > 0) return `${d}d ${h}h ${m}m`;
  if (h > 0) return `${h}h ${m}m ${s}s`;
  return `${m}m ${s}s`;
}

function shortAddr(addr) {
  if (!addr) return '';
  return addr.length > 12 ? `${addr.slice(0, 6)}…${addr.slice(-4)}` : addr;
}

/* ── styles ──────────────────────────────────────────── */

const S = {
  wrapper: { maxWidth: 720, margin: '0 auto', padding: '0 1rem 3rem' },
  hero: { textAlign: 'center', marginBottom: '2rem' },
  heroIcon: { fontSize: '3.5rem', lineHeight: 1, marginBottom: '0.5rem' },
  title: { color: '#FDB927', fontSize: '1.75rem', fontWeight: 700, marginBottom: '0.35rem' },
  subtitle: { color: '#9CA3AF', fontSize: '0.92rem', lineHeight: 1.5 },
  card: {
    background: '#1C2A3A', border: '1px solid #273549', borderRadius: 16,
    overflow: 'hidden', boxShadow: '0 8px 24px rgba(0,0,0,0.4)', marginBottom: '1.25rem',
  },
  cardHeader: (live) => ({
    background: live ? '#0E2240' : '#161F2C',
    padding: '0.85rem 1.25rem', borderBottom: '1px solid #273549',
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
  }),
  cardTitle: { color: '#fff', fontWeight: 700, fontSize: '1rem', margin: 0 },
  badge: (live) => ({
    padding: '0.2rem 0.6rem', borderRadius: 12, fontSize: '0.72rem', fontWeight: 700,
    background: live ? 'rgba(253,185,39,0.15)' : 'rgba(255,255,255,0.06)',
    color: live ? '#FDB927' : '#6B7280',
  }),
  body: { padding: '1.25rem' },
  desc: { color: '#9CA3AF', fontSize: '0.9rem', marginBottom: '1rem' },
  meta: { display: 'flex', flexWrap: 'wrap', gap: '1rem', marginBottom: '1rem' },
  metaItem: { display: 'flex', flexDirection: 'column' },
  metaLabel: { fontSize: '0.7rem', color: '#6B7280', textTransform: 'uppercase', fontWeight: 600 },
  metaValue: { fontSize: '1rem', color: '#E5E7EB', fontWeight: 600 },
  entryArea: {
    background: 'rgba(253,185,39,0.06)', border: '1px solid rgba(253,185,39,0.2)',
    borderRadius: 12, padding: '1rem', marginTop: '1rem',
  },
  row: { display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' },
  input: {
    width: 80, padding: '0.5rem 0.7rem', borderRadius: 8,
    border: '1px solid #273549', background: '#121826', color: '#E5E7EB',
    fontSize: '1rem', textAlign: 'center',
  },
  btnGold: {
    padding: '0.55rem 1.25rem', border: 'none', borderRadius: 10, cursor: 'pointer',
    fontWeight: 700, fontSize: '0.92rem',
    background: 'linear-gradient(135deg, #FDB927, #e5a520)', color: '#0E2240',
    boxShadow: '0 4px 12px rgba(253,185,39,0.25)',
  },
  btnGoldDisabled: {
    padding: '0.55rem 1.25rem', border: 'none', borderRadius: 10,
    fontWeight: 700, fontSize: '0.92rem',
    background: '#3B3B3B', color: '#6B7280', cursor: 'not-allowed',
  },
  myEntries: { color: '#FDB927', fontWeight: 600, fontSize: '0.88rem' },
  cost: { color: '#9CA3AF', fontSize: '0.82rem' },
  spinner: {
    display: 'inline-block', width: 16, height: 16,
    border: '2px solid #FDB927', borderTop: '2px solid transparent',
    borderRadius: '50%', animation: 'spin 0.6s linear infinite',
  },
  winnersHeading: { color: '#FDB927', fontWeight: 700, fontSize: '0.92rem', marginTop: '1rem', marginBottom: '0.5rem' },
  winnerRow: {
    display: 'flex', alignItems: 'center', gap: '0.6rem',
    padding: '0.45rem 0.75rem', borderRadius: 8,
    background: 'rgba(253,185,39,0.08)', border: '1px solid rgba(253,185,39,0.15)',
    marginBottom: '0.4rem', color: '#E5E7EB', fontSize: '0.88rem',
  },
  toggle: {
    background: 'none', border: 'none', color: '#9CA3AF',
    cursor: 'pointer', fontSize: '0.9rem', padding: '0.5rem 0', fontWeight: 600,
    display: 'flex', alignItems: 'center', gap: '0.4rem',
  },
  error: { color: '#EF4444', fontSize: '0.85rem', marginTop: '0.5rem' },
  success: { color: '#22C55E', fontSize: '0.85rem', marginTop: '0.5rem' },
  empty: { color: '#6B7280', textAlign: 'center', padding: '2rem', fontSize: '0.92rem' },
};

/* ── component ───────────────────────────────────────── */

export default function Raffles() {
  const [user, setUser] = useState({ loggedIn: null });
  const [raffles, setRaffles] = useState([]);
  const [myEntries, setMyEntries] = useState({});      // raffle_id → count
  const [quantities, setQuantities] = useState({});     // raffle_id → input value
  const [sending, setSending] = useState({});           // raffle_id → bool
  const [errors, setErrors] = useState({});
  const [successes, setSuccesses] = useState({});
  const [showHistory, setShowHistory] = useState(false);
  const [tick, setTick] = useState(0);

  useEffect(() => { fcl.currentUser().subscribe(setUser); }, []);

  // Countdown ticker
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, []);

  const fetchRaffles = useCallback(async () => {
    try {
      const res = await fetch('/api/raffles');
      const data = await res.json();
      setRaffles(data);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => { fetchRaffles(); }, []);
  // Poll every 15s
  useEffect(() => {
    const id = setInterval(fetchRaffles, 15000);
    return () => clearInterval(id);
  }, [fetchRaffles]);

  // Fetch my entries when wallet changes
  useEffect(() => {
    if (!user.addr) { setMyEntries({}); return; }
    (async () => {
      const entries = {};
      for (const r of raffles) {
        try {
          const res = await fetch(`/api/raffles/${r.id}/my-entries?wallet=${user.addr.toLowerCase()}`);
          const d = await res.json();
          entries[r.id] = d.entries || 0;
        } catch { entries[r.id] = 0; }
      }
      setMyEntries(entries);
    })();
  }, [user.addr, raffles]);

  const handleEnter = async (raffle) => {
    const qty = parseInt(quantities[raffle.id]) || 0;
    if (qty < 1) {
      setErrors((p) => ({ ...p, [raffle.id]: 'Enter at least 1 ticket' }));
      return;
    }
    setErrors((p) => ({ ...p, [raffle.id]: null }));
    setSuccesses((p) => ({ ...p, [raffle.id]: null }));
    setSending((p) => ({ ...p, [raffle.id]: true }));

    try {
      // Send $MVP on-chain
      const txId = await sendMVP(qty);
      await fcl.tx(txId).onceSealed();

      // Register entries
      const res = await fetch(`/api/raffles/${raffle.id}/enter`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ wallet: user.addr, num_entries: qty, tx_id: txId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to register entries');

      setSuccesses((p) => ({ ...p, [raffle.id]: `${qty} ticket${qty > 1 ? 's' : ''} purchased!` }));
      setQuantities((p) => ({ ...p, [raffle.id]: '' }));
      fetchRaffles();
    } catch (e) {
      const msg = String(e?.message || e);
      if (msg.includes('Cannot withdraw tokens')) {
        setErrors((p) => ({ ...p, [raffle.id]: 'Insufficient $MVP balance' }));
      } else {
        setErrors((p) => ({ ...p, [raffle.id]: msg }));
      }
    } finally {
      setSending((p) => ({ ...p, [raffle.id]: false }));
    }
  };

  const now = Math.floor(Date.now() / 1000);
  const live = raffles.filter((r) => r.status === 'OPEN' && r.end_time > now);
  const history = raffles.filter((r) => r.status === 'DRAWN' || r.end_time <= now);

  const renderRaffle = (r, isLive) => {
    const qty = parseInt(quantities[r.id]) || 0;
    const cost = qty;
    const isSending = sending[r.id];

    return (
      <div key={r.id} style={S.card}>
        <div style={S.cardHeader(isLive)}>
          <h5 style={S.cardTitle}>{r.name}</h5>
          <span style={S.badge(isLive)}>
            {isLive ? `⏱ ${timeLeft(r.end_time)}` : '✅ Ended'}
          </span>
        </div>
        <div style={S.body}>
          {r.description && <p style={S.desc}>{r.description}</p>}

          <div style={S.meta}>
            <div style={S.metaItem}>
              <span style={S.metaLabel}>Total entries</span>
              <span style={S.metaValue}>{r.total_entries}</span>
            </div>
            <div style={S.metaItem}>
              <span style={S.metaLabel}>Winners</span>
              <span style={S.metaValue}>{r.num_winners}</span>
            </div>
            <div style={S.metaItem}>
              <span style={S.metaLabel}>Cost</span>
              <span style={S.metaValue}>1 $MVP / ticket</span>
            </div>
            {r.raffle_type === 'DEFAULT' && (
              <div style={S.metaItem}>
                <span style={S.metaLabel}>Prize pool</span>
                <span style={{ ...S.metaValue, color: '#22C55E' }}>
                  {r.pool ?? r.total_entries} $MVP
                </span>
              </div>
            )}
            {user.addr && (
              <div style={S.metaItem}>
                <span style={S.metaLabel}>Your entries</span>
                <span style={{ ...S.metaValue, color: '#FDB927' }}>
                  {myEntries[r.id] || 0}
                </span>
              </div>
            )}
          </div>

          {/* Payout breakdown for DEFAULT raffles */}
          {r.raffle_type === 'DEFAULT' && r.payouts && r.payouts.length > 0 && (
            <div style={{
              display: 'flex', gap: '0.6rem', flexWrap: 'wrap', marginBottom: '1rem',
            }}>
              {r.payouts.map((p, i) => (
                <div key={i} style={{
                  flex: 1, minWidth: 100,
                  background: 'rgba(253,185,39,0.06)', border: '1px solid rgba(253,185,39,0.15)',
                  borderRadius: 10, padding: '0.6rem 0.8rem', textAlign: 'center',
                }}>
                  <div style={{ color: '#FDB927', fontWeight: 700, fontSize: '0.78rem', marginBottom: 2 }}>
                    {['🥇 1st', '🥈 2nd', '🥉 3rd'][i] || `#${i + 1}`}
                  </div>
                  <div style={{ color: '#E5E7EB', fontWeight: 700, fontSize: '1.05rem' }}>
                    {p.pct}%
                  </div>
                  <div style={{ color: '#9CA3AF', fontSize: '0.78rem' }}>
                    {p.amount} $MVP
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Entry UI — only for live raffles + logged in users */}
          {isLive && user.loggedIn && (
            <div style={S.entryArea}>
              <div style={S.row}>
                <input
                  type="number"
                  min="1"
                  placeholder="Qty"
                  style={S.input}
                  value={quantities[r.id] || ''}
                  onChange={(e) =>
                    setQuantities((p) => ({ ...p, [r.id]: e.target.value }))
                  }
                  disabled={isSending}
                />
                <button
                  style={qty >= 1 && !isSending ? S.btnGold : S.btnGoldDisabled}
                  disabled={qty < 1 || isSending}
                  onClick={() => handleEnter(r)}
                >
                  {isSending ? (
                    <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={S.spinner} /> Sending…
                    </span>
                  ) : (
                    '🎟️ Enter Raffle'
                  )}
                </button>
                {qty >= 1 && <span style={S.cost}>{cost} $MVP</span>}
              </div>
              {errors[r.id] && <div style={S.error}>{errors[r.id]}</div>}
              {successes[r.id] && <div style={S.success}>{successes[r.id]}</div>}
            </div>
          )}

          {isLive && !user.loggedIn && (
            <div style={{ ...S.entryArea, textAlign: 'center', color: '#9CA3AF' }}>
              Connect your wallet to enter this raffle
            </div>
          )}

          {/* Winners */}
          {!isLive && r.winners && r.winners.length > 0 && (() => {
            const payoutTx = r.winners.find(w => w.payout_tx_id)?.payout_tx_id;
            const anyPending = r.raffle_type === 'DEFAULT' && r.winners.some(w => w.payout_amount > 0 && !w.payout_tx_id);
            return (
            <>
              <div style={S.winnersHeading}>🏆 Winners</div>
              {r.winners.map((w, i) => (
                <div key={i} style={S.winnerRow}>
                  <span style={{ color: '#FDB927' }}>#{i + 1}</span>
                  <span>
                    {w.username && w.username !== w.wallet
                      ? <><strong style={{ color: '#E5E7EB' }}>{w.username}</strong>{' '}<span style={{ color: '#6B7280', fontSize: '0.78rem' }}>({shortAddr(w.wallet)})</span></>
                      : shortAddr(w.wallet)}
                  </span>
                  {r.raffle_type === 'DEFAULT' && w.payout_amount > 0 && (
                    <span style={{ marginLeft: 'auto', color: '#22C55E', fontWeight: 700 }}>
                      +{w.payout_amount} $MVP
                    </span>
                  )}
                </div>
              ))}
              {r.raffle_type === 'DEFAULT' && (
                <div style={{ textAlign: 'center', marginTop: '0.5rem' }}>
                  {payoutTx ? (
                    <a
                      href={`https://www.flowdiver.io/tx/${payoutTx}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      title={payoutTx}
                      style={{ color: '#22C55E', fontSize: '0.8rem', textDecoration: 'none' }}
                    >✅ Payouts sent — view transaction</a>
                  ) : anyPending ? (
                    <span style={{ color: '#FDB927', fontSize: '0.8rem' }}>⏳ Payouts pending…</span>
                  ) : null}
                </div>
              )}
            </>
            );
          })()}
          {!isLive && (!r.winners || r.winners.length === 0) && (
            <div style={{ color: '#6B7280', fontSize: '0.85rem', marginTop: '0.5rem' }}>
              No entries — no winners drawn.
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div style={S.wrapper}>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

      <div style={S.hero}>
        <div style={S.heroIcon}>🎟️</div>
        <h1 style={S.title}>Raffles</h1>
        <p style={S.subtitle}>
          Enter with $MVP for a chance to win prizes.<br />
          Each ticket costs 1 $MVP. More tickets = better odds!<br />
          <span style={{ color: '#FDB927' }}>Default raffles pay out 50% / 30% / 15% of the pool.</span>
        </p>
      </div>

      {/* Live raffles */}
      {live.length > 0 ? (
        live.map((r) => renderRaffle(r, true))
      ) : (
        <div style={{ ...S.card }}>
          <div style={S.body}>
            <div style={S.empty}>No active raffles right now. Check back soon!</div>
          </div>
        </div>
      )}

      {/* History toggle */}
      {history.length > 0 && (
        <>
          <button style={S.toggle} onClick={() => setShowHistory(!showHistory)}>
            <span>{showHistory ? '▾' : '▸'}</span>
            Raffle History ({history.length})
          </button>
          {showHistory && history.map((r) => renderRaffle(r, false))}
        </>
      )}
    </div>
  );
}
