import React, { useState, useEffect } from 'react';
import * as fcl from "@onflow/fcl";

let leaderboardRequestToken = 0;

/** =========================
 *  Token config & helpers
 *  ========================= */

/** Format to UFix64 (<= 8 dp, keep at least one decimal) */
function formatUFix64(n) {
  const s = typeof n === "number" ? n.toFixed(8) : String(n);
  const [i, d = "0"] = s.split(".");
  const fixed = `${i}.${(d + "00000000").slice(0, 8)}`;
  return fixed.replace(/(\.\d*?[1-9])0+$/g, "$1");
}

/** Strip a single leading $ if present (for internal use) */
function stripLeadingDollar(s) {
  return (s || "").replace(/^\$/, "");
}

/** Always show currency with a leading $ (for UI) */
function formatCurrencyLabel(s) {
  const stripped = stripLeadingDollar(s);
  return stripped ? `$${stripped}` : "";
}

/** Map contest currency label -> token key in config */
function normalizeTokenLabel(label) {
  const x = stripLeadingDollar(label).toUpperCase();
  if (x === "MVP") return "MVP";
  if (x === "FLOW") return "FLOW";
  if (x === "TSHOT") return "TSHOT";
  if (x === "BETA") return "BETA";
  return null;
}

/** MAINNET token wiring */
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
  // Bridged "BETA" token
  BETA: {
    contractName: "EVMVMBridgedToken_d8ad8ae8375aa31bff541e17dc4b4917014ebdaa",
    contractAddr: "0x1e4aa0b87d10b141",
    storagePath: "/storage/EVMVMBridgedToken_d8ad8ae8375aa31bff541e17dc4b4917014ebdaaVault",
    publicReceiverPath: "/public/EVMVMBridgedToken_d8ad8ae8375aa31bff541e17dc4b4917014ebdaaReceiver",
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

/** One helper to send any supported FT */
async function sendToken({
  token,       // 'MVP' | 'FLOW' | 'TSHOT' | 'BETA'
  amount,      // number|string
  recipient,   // 0x...
  limit = 9999
}) {
  const cfg = TOKEN_CONFIG[token];
  if (!cfg) throw new Error(`Unsupported token '${token}'. Supported: ${Object.keys(TOKEN_CONFIG).join(", ")}`);

  const cadence = buildTransferCadence(cfg);
  const args = (arg, t) => [arg(formatUFix64(amount), t.UFix64), arg(recipient, t.Address)];
  const authz = fcl.currentUser().authorization;

  return fcl.mutate({
    cadence,
    args,
    proposer: authz,
    payer: authz,
    authorizations: [authz],
    limit,
  });
}

function simplifyFlowError(e) {
  const msg = String(e?.message || e);
  if (msg.includes("FungibleToken.Vault.withdraw: Cannot withdraw tokens")) {
    return "Insufficient balance to complete the transfer.";
  }
  if (msg.toLowerCase().includes("missing receiver capability")) {
    return "Recipient wallet is not set up to receive this token.";
  }
  return msg;
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
  const [countdown, setCountdown] = useState('');

  const [showModal, setShowModal] = useState(false);
  const [modalStats, setModalStats] = useState(null);

  const COMMUNITY_WALLET = "0x2459710b1d10aed0";

  const [usernames, setUsernames] = useState([]);

  // ✅ Linked TS username (optional now)
  const [linkedUsername, setLinkedUsername] = useState(null);
  const [linkChecked, setLinkChecked] = useState(false);

  // Autocomplete visibility
  const [showSuggestions, setShowSuggestions] = useState(false);

  useEffect(() => {
    fetch("https://mvponflow.cc/api/fastbreak_racing_usernames")
      .then((res) => res.json())
      .then((data) => setUsernames(data))
      .catch((err) => console.error("Failed to fetch usernames", err));
  }, []);

  useEffect(() => {
    fcl.currentUser().subscribe(async (cu) => {
      setUser(cu);
      if (cu?.addr) {
        await fetchLinkedUsername(cu.addr);
      } else {
        setLinkedUsername(null);
        setLinkChecked(false);
      }
    });
    fetchContests();
  }, []);

  useEffect(() => {
    if (selectedContest) {
      fetchLeaderboard(selectedContest.id, user.addr);
    }
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
        setCountdown('Contest has started!');
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
      setContests(data);
      if (data.length > 0) setSelectedContest(data[0]);
    } catch (err) {
      console.error("Failed to load contests", err);
    }
  };

  const fetchLeaderboard = async (contestId, userWallet) => {
    const currentToken = ++leaderboardRequestToken;
    try {
      const res = await fetch(`https://mvponflow.cc/api/fastbreak/contest/${contestId}/prediction-leaderboard?userWallet=${userWallet}`);
      const data = await res.json();
      if (currentToken === leaderboardRequestToken) {
        setLeaderboardData(data);
      }
    } catch (err) {
      console.error("Failed to load leaderboard", err);
    }
  };

  const fetchLinkedUsername = async (walletAddr) => {
    try {
      const res = await fetch(`https://mvponflow.cc/api/linked_username/${walletAddr}`);
      const data = await res.json();
      if (data?.username) {
        setLinkedUsername(data.username);
      } else {
        setLinkedUsername(null);
      }
    } catch (err) {
      console.error("Failed to check linked username", err);
      setLinkedUsername(null);
    } finally {
      setLinkChecked(true);
    }
  };

  const handleContestChange = (e) => {
    const selectedId = parseInt(e.target.value);
    const contest = contests.find(c => c.id === selectedId);
    setSelectedContest(contest);
    setLeaderboardData(null);
  };

  const handleBuyIn = async () => {
    if (!user.loggedIn) {
      setTxStatus("❗ Please connect your wallet first.");
      return;
    }

    // 🔓 Account linking is OPTIONAL now — no blocking check here.

    if (!selectedContest) {
      setTxStatus("❗ Please select a contest.");
      return;
    }

    if (!topshotUsername.trim()) {
      setTxStatus("❗ Please enter your TopShot username prediction.");
      return;
    }

    const tokenKey = normalizeTokenLabel(selectedContest.buy_in_currency);
    if (!tokenKey) {
      setTxStatus(`❗ Unsupported token/currency: ${selectedContest.buy_in_currency}`);
      return;
    }

    try {
      setProcessing(true);
      setTxStatus("Waiting for wallet approval...");

      const transactionId = await sendToken({
        token: tokenKey,
        amount: selectedContest.buy_in_amount,
        recipient: COMMUNITY_WALLET,
      });

      setTxStatus(`✅ Transaction submitted! TX ID: <a href="https://flowscan.io/tx/${transactionId}" target="_blank" rel="noopener noreferrer">${transactionId}</a>`);
      await fcl.tx(transactionId).onceSealed();

      setTxStatus(`✅ Transaction sealed! Registering your entry...`);
      await fetch(`https://mvponflow.cc/api/fastbreak/contest/${selectedContest.id}/entries`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topshotUsernamePrediction: topshotUsername,
          userWalletAddress: user.addr
        })
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

      const lineupRes = await fetch(
        `https://mvponflow.cc/api/has_lineup?username=${username}&fastbreak_id=${selectedContest.fastbreak_id}`
      );
      const { hasLineup } = await lineupRes.json();

      setModalStats({
        ...statsData,
        hasLineup
      });
      setShowModal(true);
    } catch (err) {
      console.error("Failed to fetch stats:", err);
      alert("Failed to load stats. Please try again.");
    }
  };

  const handleCheckStats = () => {
    openStatsModal(topshotUsername.trim());
  };

  return (
    <div className="container">
      <div className="card shadow mb-4">
        <div className="card-body">
          <h2 className="mb-4 text-center">Fastbreak Horse Race</h2>
          <p>🏇 Pick your champion - a Top Shot user you think will finish highest in the selected Fastbreak daily game. Rules are simple:</p>
          <ul className="text-start ps-4">
            <li>Submit before lock by choosing a TS user and sending the buy-in</li>
            <li>90% to the winner (split pot in case of a tie)</li>
            <li>5% to the actual top horse (TS user selected by the winner)</li>
            <li>Maximum entries per wallet: Unlimited</li>
          </ul>
          {user.loggedIn && (
            <>
              <p className="text-info text-center">
                <strong>Wallet:</strong> {user.addr}{" "}
                {linkedUsername ? (
                  <> | <strong>Linked TS Username:</strong> {linkedUsername}</>
                ) : (
                  linkChecked && (
                    <> | <span style={{ color: 'orange' }}>Optional: link your TS username for richer stats</span></>
                  )
                )}
              </p>
              {/* 🔔 Optional nudge only; no blocking */}
              {!linkedUsername && linkChecked && (
                <p className="text-muted text-center" style={{ fontSize: '0.95rem' }}>
                  Linking helps us show wallet ↔ username info, but it’s not required.{" "}
                  <a href="https://support.meetdapper.com/hc/en-us/articles/20744347884819-Account-Linking-and-FAQ" target="_blank" rel="noopener noreferrer">
                    Learn more
                  </a>
                </p>
              )}
            </>
          )}

          <div className="mb-3">
            <label>Select Contest</label>
            <select className="form-select" onChange={handleContestChange} value={selectedContest?.id || ''}>
              {contests.map(contest => (
                <option key={contest.id} value={contest.id}>
                  {contest.display_name || contest.fastbreak_id} — {contest.buy_in_amount} {formatCurrencyLabel(contest.buy_in_currency)}
                </option>
              ))}
            </select>
          </div>

          {/* Username input + autocomplete */}
          <div className="mb-3 position-relative">
            <label>
              TopShot Username prediction (Need help choosing?{" "}
              <span
                onClick={() => (window.location.href = "/horsestats")}
                style={{
                  color: "#FDB927",
                  fontWeight: "bold",
                  textDecoration: "underline",
                  cursor: "pointer",
                }}
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
                // keep suggestions visible whenever there is text (even on exact match)
                setShowSuggestions(next.trim().length > 0);
              }}
              onFocus={() => {
                if (topshotUsername.trim().length > 0) setShowSuggestions(true);
              }}
              onKeyDown={(e) => {
                if (e.key === "Escape" || e.key === "Enter") {
                  setShowSuggestions(false);
                }
              }}
              onBlur={() => {
                // allow click on an item to register before hiding
                setTimeout(() => setShowSuggestions(false), 120);
              }}
              placeholder="Enter TopShot username of someone you predict does well"
              autoComplete="off"
            />

            {showSuggestions && topshotUsername && (
              <ul
                className="list-group position-absolute w-100"
                style={{ zIndex: 1000 }}
                role="listbox"
              >
                {usernames
                  .filter((u) =>
                    u.toLowerCase().includes(topshotUsername.toLowerCase())
                  )
                  .slice(0, 5)
                  .map((u, idx) => (
                    <li
                      key={idx}
                      className="list-group-item list-group-item-action"
                      style={{
                        backgroundColor: "#1C2A3A",
                        color: "#FDB927",
                        cursor: "pointer",
                      }}
                      onMouseDown={(e) => {
                        // use onMouseDown so blur doesn’t fire first
                        e.preventDefault();
                        setTopshotUsername(u);
                        setShowSuggestions(false);
                      }}
                      role="option"
                      aria-selected={u.toLowerCase() === topshotUsername.toLowerCase()}
                    >
                      {u}
                    </li>
                  ))}
                {usernames.filter((u) =>
                  u.toLowerCase().includes(topshotUsername.toLowerCase())
                ).length === 0 && (
                  <li
                    className="list-group-item"
                    style={{ backgroundColor: "#1C2A3A", color: "#ADB5BD" }}
                  >
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
              onClick={handleCheckStats}
            >
              📊 Check Their Stats
            </button>
            <button
              className="btn btn-primary flex-fill"
              onClick={handleBuyIn}
              // 🔓 No longer disabled due to missing linkedUsername
              disabled={!user.loggedIn || processing || leaderboardData?.status === "STARTED"}
            >
              {processing
                ? "Processing..."
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

      {/* Modal */}
      {showModal && modalStats && (
        <div className="modal show d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(0, 0, 0, 0.6)' }}>
          <div className="modal-dialog modal-dialog-centered modal-lg">
            <div className="modal-content" style={{ backgroundColor: '#1C2A3A', color: '#E5E7EB', border: '1px solid #273549' }}>
              <div className="modal-header border-bottom-0">
                <h5 className="modal-title" style={{ color: '#FDB927' }}>
                  📊 Stats for {modalStats.username} for the last 15 classic daily games
                </h5>
                <button type="button" className="btn-close" style={{ filter: 'invert(90%)' }} onClick={() => setShowModal(false)} />
              </div>
              <div className="modal-body">
                <div className="d-flex flex-wrap justify-content-around text-center mb-3">
                  <div><strong style={{ color: '#FDB927' }}>Flow Wallet Address:</strong> {modalStats.flow_wallet || "Account linking not enabled"}</div>
                </div>
                <div className="d-flex flex-wrap justify-content-around text-center mb-3">
                  <div><strong style={{ color: '#FDB927' }}>Best:</strong> {modalStats.best}</div>
                  <div><strong style={{ color: '#FDB927' }}>Mean:</strong> {modalStats.mean}</div>
                  <div><strong style={{ color: '#FDB927' }}>Median:</strong> {modalStats.median}</div>
                  <div><strong style={{ color: '#FDB927' }}>Lineup:</strong> {modalStats.hasLineup ? "✅" : "❌"}</div>
                </div>
                <div>
                  <strong style={{ color: '#FDB927' }}>Recent Ranks:</strong>
                  <p className="mt-2 text-muted">{modalStats.rankings.map(r => r.rank).join(', ')}</p>
                </div>
              </div>
              <div className="modal-footer border-top-0">
                <button className="btn btn-outline-light" onClick={() => setShowModal(false)}>Close</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Leaderboard Section */}
      {leaderboardData && (
        <div className="card shadow mb-4">
          <div className="card-body">
            <h4 className="mb-3 text-center">📋 Contest Info</h4>
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
                    <em>
                      Winner gets {winnerShare} {currency},&nbsp;
                      Selected user earns {pickedShare} {currency}
                    </em>
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
                        <tr
                          key={`${entry.wallet}-${entry.prediction}`}
                          className={entry.isUser ? "mvp-user-row" : ""}
                        >
                          <td>{entry.position}</td>
                          <td>{entry.wallet}</td>
                          <td
                            href="#"
                            className="leaderboard-link"
                            onClick={() => openStatsModal(entry.prediction)}
                          >
                            {entry.prediction}
                          </td>
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
