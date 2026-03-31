import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import * as fcl from '@onflow/fcl';
import { Spinner } from 'react-bootstrap';
import './FastbreakBracket.css';

/* ── Token helpers (shared with Fastbreak.jsx) ── */

function formatUFix64(n) {
  const s = typeof n === 'number' ? n.toFixed(8) : String(n);
  const [i, d = '0'] = s.split('.');
  return `${i}.${(d + '00000000').slice(0, 8)}`.replace(/(\.\d*?[1-9])0+$/g, '$1');
}

function stripLeadingDollar(s) { return (s || '').replace(/^\$/, ''); }
function formatCurrencyLabel(s) { const x = stripLeadingDollar(s); return x ? `$${x}` : ''; }

const TOKEN_CONFIG = {
  MVP: { contractName: 'PetJokicsHorses', contractAddr: '0x6fd2465f3a22e34c', storagePath: '/storage/PetJokicsHorsesVault', publicReceiverPath: '/public/PetJokicsHorsesReceiver' },
  FLOW: { contractName: 'FlowToken', contractAddr: '0x1654653399040a61', storagePath: '/storage/flowTokenVault', publicReceiverPath: '/public/flowTokenReceiver' },
  TSHOT: { contractName: 'TSHOT', contractAddr: '0x05b67ba314000b2d', storagePath: '/storage/TSHOTTokenVault', publicReceiverPath: '/public/TSHOTTokenReceiver' },
  BETA: { contractName: 'EVMVMBridgedToken_d8ad8ae8375aa31bff541e17dc4b4917014ebdaa', contractAddr: '0x1e4aa0b87d10b141', storagePath: '/storage/EVMVMBridgedToken_d8ad8ae8375aa31bff541e17dc4b4917014ebdaaVault', publicReceiverPath: '/public/EVMVMBridgedToken_d8ad8ae8375aa31bff541e17dc4b4917014ebdaaReceiver' },
};

/* ── Cadence: discover child Dapper account ── */
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

function buildTransferCadence({ contractName, contractAddr, storagePath, publicReceiverPath }) {
  return `
import FungibleToken from 0xf233dcee88fe0abe
import StorageRent from 0x707adbad1428c624
import ${contractName} from ${contractAddr}

transaction(amount: UFix64, recipient: Address) {
  let sentVault: @{FungibleToken.Vault}
  prepare(signer: auth(Storage, BorrowValue) &Account) {
    let vaultRef = signer.storage.borrow<auth(FungibleToken.Withdraw) &${contractName}.Vault>(
      from: ${storagePath}
    ) ?? panic("Could not borrow reference to the owner's Vault!")
    self.sentVault <- vaultRef.withdraw(amount: amount)
  }
  execute {
    let recipientAccount = getAccount(recipient)
    let receiverRef = recipientAccount.capabilities.borrow<&{FungibleToken.Vault}>(
      ${publicReceiverPath}
    ) ?? panic("Recipient is missing receiver capability at ${publicReceiverPath}")
    receiverRef.deposit(from: <-self.sentVault)
    StorageRent.tryRefill(recipient)
  }
}
`;
}

async function sendToken({ token, amount, recipient }) {
  const cfg = TOKEN_CONFIG[token];
  if (!cfg) throw new Error(`Unsupported token '${token}'`);
  const cadence = buildTransferCadence(cfg);
  const args = (arg, t) => [arg(formatUFix64(amount), t.UFix64), arg(recipient, t.Address)];
  const authz = fcl.currentUser().authorization;
  return fcl.mutate({ cadence, args, proposer: authz, payer: authz, authorizations: [authz], limit: 9999 });
}

function simplifyFlowError(e) {
  const msg = String(e?.message || e);
  if (msg.includes('Cannot withdraw tokens')) return 'Insufficient balance to complete the transfer.';
  if (msg.toLowerCase().includes('missing receiver capability')) return 'Recipient wallet is not set up to receive this token.';
  return msg;
}

/* ── Constants ── */
const COMMUNITY_WALLET = '0x2459710b1d10aed0';
const ADMIN_WALLETS = ['0x6fd2465f3a22e34c', '0xcc4b6fa5550a4610'];
const ROUND_NAMES = { 1: 'Round 1', 2: 'Round 2', 3: 'Quarterfinals', 4: 'Semifinals', 5: 'Finals' };

function getRoundName(round, totalRounds) {
  if (round === totalRounds) return 'Finals';
  if (round === totalRounds - 1) return 'Semifinals';
  if (round === totalRounds - 2) return 'Quarterfinals';
  return ROUND_NAMES[round] || `Round ${round}`;
}

