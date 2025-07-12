import React, { useState, useEffect } from 'react';
import * as fcl from "@onflow/fcl";

export default function Fastbreak() {
  const [user, setUser] = useState({ loggedIn: null });
  const [txStatus, setTxStatus] = useState('');
  const [processing, setProcessing] = useState(false);

  const [contests, setContests] = useState([]);
  const [selectedContest, setSelectedContest] = useState(null);
  const [topshotUsername, setTopshotUsername] = useState('');

  const [leaderboardData, setLeaderboardData] = useState(null);

  // ✅ Countdown state
  const [countdown, setCountdown] = useState('');

  const COMMUNITY_WALLET = "0x2459710b1d10aed0";  // Replace with your community wallet

  useEffect(() => {
    fcl.currentUser().subscribe(setUser);
    fetchContests();
  }, []);

  useEffect(() => {
    if (selectedContest && user.loggedIn) {
      fetchLeaderboard(selectedContest.id, user.addr);
    }
  }, [user, selectedContest]);

  // ✅ Countdown timer effect
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
      const res = await fetch("https://pjh-gzerbpd3gecjhab5.westus-01.azurewebsites.net/api/fastbreak/contests");
      const data = await res.json();
      setContests(data);
      if (data.length > 0) setSelectedContest(data[0]);
    } catch (err) {
      console.error("Failed to load contests", err);
    }
  };

  const fetchLeaderboard = async (contestId, userWallet) => {
    try {
      const res = await fetch(`https://pjh-gzerbpd3gecjhab5.westus-01.azurewebsites.net/api/fastbreak/contest/${contestId}/prediction-leaderboard?userWallet=${userWallet}`);
      const data = await res.json();
      setLeaderboardData(data);
    } catch (err) {
      console.error("Failed to load leaderboard", err);
    }
  };

  const handleContestChange = (e) => {
    const selectedId = parseInt(e.target.value);
    const contest = contests.find(c => c.id === selectedId);
    setSelectedContest(contest);
    setLeaderboardData(null);
    if (contest && user.loggedIn) {
      fetchLeaderboard(contest.id, user.addr);
    }
  };

  const formatUFix64 = (value) => {
    if (String(value).includes(".")) return String(value);
    return `${value}.0`;
  };

  const handleBuyIn = async () => {
    if (!user.loggedIn) {
      setTxStatus("❗ Please connect your wallet first.");
      return;
    }

    if (!selectedContest) {
      setTxStatus("❗ Please select a contest.");
      return;
    }

    if (!topshotUsername.trim()) {
      setTxStatus("❗ Please enter your TopShot username.");
      return;
    }

    try {
      setProcessing(true);
      setTxStatus("Waiting for wallet approval...");

      // Flow transaction
      const transactionId = await fcl.mutate({
        cadence: `
          import FungibleToken from 0xf233dcee88fe0abe
          import StorageRent from 0x707adbad1428c624
          import PetJokicsHorses from 0x6fd2465f3a22e34c

          transaction(amount: UFix64, recipient: Address) {
              let sentVault: @{FungibleToken.Vault}

              prepare(signer: auth(Storage, BorrowValue) &Account) {
                  let vaultRef = signer.storage.borrow<auth(FungibleToken.Withdraw) &PetJokicsHorses.Vault>(
                      from: /storage/PetJokicsHorsesVault
                  ) ?? panic("Could not borrow reference to the owner's Vault!")
                  self.sentVault <- vaultRef.withdraw(amount: amount)
              }

              execute {
                  let recipientAccount = getAccount(recipient)
                  let receiverRef = recipientAccount.capabilities.borrow<&{FungibleToken.Vault}>(
                      /public/PetJokicsHorsesReceiver
                  )!
                  receiverRef.deposit(from: <-self.sentVault)
                  StorageRent.tryRefill(recipient)
              }
          }
        `,
        args: (arg, t) => [
          arg(formatUFix64(selectedContest.buy_in_amount), t.UFix64),
          arg(COMMUNITY_WALLET, t.Address)
        ],
        proposer: fcl.currentUser().authorization,
        payer: fcl.currentUser().authorization,
        authorizations: [fcl.currentUser().authorization],
        limit: 9999
      });

      setTxStatus(
        `✅ Transaction submitted! TX ID: <a href="https://flowscan.io/tx/${transactionId}" target="_blank" rel="noopener noreferrer">${transactionId}</a>`
      );

      await fcl.tx(transactionId).onceSealed();

      setTxStatus(
        `✅ Transaction sealed on-chain! View TX: <a href="https://flowscan.io/tx/${transactionId}" target="_blank" rel="noopener noreferrer">${transactionId}</a><br/>Registering your entry...`
      );

      // Register in DB
      await fetch(`https://pjh-gzerbpd3gecjhab5.westus-01.azurewebsites.net/api/fastbreak/contest/${selectedContest.id}/entries`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topshotUsernamePrediction: topshotUsername,
          userWalletAddress: user.addr
        })
      });

      setTxStatus(
        `✅ Entry submitted! Thank you for joining.<br/>TX: <a href="https://flowscan.io/tx/${transactionId}" target="_blank" rel="noopener noreferrer">${transactionId}</a>`
      );
      setProcessing(false);
      setTopshotUsername('');

      // Refresh leaderboard
      fetchLeaderboard(selectedContest.id, user.addr);

    } catch (error) {
      console.error(error);
      setProcessing(false);
      setTxStatus(`❗ Error: ${error.message}`);
    }
  };

  return (
    <div className="container">

      {/* Buy-In Form Card */}
      <div className="card shadow mb-4">
        <div className="card-body">
          <h2 className="mb-4 text-center">Fastbreak Horse Race</h2>
          <p className="text-center mb-4">
            Pick the top-ranked NBA Top Shot user in the NBA Fastbreak. Buy in, submit your pick before lock, and if your horse is the fastest, i.e. ranks better than everyone else's pick, you win the pot!
          </p>

          {user.loggedIn ? (
            <>
              <p className="text-muted text-center">Connected as: <strong>{user.addr}</strong></p>

              {/* Countdown display */}
              {countdown && (
                <p className="text-center text-muted mb-2">
                  Contest starts in: <strong>{countdown}</strong>
                </p>
              )}

              <div className="mb-3">
                <label>Select Contest</label>
                <select className="form-select" onChange={handleContestChange} value={selectedContest?.id || ''}>
                  {contests.map(contest => (
                    <option key={contest.id} value={contest.id}>
                      {contest.display_name || contest.fastbreak_id}
                      {` (Buy-in: ${contest.buy_in_amount} ${contest.buy_in_currency})`}
                    </option>
                  ))}
                </select>
              </div>

              <div className="mb-3">
                <label>TopShot Username Prediction</label>
                <input
                  type="text"
                  className="form-control"
                  value={topshotUsername}
                  onChange={(e) => setTopshotUsername(e.target.value)}
                  placeholder="Enter TopShot username of your champion"
                />
              </div>

              <button
                className="btn btn-primary btn-lg w-100"
                onClick={handleBuyIn}
                disabled={processing || leaderboardData?.status === "STARTED"}
              >
                {processing ? "Processing..." : `Buy In for ${selectedContest?.buy_in_amount || ''} ${selectedContest?.buy_in_currency || ''}`}
              </button>
              {leaderboardData?.status === "STARTED" && (
                <p className="text-danger mt-2 text-center">
                  🚫 This contest is locked for new entries.
                </p>
              )}
            </>
          ) : (
            <p className="text-muted text-center">Please connect your wallet using the top-right button.</p>
          )}

          {txStatus && (
            <div className="mt-3 text-center">
              <p dangerouslySetInnerHTML={{ __html: txStatus }}></p>
            </div>
          )}
        </div>
      </div>

      {/* Leaderboard / Prediction Info */}
      {leaderboardData && (
        <div className="card shadow mb-4">
          <div className="card-body">

            <h4 className="mb-3 text-center">📋 Contest Info</h4>
            {countdown && (
              <p><strong>Contest locks in:</strong> {countdown}</p>
            )}
            <p><strong>Total entries:</strong> {leaderboardData.totalEntries}</p>
            <p><strong>Total pot:</strong> {leaderboardData.totalPot} $MVP</p>

            {leaderboardData.status === "STARTED" ? (
              <>
                <h4 className="mt-4 mb-3 text-center">🏆 Contest Leaderboard</h4>
                <div className="table-responsive">
                  <table className="table table-striped table-bordered">
                    <thead>
                      <tr>
                        <th>Rank</th>
                        <th>Wallet</th>
                        <th>Prediction</th>
                        <th>Fastbreak Rank</th>
                        <th>Lineup</th>
                      </tr>
                    </thead>
                    <tbody>
                      {leaderboardData.entries.map(entry => (
                        <tr
                          key={`${entry.wallet}-${entry.prediction}`}
                          className={entry.isUser ? "table-success" : ""}
                        >
                          <td>{entry.position}</td>
                          <td>{entry.wallet}</td>
                          <td>{entry.prediction}</td>
                          <td>{entry.rank}</td>
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
                      <table className="table table-striped table-bordered">
                        <thead>
                          <tr>
                            <th>Prediction</th>
                            <th>Fastbreak Rank</th>
                            <th>Lineup</th>
                          </tr>
                        </thead>
                        <tbody>
                          {leaderboardData.userEntries.map((entry, idx) => (
                            <tr key={idx}>
                              <td>{entry.prediction}</td>
                              <td>{entry.rank !== undefined ? entry.rank : "N/A"}</td>
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
