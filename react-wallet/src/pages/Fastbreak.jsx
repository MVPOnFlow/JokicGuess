import React, { useState, useEffect, useMemo, useRef } from 'react';
import * as fcl from "@onflow/fcl";

let leaderboardRequestToken = 0;

/** =========================
 *  Token config & helpers
 *  ========================= */

function formatUFix64(n) {
  const s = typeof n === "number" ? n.toFixed(8) : String(n);
  const [i, d = "0"] = s.split(".");
  const fixed = `${i}.${(d + "00000000").slice(0, 8)}`;
  return fixed.replace(/(\.\d*?[1-9])0+$/g, "$1");
}

function stripLeadingDollar(s) {
  return (s || "").replace(/^\$/, "");
}
function formatCurrencyLabel(s) {
  const stripped = stripLeadingDollar(s);
  return stripped ? `$${stripped}` : "";
}
function normalizeTokenLabel(label) {
  const x = stripLeadingDollar(label).toUpperCase();
  if (x === "MVP") return "MVP";
  if (x === "FLOW") return "FLOW";
  if (x === "TSHOT") return "TSHOT";
  if (x === "BETA") return "BETA";
  if (x === "FROTH") return "FROTH";
  if (x === "JUICE") return "JUICE";
  return null;
}

const TOKEN_CONFIG = {
  MVP: {
    contractName: "PetJokicsHorses",
    contractAddr: "0x6fd2465f3a22e34c",
    storagePath: "/storage/PetJokicsHorsesVault",
    publicReceiverPath: "/public/PetJokicsHorsesReceiver",
  },
  FLOW: {
    contractName: "FlowToken",
    contractAddr: "0x1654653399040a61",
    storagePath: "/storage/flowTokenVault",
    publicReceiverPath: "/public/flowTokenReceiver",
  },
  TSHOT: {
    contractName: "TSHOT",
    contractAddr: "0x05b67ba314000b2d",
    storagePath: "/storage/TSHOTTokenVault",
    publicReceiverPath: "/public/TSHOTTokenReceiver",
  },
  BETA: {
    contractName: "EVMVMBridgedToken_d8ad8ae8375aa31bff541e17dc4b4917014ebdaa",
    contractAddr: "0x1e4aa0b87d10b141",
    storagePath: "/storage/EVMVMBridgedToken_d8ad8ae8375aa31bff541e17dc4b4917014ebdaaVault",
    publicReceiverPath: "/public/EVMVMBridgedToken_d8ad8ae8375aa31bff541e17dc4b4917014ebdaaReceiver",
  },

  // NEW: FROTH (A.1e4aa0b87d10b141.EVMVMBridgedToken_b73bf8e6a4477a952e0338e6cc00cc0ce5ad04ba.Vault)
  FROTH: {
    contractName:
      "EVMVMBridgedToken_b73bf8e6a4477a952e0338e6cc00cc0ce5ad04ba",
    contractAddr: "0x1e4aa0b87d10b141",
    storagePath: "/storage/EVMVMBridgedToken_b73bf8e6a4477a952e0338e6cc00cc0ce5ad04baVault",
    publicReceiverPath: "/public/EVMVMBridgedToken_b73bf8e6a4477a952e0338e6cc00cc0ce5ad04baReceiver",
  },

  // NEW: JUICE (A.9db94c9564243ba7.aiSportsJuice.Vault)
  JUICE: {
    contractName: "aiSportsJuice",
    contractAddr: "0x9db94c9564243ba7",
    storagePath: "/storage/aiSportsJuiceVault",
    publicReceiverPath: "/public/aiSportsJuiceReceiver",
  },
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

async function sendToken({ token, amount, recipient, limit = 9999 }) {
  const cfg = TOKEN_CONFIG[token];
  if (!cfg) throw new Error(`Unsupported token '${token}'. Supported: ${Object.keys(TOKEN_CONFIG).join(", ")}`);
  const cadence = buildTransferCadence(cfg);
  const args = (arg, t) => [arg(formatUFix64(amount), t.UFix64), arg(recipient, t.Address)];
  const authz = fcl.currentUser().authorization;

  return fcl.mutate({ cadence, args, proposer: authz, payer: authz, authorizations: [authz], limit });
}

function simplifyFlowError(e) {
  const msg = String(e?.message || e);
  if (msg.includes("FungibleToken.Vault.withdraw: Cannot withdraw tokens")) return "Insufficient balance to complete the transfer.";
  if (msg.toLowerCase().includes("missing receiver capability")) return "Recipient wallet is not set up to receive this token.";
  return msg;
}

/** =========================
 *  Contest helpers
 *  ========================= */

function byOldestStart(a, b) {
  const at = Number(a?.lock_timestamp ?? 0);
  const bt = Number(b?.lock_timestamp ?? 0);
  return at - bt;
}
function isStarted(contest) {
  const now = Math.floor(Date.now() / 1000);
  const lt = Number(contest?.lock_timestamp ?? 0);
  return lt > 0 && now >= lt;
}
function startedWithinLastHours(contest, hrs = 8) {
  if (!isStarted(contest)) return false;
  const now = Math.floor(Date.now() / 1000);
  const lt = Number(contest.lock_timestamp);
  return (now - lt) <= hrs * 3600;
}
function startedOverHoursAgo(contest, hrs = 24) {
  if (!isStarted(contest)) return false;
  const now = Math.floor(Date.now() / 1000);
  const lt = Number(contest.lock_timestamp);
  return (now - lt) > hrs * 3600;
}
function nextToStart(contests) {
  const now = Math.floor(Date.now() / 1000);
  return contests.filter(c => Number(c.lock_timestamp ?? 0) > now)
    .sort((a, b) => Number(a.lock_timestamp) - Number(b.lock_timestamp))[0] || null;
}
function pickDefaultContest(contests) {
  if (!Array.isArray(contests) || contests.length === 0) return null;
  const recent = contests.filter(c => startedWithinLastHours(c, 8))
    .sort((a, b) => Number(b.lock_timestamp) - Number(a.lock_timestamp));
  if (recent.length > 0) return recent[0];
  const upcoming = nextToStart(contests);
  if (upcoming) return upcoming;
  return contests.filter(c => Number(c.lock_timestamp ?? 0) > 0)
    .sort((a, b) => Number(b.lock_timestamp) - Number(a.lock_timestamp))[0] || contests[0];
}
function statusBadgeData(contest) {
  const now = Math.floor(Date.now() / 1000);
  const lt = Number(contest?.lock_timestamp ?? 0);
  if (!lt) return { text: "Unknown", color: "#9CA3AF" };
  if (lt > now) {
    const diff = lt - now;
    const h = Math.floor(diff / 3600);
    const m = Math.floor((diff % 3600) / 60);
    const txt = h > 0 ? `Starts in ${h}h ${m}m` : `Starts in ${m}m`;
    return { text: txt, color: "#FDB927" };
  }
  if (startedOverHoursAgo(contest, 24)) return { text: "Completed", color: "#6B7280" };
  return { text: "Started", color: "#10B981" };
}

/** Query param helpers */
function getQueryParam(name) {
  if (typeof window === "undefined") return null;
  const url = new URL(window.location.href);
  return url.searchParams.get(name);
}
function setQueryParam(name, value) {
  if (typeof window === "undefined" || !name) return;
  const url = new URL(window.location.href);
  if (value === null || value === undefined || value === "") url.searchParams.delete(name);
  else url.searchParams.set(name, String(value));
  window.history.replaceState({}, "", url.toString());
}

/** Carousel refs & centering */
function useCardRefs(list) {
  const mapRef = useRef({});
  return useMemo(() => {
    const m = {};
    (list || []).forEach(item => {
      m[item.id] = (mapRef.current[item.id] ||= React.createRef());
    });
    return m;
  }, [list]);
}
function centerCardInView(containerEl, cardEl) {
  if (!containerEl || !cardEl) return;
  const cRect = containerEl.getBoundingClientRect();
  const elRect = cardEl.getBoundingClientRect();
  const currentScrollLeft = containerEl.scrollLeft;
  const offset = (elRect.left + elRect.width / 2) - (cRect.left + cRect.width / 2);
  containerEl.scrollTo({ left: currentScrollLeft + offset, behavior: "smooth" });
}

/** =========================
 *  Component
 *  ========================= */

export default function Fastbreak() {
  const [user, setUser] = useState({ loggedIn: null });
  const [txStatus, setTxStatus] = useState('');
  const [processing, setProcessing] = useState(false);

  const [contests, setContests] = useState([]);
  const [selectedContest, setSelectedContest] = useState(null);
  const [topshotUsername, setTopshotUsername] = useState('');

  const [leaderboardData, setLeaderboardData] = useState(null);
  const [leaderboardLoading, setLeaderboardLoading] = useState(false);
  const [countdown, setCountdown] = useState('');

  const [showModal, setShowModal] = useState(false);
  const [modalStats, setModalStats] = useState(null);

  const COMMUNITY_WALLET = "0x2459710b1d10aed0";
  const [usernames, setUsernames] = useState([]);

  // Collapsible Rules section
  const [showRules, setShowRules] = useState(true);

  // Autocomplete visibility
  const [showSuggestions, setShowSuggestions] = useState(false);

  // carousel refs
  const rowRef = useRef(null);
  const cardRefs = useCardRefs(contests);

  useEffect(() => {
    fetch("https://mvponflow.cc/api/fastbreak_racing_usernames")
      .then((res) => res.json())
      .then((data) => setUsernames(data))
      .catch((err) => console.error("Failed to fetch usernames", err));
  }, []);

  useEffect(() => {
    fcl.currentUser().subscribe(async (cu) => {
      setUser(cu);
      // Account linking fetch intentionally commented out for UI removal
      // if (cu?.addr) await fetchLinkedUsername(cu.addr);
    });
    fetchContests();
  }, []);

  useEffect(() => {
    if (selectedContest) {
      setLeaderboardLoading(true);
      fetchLeaderboard(selectedContest.id, user.addr);
      setQueryParam("contest", selectedContest.id);
      const container = rowRef.current;
      const card = cardRefs[selectedContest.id]?.current;
      if (container && card) centerCardInView(container, card);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, selectedContest]);

  useEffect(() => {
    if (!selectedContest || !selectedContest.lock_timestamp) {
      setCountdown('');
      return;
    }
    const interval = setInterval(() => {
      const now = Math.floor(Date.now() / 1000);
      const diff = selectedContest.lock_timestamp - now;
      if (diff <= 0) {
        setCountdown('Contest has started, no more entries!');
        clearInterval(interval);
      } else {
        const hours = String(Math.floor(diff / 3600)).padStart(2, '0');
        const minutes = String(Math.floor((diff % 3600) / 60)).padStart(2, '0');
        const seconds = String(diff % 60).padStart(2, '0');
        setCountdown(`${hours}:${minutes}:${seconds}`);
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [selectedContest]);

  const fetchContests = async () => {
    try {
      const res = await fetch("https://mvponflow.cc/api/fastbreak/contests");
      const data = await res.json();
      const sorted = [...data].sort(byOldestStart);
      setContests(sorted);

      // deep link via ?contest=ID
      const queryId = getQueryParam("contest");
      let initial = null;
      if (queryId) {
        const parsed = Number(queryId);
        initial = sorted.find(c => Number(c.id) === parsed) || null;
      }
      if (!initial) initial = pickDefaultContest(sorted);

      setSelectedContest(initial || sorted[0] || null);

      setTimeout(() => {
        if (initial) {
          const container = rowRef.current;
          const card = cardRefs[initial.id]?.current;
          if (container && card) centerCardInView(container, card);
        }
      }, 50);
    } catch (err) {
      console.error("Failed to load contests", err);
    }
  };

  const fetchLeaderboard = async (contestId, userWallet) => {
    setLeaderboardLoading(true);
    const currentToken = ++leaderboardRequestToken;
    try {
      const res = await fetch(`https://mvponflow.cc/api/fastbreak/contest/${contestId}/prediction-leaderboard?userWallet=${userWallet}`);
      const data = await res.json();
      if (currentToken === leaderboardRequestToken) setLeaderboardData(data);
    } catch (err) {
      console.error("Failed to load leaderboard", err);
    } finally {
        if (currentToken === leaderboardRequestToken) {
          setLeaderboardLoading(false); // <-- ADD
        }
    }
  };

  // const fetchLinkedUsername = async (walletAddr) => { ... }  // intentionally omitted from UI

  const handleSelectContest = (contest) => {
    setSelectedContest(contest);
    setLeaderboardData(null);
    const container = rowRef.current;
    const card = cardRefs[contest.id]?.current;
    if (container && card) centerCardInView(container, card);
  };

  const handleBuyIn = async () => {
    if (!user.loggedIn) { setTxStatus("❗ Please connect your wallet first."); return; }
    if (!selectedContest) { setTxStatus("❗ Please select a contest."); return; }
    if (!topshotUsername.trim()) { setTxStatus("❗ Please enter your TopShot username prediction."); return; }

    const tokenKey = normalizeTokenLabel(selectedContest.buy_in_currency);
    if (!tokenKey) { setTxStatus(`❗ Unsupported token/currency: ${selectedContest.buy_in_currency}`); return; }

    try {
      setProcessing(true);
      setTxStatus("Waiting for wallet approval...");
      const transactionId = await sendToken({ token: tokenKey, amount: selectedContest.buy_in_amount, recipient: COMMUNITY_WALLET });
      setTxStatus(`✅ Transaction submitted (DO NOT REFRESH)! TX ID: <a href="https://flowscan.io/tx/${transactionId}" target="_blank" rel="noopener noreferrer">${transactionId}</a>`);
      await fcl.tx(transactionId).onceSealed();

      setTxStatus(`✅ Transaction sealed! Registering your entry...`);
      await fetch(`https://mvponflow.cc/api/fastbreak/contest/${selectedContest.id}/entries`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topshotUsernamePrediction: topshotUsername, userWalletAddress: user.addr })
      });

      setTxStatus(`✅ Entry submitted!`);
      setProcessing(false);
      setTopshotUsername('');
      fetchLeaderboard(selectedContest.id, user.addr);
    } catch (error) {
      console.error(error);
      setProcessing(false);
      const userMsg = simplifyFlowError(error);
      const amount = selectedContest?.buy_in_amount ?? "N/A";
      const tokenLabel = formatCurrencyLabel(selectedContest?.buy_in_currency) ?? "";
      if (userMsg.includes("Insufficient balance")) {
        setTxStatus(`❗ Error: You need at least ${amount} ${tokenLabel} in your wallet to buy in.`);
      } else {
        setTxStatus(`❗ Error: ${userMsg}`);
      }
    }
  };

  const openStatsModal = async (username) => {
    if (!username || !selectedContest) return;
    try {
      const statsRes = await fetch(`https://mvponflow.cc/api/fastbreak_racing_stats/${username}`);
      const statsData = await statsRes.json();
      const lineupRes = await fetch(`https://mvponflow.cc/api/has_lineup?username=${username}&fastbreak_id=${selectedContest.fastbreak_id}`);
      const { hasLineup } = await lineupRes.json();
      setModalStats({ ...statsData, hasLineup });
      setShowModal(true);
    } catch (err) {
      console.error("Failed to fetch stats:", err);
      alert("Failed to load stats. Please try again.");
    }
  };

  const ContestCard = ({ contest, selected, onClick }) => {
    const { text, color } = statusBadgeData(contest);
    return (
      <div
        ref={cardRefs[contest.id]}
        className="contest-card"
        onClick={onClick}
        role="button"
        style={{
          width: 240, minWidth: 240, maxWidth: 240,
          padding: '12px',
          borderRadius: '14px',
          // rely on App.css card colors by NOT using .card here; keep our own look but with contrast
          backgroundColor: selected ? '#0E2240' : '#1C2A3A',
          border: selected ? '2px solid #FDB927' : '1px solid #273549',
          color: '#E5E7EB',
          cursor: 'pointer',
          boxShadow: selected ? '0 6px 20px rgba(253,185,39,0.25)' : '0 2px 10px rgba(0,0,0,0.25)',
          transform: selected ? 'scale(1.02)' : 'scale(1)',
          transition: 'transform .12s ease, box-shadow .12s ease, border .12s ease, background-color .12s ease'
        }}
      >
        <div className="d-flex align-items-start justify-content-between">
          <div className="fw-bold" style={{ color: '#FDB927', fontSize: '1rem', lineHeight: 1.25 }}>
            {contest.display_name || contest.fastbreak_id}
          </div>
          <span className="badge rounded-pill" style={{ backgroundColor: color, color: '#0B1220', fontWeight: 700 }} title={text}>
            {text}
          </span>
        </div>
        <div className="mt-2 small">
          Buy-in: <strong>{contest.buy_in_amount} {formatCurrencyLabel(contest.buy_in_currency)}</strong>
        </div>
      </div>
    );
  };

  const selectedIndex = useMemo(() => {
    if (!selectedContest) return -1;
    return contests.findIndex(c => c.id === selectedContest.id);
  }, [contests, selectedContest]);

  const scrollToIndex = (idx) => {
    if (idx < 0 || idx >= contests.length) return;
    const target = contests[idx];
    if (!target) return;
    handleSelectContest(target);
  };
  const scrollLeft = () => scrollToIndex(selectedIndex - 1);
  const scrollRight = () => scrollToIndex(selectedIndex + 1);
  const canBuyIn =
      user.loggedIn &&
      !processing &&
      !leaderboardLoading &&
      !!leaderboardData &&
      leaderboardData.status !== "STARTED";

  return (
    <div className="container">
      {/* ===================== RULES (separate card) ===================== */}
      <div className="card shadow mb-4">
        <div className="card-body">
          <h2 className="mb-3 text-center">Fastbreak Horse Race</h2>
          <div className="mb-2 text-center">
            <button
              className="btn"
              onClick={() => setShowRules(s => !s)}
              style={{
                backgroundColor: '#0E2240',
                color: '#FDB927',
                border: '1px solid #FDB927',
                fontWeight: 700,
                borderRadius: 9999,
                padding: '8px 16px'
              }}
            >
              {showRules ? 'Hide Rules' : 'Show Rules'}
            </button>
          </div>

          {showRules && (
            <div
              className="mt-4 p-4 rounded-3 text-light"
              style={{
                backgroundColor: "#1C2A3A",
                border: "1px solid #273549",
                lineHeight: "1.6",
              }}
            >
              <h5 className="mb-3 text-warning">🏇 How It Works</h5>
              <p className="mb-3">
                Pick a <strong>Top Shot user</strong> you think will finish highest in the
                selected Fastbreak daily game. You can bet on yourself or choose someone else.
              </p>

              <ul className="fastbreak-rules-list mb-4">
                <li>Submit before lock by selecting a TS user and sending the buy-in</li>
                <li>Highest-ranked among selected users wins the contest</li>
                <li>Unlimited entries per wallet</li>
              </ul>

              <h5 className="mb-3 text-warning">💰 Prizes</h5>
              <ul className="fastbreak-rules-list mb-4">
                <li>🏆 90% of the pot to the winner (split if tied)</li>
                <li>🐎 5% to the actual top horse (TS user picked by the winner)</li>
                <li>🎁 Pack reward for the winner (tie-breaker: earlier entry wins)</li>
                <li>🎲 Pack reward for one random entry</li>
              </ul>

              <div className="text-center">
                <img
                  src="/images/RIB1970wave3.png"
                  alt="RIB 1970 Pack Reward"
                  className="img-fluid rounded shadow mb-2"
                  style={{ maxWidth: "350px" }}
                />
                <p className="text-muted small mb-0">
                  🎁 <em>Run It Back: 1970s Chance Hit Pack (wave 3) -> two pack rewards in all daily historic run games.</em>
                </p>
              </div>
            </div>
          )}

        </div>
      </div>

      {/* ===================== CONTESTS (separate card) ===================== */}
      <div className="card shadow mb-4">
        <div className="card-body">
          <div className="position-relative">
            {/* Left Arrow */}
            <button
              className="btn position-absolute top-50 translate-middle-y"
              onClick={scrollLeft}
              disabled={selectedIndex <= 0}
              style={{
                left: -8, zIndex: 2, backgroundColor: '#0E2240', color: '#FDB927',
                border: '1px solid #FDB927', borderRadius: '50%', width: 40, height: 40,
                opacity: selectedIndex <= 0 ? 0.6 : 1
              }}
              aria-label="Previous contest"
            >
              ‹
            </button>

            {/* Scroll Row */}
            <div
              ref={rowRef}
              className="d-flex gap-3 px-5"
              style={{ overflow: 'hidden', scrollBehavior: 'smooth', alignItems: 'stretch' }}
            >
              {contests.map((c) => (
                <ContestCard
                  key={c.id}
                  contest={c}
                  selected={selectedContest?.id === c.id}
                  onClick={() => handleSelectContest(c)}
                />
              ))}
            </div>

            {/* Right Arrow */}
            <button
              className="btn position-absolute top-50 translate-middle-y"
              onClick={scrollRight}
              disabled={selectedIndex >= contests.length - 1}
              style={{
                right: -8, zIndex: 2, backgroundColor: '#0E2240', color: '#FDB927',
                border: '1px solid #FDB927', borderRadius: '50%', width: 40, height: 40,
                opacity: selectedIndex >= contests.length - 1 ? 0.6 : 1
              }}
              aria-label="Next contest"
            >
              ›
            </button>
          </div>
        </div>
      </div>

      {/* ===================== USERNAME (separate card) ===================== */}
      <div className="card shadow mb-4">
        <div className="card-body">
          <div className="mb-3 position-relative">
            <label>
              TopShot Username Prediction (Need help choosing?{" "}
              <span
                onClick={() => (window.location.href = "/horsestats")}
                style={{ color: "#FDB927", fontWeight: "bold", textDecoration: "underline", cursor: "pointer" }}
              >
                Investigate detailed stats
              </span>
              )
            </label>

            <input
              type="text"
              className="form-control"
              value={topshotUsername}
              onChange={(e) => {
                const next = e.target.value;
                setTopshotUsername(next);
                setShowSuggestions(next.trim().length > 0);
              }}
              onFocus={() => { if (topshotUsername.trim().length > 0) setShowSuggestions(true); }}
              onKeyDown={(e) => { if (e.key === "Escape" || e.key === "Enter") setShowSuggestions(false); }}
              onBlur={() => { setTimeout(() => setShowSuggestions(false), 120); }}
              placeholder="Enter TopShot username of someone who will win the daily fastbreak"
              autoComplete="off"
            />

            {showSuggestions && topshotUsername && (
              <ul className="list-group position-absolute w-100" style={{ zIndex: 1000 }} role="listbox">
                {usernames
                  .filter((u) => u.toLowerCase().includes(topshotUsername.toLowerCase()))
                  .slice(0, 5)
                  .map((u, idx) => (
                    <li
                      key={idx}
                      className="list-group-item list-group-item-action"
                      style={{ backgroundColor: "#1C2A3A", color: "#FDB927", cursor: "pointer" }}
                      onMouseDown={(e) => { e.preventDefault(); setTopshotUsername(u); setShowSuggestions(false); }}
                      role="option"
                      aria-selected={u.toLowerCase() === topshotUsername.toLowerCase()}
                    >
                      {u}
                    </li>
                  ))}
                {usernames.filter((u) => u.toLowerCase().includes(topshotUsername.toLowerCase())).length === 0 && (
                  <li className="list-group-item" style={{ backgroundColor: "#1C2A3A", color: "#ADB5BD" }}>
                    No matches — press Enter to use “{topshotUsername}”
                  </li>
                )}
              </ul>
            )}
          </div>

          <div className="d-flex flex-column flex-md-row gap-3 mt-3 justify-content-center">
            <button
              className="btn btn-outline-light flex-fill"
              style={{ backgroundColor: '#0E2240', color: '#FDB927', border: '1px solid #FDB927', fontWeight: '600' }}
              disabled={!topshotUsername.trim()}
              onClick={() => openStatsModal(topshotUsername.trim())}
            >
              📊 Check Their Stats
            </button>
            <button
              className="btn btn-primary flex-fill"
              onClick={handleBuyIn}
              disabled={!canBuyIn} // <-- CHANGE
            >
              {processing
                ? "Processing..."
                : leaderboardLoading || !leaderboardData
                  ? "Loading contest info..." // <-- Better feedback while disabled
                  : `Buy In for ${selectedContest?.buy_in_amount || ''} ${formatCurrencyLabel(selectedContest?.buy_in_currency) || ''}`}
            </button>
          </div>

          {txStatus && (
            <div className="mt-3 text-center">
              <p dangerouslySetInnerHTML={{ __html: txStatus }}></p>
            </div>
          )}
        </div>
      </div>

      {/* ===================== MODAL ===================== */}
      {showModal && modalStats && (
        <div
          className="modal show d-block"
          tabIndex="-1"
          style={{ backgroundColor: 'rgba(0, 0, 0, 0.6)' }}
          aria-modal="true"
          role="dialog"
        >
          <div className="modal-dialog modal-dialog-centered modal-lg">
            <div
              className="modal-content"
              style={{ backgroundColor: '#1C2A3A', color: '#E5E7EB', border: '1px solid #273549' }}
            >
              <div className="modal-header border-bottom-0">
                <h5 className="modal-title" style={{ color: '#FDB927' }}>
                  📊 Stats for {modalStats.username} for the last 15 classic daily games
                </h5>
                <button
                  type="button"
                  className="btn-close"
                  style={{ filter: 'invert(90%)' }}
                  onClick={() => setShowModal(false)}
                  aria-label="Close"
                />
              </div>

              <div className="modal-body">
                <div className="d-flex flex-wrap justify-content-around text-center mb-3">
                  <div>
                    <strong style={{ color: '#FDB927' }}>Flow Wallet Address:</strong>{' '}
                    {modalStats.flow_wallet || 'Account linking not enabled'}
                  </div>
                </div>

                <div className="d-flex flex-wrap justify-content-around text-center mb-3">
                  <div><strong style={{ color: '#FDB927' }}>Best:</strong> {modalStats.best}</div>
                  <div><strong style={{ color: '#FDB927' }}>Mean:</strong> {modalStats.mean}</div>
                  <div><strong style={{ color: '#FDB927' }}>Median:</strong> {modalStats.median}</div>
                  <div><strong style={{ color: '#FDB927' }}>Lineup:</strong> {modalStats.hasLineup ? '✅' : '❌'}</div>
                </div>

                <div>
                  <strong style={{ color: '#FDB927' }}>Recent Ranks:</strong>
                  <p className="mt-2 text-muted">
                    {Array.isArray(modalStats.rankings)
                      ? modalStats.rankings.map(r => r.rank).join(', ')
                      : 'N/A'}
                  </p>
                </div>
              </div>

              <div className="modal-footer border-top-0">
                <button className="btn btn-outline-light" onClick={() => setShowModal(false)}>
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}


      {/* ===================== LEADERBOARD ===================== */}
      {leaderboardData && (
        <div className="card shadow mb-4">
          <div className="card-body">
            <h3 className="card-title">📋 Contest Info</h3>
            {countdown && <p><strong>Contest locks in:</strong> {countdown}</p>}
            <p><strong>Total entries:</strong> {leaderboardData.totalEntries}</p>
            {(() => {
              const currency = formatCurrencyLabel(selectedContest?.buy_in_currency);
              const winnerShare = (leaderboardData.totalPot * 18 / 19).toFixed(2);
              const pickedShare = (leaderboardData.totalPot / 19).toFixed(2);
              return (
                <>
                  <p><strong>Total pot:</strong> {leaderboardData.totalPot.toFixed(2)} {currency}</p>
                  <p className="text-muted">
                    <em>Winner gets {winnerShare} {currency}, Selected user earns {pickedShare} {currency}</em>
                  </p>
                </>
              );
            })()}

            {leaderboardData.status === "STARTED" ? (
              <>
                <h4 className="mt-4 mb-3 text-center">🏆 Leaderboard</h4>
                <div className="table-responsive">
                  <table className="mvp-table">
                    <thead>
                      <tr>
                        <th>Rank</th>
                        <th>Wallet</th>
                        <th>Prediction</th>
                        <th>Fastbreak Rank</th>
                        <th>Points</th>
                        <th>Lineup</th>
                      </tr>
                    </thead>
                    <tbody>
                      {leaderboardData.entries.map(entry => (
                        <tr key={`${entry.wallet}-${entry.prediction}`} className={entry.isUser ? "mvp-user-row" : ""}>
                          <td>{entry.position}</td>
                          <td>{entry.wallet}</td>
                          <td className="leaderboard-link" onClick={() => openStatsModal(entry.prediction)}>{entry.prediction}</td>
                          <td>{entry.rank}</td>
                          <td>{entry.points}</td>
                          <td>{entry.lineup ? entry.lineup.join(", ") : "N/A"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            ) : (
              <>
                {leaderboardData.userEntries.length > 0 ? (
                  <>
                    <h5 className="mt-4">Your Entries:</h5>
                    <div className="table-responsive">
                      <table className="mvp-table">
                        <thead>
                          <tr>
                            <th>Prediction</th>
                            <th>Fastbreak Rank</th>
                            <th>Points</th>
                            <th>Lineup</th>
                          </tr>
                        </thead>
                        <tbody>
                          {leaderboardData.userEntries.map((entry, idx) => (
                            <tr key={idx}>
                              <td>{entry.prediction}</td>
                              <td>{entry.rank !== undefined ? entry.rank : "N/A"}</td>
                              <td>{entry.points !== undefined ? entry.points : "N/A"}</td>
                              <td>{entry.lineup ? entry.lineup.join(", ") : "N/A"}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </>
                ) : (
                  <p className="text-muted mt-3">You have not submitted any entries yet.</p>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
