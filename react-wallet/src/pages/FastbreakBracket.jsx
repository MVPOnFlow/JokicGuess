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
};

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
const ADMIN_WALLET = '0x6fd2465f3a22e34c';
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
  const [createForm, setCreateForm] = useState({ name: '', start_date: '', fee_amount: '5', fee_currency: '$MVP' });
  const [createStatus, setCreateStatus] = useState('');
  const [creating, setCreating] = useState(false);

  useEffect(() => { fcl.currentUser().subscribe(setUser); }, []);

  const isAdmin = user?.addr?.toLowerCase() === ADMIN_WALLET;

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

  const selectTournament = (id) => {
    setSearchParams(id ? { id: String(id) } : {});
  };

  /* ── Signup flow ── */
  const handleSignup = async () => {
    if (!user.loggedIn) { setTxStatus('❗ Please connect your wallet first.'); return; }
    if (!tournament) return;

    const tokenKey = stripLeadingDollar(tournament.fee_currency).toUpperCase();
    if (!TOKEN_CONFIG[tokenKey]) {
      setTxStatus(`❗ Unsupported token: ${tournament.fee_currency}`);
      return;
    }

    try {
      setProcessing(true);
      setTxStatus('Waiting for wallet approval…');
      const txId = await sendToken({ token: tokenKey, amount: tournament.fee_amount, recipient: COMMUNITY_WALLET });
      setTxStatus(`✅ Transaction submitted! TX: <a href="https://flowscan.io/tx/${txId}" target="_blank" rel="noopener noreferrer">${txId.slice(0, 12)}…</a>`);
      await fcl.tx(txId).onceSealed();

      setTxStatus('✅ Payment confirmed. Registering…');
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
    setCreating(true);
    setCreateStatus('');
    try {
      const res = await fetch('/api/bracket/tournaments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: createForm.name.trim(),
          start_date: createForm.start_date,
          fee_amount: parseFloat(createForm.fee_amount) || 5,
          fee_currency: createForm.fee_currency || '$MVP',
        }),
      });
      const j = await res.json();
      if (!res.ok) {
        setCreateStatus(`❗ ${j.error || 'Failed to create tournament'}`);
      } else {
        setCreateStatus(`✅ Created! ID=${j.id}, ${j.rounds_mapped} rounds mapped.`);
        setCreateForm({ name: '', start_date: '', fee_amount: '5', fee_currency: '$MVP' });
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

  const isSignupOpen = tournament &&
    tournament.status === 'SIGNUP' &&
    Date.now() / 1000 < tournament.signup_close_ts;

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
                  <li>Sign up by paying the entry fee before the deadline</li>
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
                        <span>Fee: <strong>{t.fee_amount} {formatCurrencyLabel(t.fee_currency)}</strong></span>
                        <span>Players: <strong>{t.participant_count}</strong></span>
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
            <span>Fee: <strong>{tournament.fee_amount} {formatCurrencyLabel(tournament.fee_currency)}</strong></span>
            <span>Players: <strong>{(tournament.participants || []).length}</strong></span>
            <span>Rounds: <strong>{totalRounds}</strong></span>
            {tournament.status !== 'COMPLETE' && <span className="bracket-countdown">{signupTimeLeft}</span>}
          </div>

          {/* Winner banner */}
          {tournament.status === 'COMPLETE' && tournament.winner_wallet && (
            <div className="bracket-winner-banner">
              🏆 Champion: {walletDisplay(tournament.winner_wallet)}
            </div>
          )}

          {/* Signup action */}
          {isSignupOpen && !userParticipant && (
            <div className="bracket-signup-box">
              <p>Connect your wallet and pay the entry fee to join this bracket.</p>
              <button
                className="bracket-signup-btn"
                onClick={handleSignup}
                disabled={!user.loggedIn || processing}
              >
                {processing ? 'Processing…' : user.loggedIn
                  ? `Pay ${tournament.fee_amount} ${formatCurrencyLabel(tournament.fee_currency)} & Sign Up`
                  : 'Connect Wallet to Sign Up'}
              </button>
              {txStatus && <p className="bracket-tx-status mt-2" dangerouslySetInnerHTML={{ __html: txStatus }} />}
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
                return (
                  <div key={roundNum} className="bracket-round">
                    <div className="bracket-round-title">
                      {getRoundName(roundNum, totalRounds)}
                      {gameDate && (
                        <span className="bracket-round-date">
                          {new Date(gameDate + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                        </span>
                      )}
                      {roundNum === tournament.current_round && tournament.status === 'ACTIVE' && (
                        <span className="bracket-current-badge">Current</span>
                      )}
                    </div>
                    <div className="bracket-matchups">
                      {matchups.map((m) => {
                        const isComplete = m.status === 'COMPLETE' || m.status === 'BYE';
                        const isExpanded = expandedMatchup === m.id;
                        const hasLineupData = (m.player1_lineup?.length > 0) || (m.player2_lineup?.length > 0);
                        return (
                          <div
                            key={m.id}
                            className={`bracket-matchup ${isComplete ? 'bracket-matchup-done' : ''} ${hasLineupData ? 'bracket-matchup-clickable' : ''} ${isExpanded ? 'bracket-matchup-expanded' : ''}`}
                            onClick={() => hasLineupData && setExpandedMatchup(isExpanded ? null : m.id)}
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
          <h3 className="text-center mb-3">Participants ({(tournament.participants || []).length})</h3>
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
                        <td>{shortenWallet(p.wallet_address)}</td>
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