/* ── Bracket visualization helper ── */
function shortenWallet(w) {
  if (!w) return 'BYE';
  return `${w.slice(0, 6)}…${w.slice(-4)}`;
}

/* ================================================================== */
/*  FastbreakBracket – main page component                             */
/* ================================================================== */
export default function FastbreakBracket() {
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedTournamentId = searchParams.get('id') ? Number(searchParams.get('id')) : null;

  const [user, setUser] = useState({ loggedIn: null });
  const [tournaments, setTournaments] = useState([]);
  const [tournament, setTournament] = useState(null);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [txStatus, setTxStatus] = useState('');
  const [processing, setProcessing] = useState(false);
  const [showRules, setShowRules] = useState(false);
  const [expandedMatchup, setExpandedMatchup] = useState(null);
  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState({
    name: '', start_date: '', fee_amount: '5', fee_currency: '$MVP', max_rounds: '3',
    buyin_type: 'TOKEN',
    moment_tier: '', moment_player_name: '', moment_set_name: '', moment_series: '',
  });
  const [createStatus, setCreateStatus] = useState('');
  const [creating, setCreating] = useState(false);
  const [childAddr, setChildAddr] = useState(null);
  const [childError, setChildError] = useState(null);
  const [childLoading, setChildLoading] = useState(false);

  useEffect(() => { fcl.currentUser().subscribe(setUser); }, []);

  /* ── Discover child Dapper account when wallet connects ── */
  useEffect(() => {
    if (!user?.addr) {
      setChildAddr(null);
      setChildError(null);
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
            setChildError('No linked Dapper account found. Make sure your Dapper wallet is linked to this Flow wallet before signing up.');
          }
        }
      } catch (e) {
        if (!cancelled) setChildError('Could not discover Dapper child account. Please try reconnecting your wallet.');
      } finally {
        if (!cancelled) setChildLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [user?.addr]);

  const isAdmin = ADMIN_WALLETS.includes(user?.addr?.toLowerCase());

  /* ── Fetch tournament list ── */
  const fetchTournaments = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch('/api/bracket/tournaments');
      const data = await r.json();
      setTournaments(data);
    } catch (e) { console.error('Failed to fetch tournaments', e); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchTournaments(); }, [fetchTournaments]);

  /* ── Fetch tournament detail ── */
  const fetchTournamentDetail = useCallback(async (id) => {
    if (!id) { setTournament(null); return; }
    setDetailLoading(true);
    try {
      const r = await fetch(`/api/bracket/tournament/${id}`);
      const data = await r.json();
      if (r.ok) setTournament(data);
      else setTournament(null);
    } catch { setTournament(null); }
    finally { setDetailLoading(false); }
  }, []);

  useEffect(() => {
    if (selectedTournamentId) fetchTournamentDetail(selectedTournamentId);
    else setTournament(null);
  }, [selectedTournamentId, fetchTournamentDetail]);

  /* ── Auto-refresh active tournaments every 60s ── */
  useEffect(() => {
    if (!selectedTournamentId || !tournament || tournament.status !== 'ACTIVE') return;
    const interval = setInterval(() => {
      fetchTournamentDetail(selectedTournamentId);
    }, 60000);
    return () => clearInterval(interval);
  }, [selectedTournamentId, tournament?.status, fetchTournamentDetail]);

  const selectTournament = (id) => {
    setSearchParams(id ? { id: String(id) } : {});
  };

  /* ── Signup flow ── */
  const handleSignup = async () => {
    if (!user.loggedIn) { setTxStatus('❗ Please connect your wallet first.'); return; }
    if (!tournament) return;
    if (!childAddr) {
      setTxStatus('❗ No linked Dapper account detected. Please link your Dapper wallet before signing up.');
      return;
    }

    const buyin = tournament.buyin_type || 'TOKEN';

    try {
      setProcessing(true);

      if (buyin === 'TOKEN') {
        const tokenKey = stripLeadingDollar(tournament.fee_currency).toUpperCase();
        if (!TOKEN_CONFIG[tokenKey]) {
          setTxStatus(`❗ Unsupported token: ${tournament.fee_currency}`);
          setProcessing(false);
          return;
        }
        setTxStatus('Waiting for wallet approval…');
        const txId = await sendToken({ token: tokenKey, amount: tournament.fee_amount, recipient: COMMUNITY_WALLET });
        setTxStatus(`✅ Transaction submitted! TX: <a href="https://flowscan.io/tx/${txId}" target="_blank" rel="noopener noreferrer">${txId.slice(0, 12)}…</a>`);
        await fcl.tx(txId).onceSealed();
        setTxStatus('✅ Payment confirmed. Registering…');
      } else {
        // FREEROLL or MOMENT — no on-chain payment needed
        setTxStatus('Registering…');
      }

      const res = await fetch(`/api/bracket/tournament/${tournament.id}/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ wallet: user.addr }),
      });
      const j = await res.json();
      if (!res.ok) {
        setTxStatus(`❗ ${j.error || 'Signup failed'}`);
      } else {
        setTxStatus(`✅ Signed up as <strong>${j.ts_username}</strong>!`);
        fetchTournamentDetail(tournament.id);
        fetchTournaments();
      }
    } catch (e) {
      const msg = simplifyFlowError(e);
      setTxStatus(`❗ ${msg}`);
    } finally {
      setProcessing(false);
    }
  };

  /* ── Create tournament (admin) ── */
  const handleCreateTournament = async () => {
    if (!createForm.name.trim() || !createForm.start_date) {
      setCreateStatus('❗ Name and start date are required.');
      return;
    }
    if (createForm.buyin_type === 'MOMENT') {
      const { moment_tier, moment_player_name, moment_set_name, moment_series } = createForm;
      if (!moment_tier && !moment_player_name && !moment_set_name && !moment_series) {
        setCreateStatus('❗ At least one moment filter is required for Moment buy-in.');
        return;
      }
    }
    setCreating(true);
    setCreateStatus('');
    try {
      const body = {
        name: createForm.name.trim(),
        start_date: createForm.start_date,
        fee_amount: createForm.buyin_type === 'FREEROLL' ? 0 : (parseFloat(createForm.fee_amount) || 5),
        fee_currency: createForm.buyin_type === 'FREEROLL' ? '' : (createForm.fee_currency || '$MVP'),
        max_rounds: parseInt(createForm.max_rounds) || 3,
        buyin_type: createForm.buyin_type,
      };
      if (createForm.buyin_type === 'MOMENT') {
        const mf = {};
        if (createForm.moment_tier) mf.tier = createForm.moment_tier;
        if (createForm.moment_player_name) mf.player_name = createForm.moment_player_name;
        if (createForm.moment_set_name) mf.set_name = createForm.moment_set_name;
        if (createForm.moment_series) mf.series = createForm.moment_series;
        body.moment_filters = mf;
      }
      const res = await fetch('/api/bracket/tournaments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const j = await res.json();
      if (!res.ok) {
        setCreateStatus(`❗ ${j.error || 'Failed to create tournament'}`);
      } else {
        setCreateStatus(`✅ Created! ID=${j.id}, ${j.rounds_mapped} rounds mapped.`);
        setCreateForm({
          name: '', start_date: '', fee_amount: '5', fee_currency: '$MVP', max_rounds: '3',
          buyin_type: 'TOKEN', moment_tier: '', moment_player_name: '', moment_set_name: '', moment_series: '',
        });
        fetchTournaments();
      }
    } catch (e) {
      setCreateStatus(`❗ ${e.message}`);
    } finally {
      setCreating(false);
    }
  };

  /* ── Derived state ── */
  const userParticipant = useMemo(() => {
    if (!tournament || !user?.addr) return null;
    return (tournament.participants || []).find(
      p => p.wallet_address === user.addr.toLowerCase()
    );
  }, [tournament, user?.addr]);

  const isTournamentFull = tournament &&
    tournament.max_players &&
    (tournament.participants || []).length >= tournament.max_players;

  const isSignupOpen = tournament &&
    tournament.status === 'SIGNUP' &&
    Date.now() / 1000 < tournament.signup_close_ts &&
    !isTournamentFull;

  const signupTimeLeft = useMemo(() => {
    if (!tournament) return '';
    const diff = tournament.signup_close_ts - Math.floor(Date.now() / 1000);
    if (diff <= 0) return 'Signup closed';
    const h = Math.floor(diff / 3600);
    const m = Math.floor((diff % 3600) / 60);
    return h > 0 ? `${h}h ${m}m left` : `${m}m left`;
  }, [tournament]);

  /* ── Render helpers ── */
  const walletDisplay = useCallback((wallet) => {
    if (!wallet) return <span className="bracket-bye">BYE</span>;
    const p = (tournament?.participants || []).find(pp => pp.wallet_address === wallet);
    const name = p?.ts_username || shortenWallet(wallet);
    const isMe = user?.addr && wallet === user.addr.toLowerCase();
    return <span className={`bracket-player ${isMe ? 'bracket-me' : ''}`}>{name}</span>;
  }, [tournament, user?.addr]);

  /* ================================================================ */
  /*  TOURNAMENT LIST VIEW                                             */
  /* ================================================================ */
  if (!selectedTournamentId) {
    return (
      <div className="container bracket-page">
        <div className="card shadow mb-4">
          <div className="card-body">
            <h2 className="text-center mb-3">⚡ Fastbreak Bracket</h2>
            <p className="text-center text-muted mb-4">
              Elimination bracket tournaments powered by NBA TopShot Fastbreak daily scores.
            </p>

            {/* Rules toggle */}
            <div className="text-center mb-3">
              <button className="bracket-rules-btn" onClick={() => setShowRules(s => !s)}>
                {showRules ? 'Hide Rules' : 'Show Rules'}
              </button>
            </div>
            {showRules && (
              <div className="bracket-rules-box mb-4">
                <h5 className="text-warning mb-2">🏆 How It Works</h5>
                <ul className="bracket-rules-list">
                  <li>Sign up before the deadline — entry may require a token fee, a qualifying moment, or be free (freeroll)</li>
                  <li>Your Flow wallet is linked to your Dapper/TopShot username</li>
                  <li>Once signups close, a single-elimination bracket is formed</li>
                  <li>Each round corresponds to one daily Fastbreak contest on NBA TopShot</li>
                  <li>Your real Fastbreak score determines the winner of each matchup</li>
                  <li>If you don't have an opponent in round 1, you get a BYE (auto-advance)</li>
                  <li>Last player standing wins!</li>
                </ul>
              </div>
            )}

            {/* Admin: Create tournament */}
            {isAdmin && (
              <div className="bracket-admin-box mb-4">
                <button className="bracket-rules-btn" onClick={() => setShowCreate(s => !s)}>
                  {showCreate ? 'Hide Admin Panel' : '⚙ Create Tournament'}
                </button>
                {showCreate && (
                  <div className="bracket-admin-form mt-3">
                    <div className="bracket-admin-row">
                      <label>Name</label>
                      <input type="text" placeholder="Fastbreak Bracket #2" value={createForm.name}
                        onChange={e => setCreateForm(f => ({ ...f, name: e.target.value }))} />
                    </div>
                    <div className="bracket-admin-row">
                      <label>Start Date</label>
                      <input type="date" value={createForm.start_date}
                        onChange={e => setCreateForm(f => ({ ...f, start_date: e.target.value }))} />
                    </div>
                    <div className="bracket-admin-row">
                      <label>Buy-in Type</label>
                      <select value={createForm.buyin_type}
                        onChange={e => setCreateForm(f => ({ ...f, buyin_type: e.target.value }))}>
                        <option value="TOKEN">Token (pay entry fee)</option>
                        <option value="FREEROLL">Freeroll (free entry)</option>
                        <option value="MOMENT">Moment (must own matching moment)</option>
                      </select>
                    </div>
                    {createForm.buyin_type === 'TOKEN' && (
                      <>
                        <div className="bracket-admin-row">
                          <label>Fee</label>
                          <input type="number" min="0" step="1" value={createForm.fee_amount}
                            onChange={e => setCreateForm(f => ({ ...f, fee_amount: e.target.value }))} />
                        </div>
                        <div className="bracket-admin-row">
                          <label>Currency</label>
                          <select value={createForm.fee_currency}
                            onChange={e => setCreateForm(f => ({ ...f, fee_currency: e.target.value }))}>
                            <option value="$MVP">$MVP</option>
                            <option value="$FLOW">$FLOW</option>
                            <option value="$TSHOT">$TSHOT</option>
                            <option value="$BETA">$BETA</option>
                          </select>
                        </div>
                      </>
                    )}
                    {createForm.buyin_type === 'MOMENT' && (
                      <div className="bracket-moment-filters">
                        <p className="text-muted small mb-2">Specify at least one filter — players must own a matching TopShot moment to enter.</p>
                        <div className="bracket-admin-row">
                          <label>Tier</label>
                          <select value={createForm.moment_tier}
                            onChange={e => setCreateForm(f => ({ ...f, moment_tier: e.target.value }))}>
                            <option value="">Any</option>
                            <option value="COMMON">Common</option>
                            <option value="FANDOM">Fandom</option>
                            <option value="RARE">Rare</option>
                            <option value="LEGENDARY">Legendary</option>
                            <option value="ULTIMATE">Ultimate</option>
                          </select>
                        </div>
                        <div className="bracket-admin-row">
                          <label>Player Name</label>
                          <input type="text" placeholder="e.g. Stephen Curry" value={createForm.moment_player_name}
                            onChange={e => setCreateForm(f => ({ ...f, moment_player_name: e.target.value }))} />
                        </div>
                        <div className="bracket-admin-row">
                          <label>Set Name</label>
                          <input type="text" placeholder="e.g. Base Set" value={createForm.moment_set_name}
                            onChange={e => setCreateForm(f => ({ ...f, moment_set_name: e.target.value }))} />
                        </div>
                        <div className="bracket-admin-row">
                          <label>Series</label>
                          <input type="text" placeholder="e.g. 8" value={createForm.moment_series}
                            onChange={e => setCreateForm(f => ({ ...f, moment_series: e.target.value }))} />
                        </div>
                      </div>
                    )}
                    <div className="bracket-admin-row">
                      <label>Max Rounds</label>
                      <select value={createForm.max_rounds}
                        onChange={e => setCreateForm(f => ({ ...f, max_rounds: e.target.value }))}>
                        <option value="1">1 (2 players)</option>
                        <option value="2">2 (4 players)</option>
                        <option value="3">3 (8 players)</option>
                        <option value="4">4 (16 players)</option>
                        <option value="5">5 (32 players)</option>
                        <option value="6">6 (64 players)</option>
                      </select>
                    </div>
                    <button className="bracket-signup-btn mt-2" disabled={creating} onClick={handleCreateTournament}>
                      {creating ? 'Creating…' : 'Create Tournament'}
                    </button>
                    {createStatus && <p className="bracket-tx-status mt-2" dangerouslySetInnerHTML={{ __html: createStatus }} />}
                  </div>
                )}
              </div>
            )}

            {loading ? (
              <div className="text-center py-4">
                <Spinner animation="border" variant="warning" />
              </div>
            ) : tournaments.length === 0 ? (
              <p className="text-center text-muted py-4">No tournaments yet. Check back soon!</p>
            ) : (
              <div className="bracket-tournament-list">
                {tournaments.map(t => {
                  const now = Math.floor(Date.now() / 1000);
                  const isOpen = t.status === 'SIGNUP' && t.signup_close_ts > now;
                  const statusLabel = t.status === 'COMPLETE'
                    ? '✅ Complete'
                    : t.status === 'ACTIVE'
                      ? '🔥 In Progress'
                      : isOpen
                        ? '📝 Signup Open'
                        : '⏳ Signup Closed';
                  const statusColor = t.status === 'COMPLETE' ? '#6B7280'
                    : t.status === 'ACTIVE' ? '#10B981'
                    : isOpen ? '#FDB927' : '#9CA3AF';

                  return (
                    <div key={t.id} className="bracket-tournament-card" onClick={() => selectTournament(t.id)}>
                      <div className="btc-header">
                        <span className="btc-name">{t.name}</span>
                        <span className="btc-status" style={{ color: statusColor }}>{statusLabel}</span>
                      </div>
                      <div className="btc-details">
                        <span>
                          {t.buyin_type === 'FREEROLL'
                            ? 'Entry: 🆓 Freeroll'
                            : t.buyin_type === 'MOMENT'
                              ? <>Entry: 🃏 Moment{t.moment_filters && <> ({[t.moment_filters.tier, t.moment_filters.player_name, t.moment_filters.set_name, t.moment_filters.series && `S${t.moment_filters.series}`].filter(Boolean).join(', ')})</>}</>
                              : <>Fee: <strong>{t.fee_amount} {formatCurrencyLabel(t.fee_currency)}</strong></>}
                        </span>
                        <span>Players: <strong>{t.participant_count}{t.max_players ? ` / ${t.max_players}` : ''}</strong></span>
                        {t.winner_wallet && (
                          <span>Winner: <strong>{shortenWallet(t.winner_wallet)}</strong></span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  /* ================================================================ */
  /*  TOURNAMENT DETAIL VIEW                                           */
  /* ================================================================ */
  if (detailLoading) {
    return (
      <div className="container bracket-page">
        <div className="text-center py-5"><Spinner animation="border" variant="warning" /></div>
      </div>
    );
  }

  if (!tournament) {
    return (
      <div className="container bracket-page">
        <div className="card shadow"><div className="card-body text-center">
          <p className="text-muted">Tournament not found.</p>
          <button className="btn btn-outline-warning" onClick={() => selectTournament(null)}>← Back</button>
        </div></div>
      </div>
    );
  }

  const totalRounds = tournament.total_rounds || 1;
  const rounds = tournament.rounds || {};

  return (
    <div className="container bracket-page">
      {/* Header */}
      <div className="card shadow mb-4">
        <div className="card-body">
          <button className="btn btn-sm btn-outline-warning mb-3" onClick={() => selectTournament(null)}>← All Tournaments</button>

          <h2 className="text-center mb-2">{tournament.name}</h2>

          <div className="bracket-meta">
            <span className={`bracket-status bracket-status-${tournament.status.toLowerCase()}`}>
              {tournament.status === 'SIGNUP' ? '📝 Signup' : tournament.status === 'ACTIVE' ? '🔥 Active' : '✅ Complete'}
            </span>
            <span>
              {(tournament.buyin_type || 'TOKEN') === 'FREEROLL'
                ? 'Entry: 🆓 Freeroll'
                : (tournament.buyin_type || 'TOKEN') === 'MOMENT'
                  ? 'Entry: 🃏 Moment'
                  : <>Fee: <strong>{tournament.fee_amount} {formatCurrencyLabel(tournament.fee_currency)}</strong></>}
            </span>
            <span>Players: <strong>{(tournament.participants || []).length}{tournament.max_players ? ` / ${tournament.max_players}` : ''}</strong></span>
            <span>Rounds: <strong>{totalRounds}</strong></span>
            {tournament.status !== 'COMPLETE' && <span className="bracket-countdown">{signupTimeLeft}</span>}
          </div>

          {/* Moment filter details */}
          {(tournament.buyin_type || 'TOKEN') === 'MOMENT' && tournament.moment_filters && (
            <div className="bracket-moment-requirements">
              🃏 <strong>Required Moment:</strong>{' '}
              {[tournament.moment_filters.tier, tournament.moment_filters.player_name, tournament.moment_filters.set_name, tournament.moment_filters.series && `Series ${tournament.moment_filters.series}`].filter(Boolean).join(' · ')}
            </div>
          )}

          {(tournament.buyin_type || 'TOKEN') === 'TOKEN' && (
            <div className="bracket-prize-pool">
              💰 Prize: <strong>{(tournament.fee_amount * (tournament.participants || []).length * 0.95).toFixed(2)} {formatCurrencyLabel(tournament.fee_currency)}</strong>
            </div>
          )}
          {(tournament.buyin_type || 'TOKEN') === 'FREEROLL' && (
            <div className="bracket-prize-pool">
              🆓 Free entry — bragging rights on the line!
            </div>
          )}
          {(tournament.buyin_type || 'TOKEN') === 'MOMENT' && (
            <div className="bracket-prize-pool">
              🃏 Moment buy-in — prove you own a qualifying moment to enter!
            </div>
          )}

          {/* Winner banner */}
          {tournament.status === 'COMPLETE' && tournament.winner_wallet && (
            <div className="bracket-winner-banner">
              🏆 Champion: {walletDisplay(tournament.winner_wallet)}
            </div>
          )}

          {/* Signup action */}
          {isSignupOpen && !userParticipant && (
            <div className="bracket-signup-box">
              {!user.loggedIn && (
                <p>
                  {(tournament.buyin_type || 'TOKEN') === 'FREEROLL'
                    ? 'Connect your wallet to join this free bracket.'
                    : (tournament.buyin_type || 'TOKEN') === 'MOMENT'
                      ? 'Connect your wallet to verify your moment and join.'
                      : 'Connect your wallet and pay the entry fee to join this bracket.'}
                </p>
              )}
              {user.loggedIn && childLoading && (
                <p className="bracket-wallet-checking"><Spinner animation="border" size="sm" variant="warning" /> Checking wallet…</p>
              )}
              {user.loggedIn && childError && (
                <div className="bracket-wallet-warning">
                  ⚠️ {childError}
                  <br />
                  <a href="https://nft.flowverse.co/" target="_blank" rel="noopener noreferrer">Link your Dapper wallet →</a>
                </div>
              )}
              {user.loggedIn && !childLoading && childAddr && (
                <p>
                  {(tournament.buyin_type || 'TOKEN') === 'FREEROLL'
                    ? 'Your Dapper account is linked. Join for free!'
                    : (tournament.buyin_type || 'TOKEN') === 'MOMENT'
                      ? 'Your Dapper account is linked. Verify your moment and join.'
                      : 'Your Dapper account is linked. Pay the entry fee to join.'}
                </p>
              )}
              <button
                className="bracket-signup-btn"
                onClick={handleSignup}
                disabled={!user.loggedIn || processing || childLoading || !!childError}
              >
                {processing ? 'Processing…' : !user.loggedIn
                  ? 'Connect Wallet to Sign Up'
                  : (tournament.buyin_type || 'TOKEN') === 'FREEROLL'
                    ? 'Sign Up (Free)'
                    : (tournament.buyin_type || 'TOKEN') === 'MOMENT'
                      ? 'Verify Moment & Sign Up'
                      : `Pay ${tournament.fee_amount} ${formatCurrencyLabel(tournament.fee_currency)} & Sign Up`}
              </button>
              {txStatus && <p className="bracket-tx-status mt-2" dangerouslySetInnerHTML={{ __html: txStatus }} />}
            </div>
          )}
          {isTournamentFull && !userParticipant && tournament.status === 'SIGNUP' && (
            <div className="bracket-signed-up">
              🚫 Tournament is full ({tournament.max_players}/{tournament.max_players} players)
            </div>
          )}
          {userParticipant && (
            <div className="bracket-signed-up">
              ✅ You are signed up as <strong>{userParticipant.ts_username}</strong>
              {userParticipant.eliminated_in_round && (
                <span className="bracket-eliminated"> — Eliminated in {getRoundName(userParticipant.eliminated_in_round, totalRounds)}</span>
              )}
            </div>
          )}

          {/* How It Works — show during signup phase */}
          {tournament.status === 'SIGNUP' && (
            <div className="bracket-rules-box mt-4">
              <h5 className="text-warning mb-2">🏆 How It Works</h5>
              <ul className="bracket-rules-list">
                <li>
                  {(tournament.buyin_type || 'TOKEN') === 'FREEROLL'
                    ? 'Sign up for free before the deadline'
                    : (tournament.buyin_type || 'TOKEN') === 'MOMENT'
                      ? 'Sign up by verifying you own a qualifying TopShot moment'
                      : 'Sign up by paying the entry fee before the deadline'}
                </li>
                <li>Your Flow wallet is linked to your Dapper/TopShot username</li>
                <li>Once signups close, a single-elimination bracket is formed</li>
                <li>Each round corresponds to one daily Fastbreak contest on NBA TopShot</li>
                <li>Your real Fastbreak score determines the winner of each matchup</li>
                <li>If you don't have an opponent in round 1, you get a BYE (auto-advance)</li>
                <li>Last player standing wins{(tournament.buyin_type || 'TOKEN') === 'TOKEN' ? ' the prize pool!' : '!'}</li>
              </ul>
            </div>
          )}
        </div>
      </div>

      {/* Bracket visualization */}
      {tournament.status !== 'SIGNUP' && (
        <div className="card shadow mb-4">
          <div className="card-body">
            <h3 className="text-center mb-4">Bracket</h3>
            <div className="bracket-container">
              {Array.from({ length: totalRounds }, (_, ri) => {
                const roundNum = ri + 1;
                const matchups = rounds[roundNum] || rounds[String(roundNum)] || [];
                const schedule = (tournament.round_schedule || {})[roundNum] || (tournament.round_schedule || {})[String(roundNum)];
                const gameDate = schedule?.game_date;
                const objectives = schedule?.objectives;
                return (
                  <div key={roundNum} className="bracket-round">
                    <div className="bracket-round-title">
                      {getRoundName(roundNum, totalRounds)}
                      {gameDate && (
                        <span className="bracket-round-date">
                          {new Date(gameDate + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                        </span>
                      )}
                      {objectives && (
                        <span className="bracket-round-objectives">
                          {objectives}
                        </span>
                      )}
                      {roundNum === tournament.current_round && tournament.status === 'ACTIVE' && (
                        <span className="bracket-current-badge">Current</span>
                      )}
                      {matchups.some(m => m.status === 'PENDING' && (m.player1_score != null || m.player2_score != null)) && (
                        <span className="bracket-live-badge">LIVE</span>
                      )}
                      {matchups.every(m => m.status === 'PROJECTED') && matchups.length > 0 && (
                        <span className="bracket-projected-badge">Projected</span>
                      )}
                    </div>
                    <div className="bracket-matchups">
                      {matchups.map((m) => {
                        const isComplete = m.status === 'COMPLETE' || m.status === 'BYE';
                        const isProjected = m.status === 'PROJECTED';
                        const isLive = m.status === 'PENDING' && (m.player1_score != null || m.player2_score != null);
                        const isExpanded = expandedMatchup === m.id;
                        const hasLineupData = (m.player1_lineup?.length > 0) || (m.player2_lineup?.length > 0);
                        const isClickable = hasLineupData && !isProjected;
                        return (
                          <div
                            key={m.id}
                            className={`bracket-matchup ${isComplete ? 'bracket-matchup-done' : ''} ${isProjected ? 'bracket-matchup-projected' : ''} ${isLive ? 'bracket-matchup-live' : ''} ${isClickable ? 'bracket-matchup-clickable' : ''} ${isExpanded ? 'bracket-matchup-expanded' : ''}`}
                            onClick={() => isClickable && setExpandedMatchup(isExpanded ? null : m.id)}
                          >
                            {/* Player 1 slot */}
                            <div className={`bracket-slot ${m.winner_wallet === m.player1_wallet && isComplete ? 'bracket-slot-winner' : ''}`}>
                              <div className="bracket-slot-header">
                                {walletDisplay(m.player1_wallet)}
                                {m.player1_score != null && <span className="bracket-score">{m.player1_score} pts</span>}
                              </div>
                            </div>
                            <div className="bracket-vs">{hasLineupData ? (isExpanded ? '▾ vs' : '▸ vs') : 'vs'}</div>
                            {/* Player 2 slot */}
                            <div className={`bracket-slot ${m.winner_wallet === m.player2_wallet && isComplete ? 'bracket-slot-winner' : ''}`}>
                              <div className="bracket-slot-header">
                                {walletDisplay(m.player2_wallet)}
                                {m.player2_score != null && <span className="bracket-score">{m.player2_score} pts</span>}
                              </div>
                            </div>
                            {/* Expanded lineup detail */}
                            {isExpanded && (
                              <div className="bracket-detail" onClick={e => e.stopPropagation()}>
                                {[{ wallet: m.player1_wallet, rank: m.player1_rank, score: m.player1_score, lineup: m.player1_lineup, isWinner: m.winner_wallet === m.player1_wallet && isComplete },
                                  { wallet: m.player2_wallet, rank: m.player2_rank, score: m.player2_score, lineup: m.player2_lineup, isWinner: m.winner_wallet === m.player2_wallet && isComplete }]
                                  .filter(p => p.wallet)
                                  .map((p, pi) => (
                                    <div key={pi} className={`bracket-detail-player ${p.isWinner ? 'bracket-detail-winner' : ''}`}>
                                      <div className="bracket-detail-header">
                                        <span className="bracket-detail-name">{walletDisplay(p.wallet)}</span>
                                        <span className="bracket-detail-stats">
                                          {p.score != null && <span className="bracket-detail-pts">{p.score} pts</span>}
                                          {p.rank != null && <span className="bracket-detail-rank">Rank #{p.rank}</span>}
                                        </span>
                                      </div>
                                      {p.lineup && p.lineup.length > 0 ? (
                                        <div className="bracket-detail-lineup">
                                          {p.lineup.map((name, i) => (
                                            <span key={i} className="bracket-lineup-player">{name}</span>
                                          ))}
                                        </div>
                                      ) : (
                                        <div className="bracket-detail-no-lineup">No lineup submitted</div>
                                      )}
                                    </div>
                                  ))}
                              </div>
                            )}
                          </div>
                        );
                      })}
                      {matchups.length === 0 && (
                        <div className="bracket-pending-round">TBD</div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Participants table */}
      <div className="card shadow mb-4">
        <div className="card-body">
          <h3 className="text-center mb-3">Participants ({(tournament.participants || []).length}{tournament.max_players ? ` / ${tournament.max_players}` : ''})</h3>
          {(tournament.participants || []).length === 0 ? (
            <p className="text-center text-muted">No participants yet.</p>
          ) : (
            <div className="table-responsive">
              <table className="mvp-table">
                <thead>
                  <tr>
                    <th>Seed</th>
                    <th>TopShot Username</th>
                    <th>Wallet</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {(tournament.participants || []).map((p) => {
                    const isMe = user?.addr && p.wallet_address === user.addr.toLowerCase();
                    const isChamp = tournament.winner_wallet === p.wallet_address;
                    return (
                      <tr key={p.id} className={isMe ? 'mvp-user-row' : ''}>
                        <td>{p.seed_number || '—'}</td>
                        <td><strong>{p.ts_username || '—'}</strong></td>
                        <td style={{ fontFamily: 'monospace', fontSize: '0.85em' }}>{p.wallet_address || '—'}</td>
                        <td>
                          {isChamp ? '🏆 Champion'
                            : p.eliminated_in_round ? `❌ Rd ${p.eliminated_in_round}`
                            : tournament.status === 'COMPLETE' ? '—'
                            : '✅ Active'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
