import React, { useState, useEffect } from 'react';
import * as fcl from "@onflow/fcl";

let leaderboardRequestToken = 0;

export default function Fastbreak() {
  const [user, setUser] = useState({ loggedIn: null });
  const [txStatus, setTxStatus] = useState('');
  const [processing, setProcessing] = useState(false);

  const [contests, setContests] = useState([]);
  const [selectedContest, setSelectedContest] = useState(null);
  const [topshotUsername, setTopshotUsername] = useState('');

  const [leaderboardData, setLeaderboardData] = useState(null);
  const [countdown, setCountdown] = useState('');

  // Modal state
  const [showModal, setShowModal] = useState(false);
  const [modalStats, setModalStats] = useState(null);

  const COMMUNITY_WALLET = "0x2459710b1d10aed0";

  useEffect(() => {
    fcl.currentUser().subscribe(setUser);
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

  const handleContestChange = (e) => {
    const selectedId = parseInt(e.target.value);
    const contest = contests.find(c => c.id === selectedId);
    setSelectedContest(contest);
    setLeaderboardData(null);
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
      setTxStatus("❗ Please enter your TopShot username prediction.");
      return;
    }

    try {
      setProcessing(true);
      setTxStatus("Waiting for wallet approval...");

      const transactionId = await fcl.mutate({
        cadence: `import FungibleToken from 0xf233dcee88fe0abe
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
}`,
        args: (arg, t) => [
          arg(formatUFix64(selectedContest.buy_in_amount), t.UFix64),
          arg(COMMUNITY_WALLET, t.Address)
        ],
        proposer: fcl.currentUser().authorization,
        payer: fcl.currentUser().authorization,
        authorizations: [fcl.currentUser().authorization],
        limit: 9999
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

      const msg = error.message || "";
      const amount = selectedContest?.buy_in_amount || "N/A";
      const token = selectedContest?.buy_in_currency || "$MVP";

      if (msg.includes("Cannot withdraw tokens") && msg.includes("greater than the balance")) {
        setTxStatus(`❗ Error: You need at least ${amount} ${token} in your wallet to buy in.`);
      } else {
        setTxStatus(`❗ Error: ${msg}`);
      }
    }
  };

  const handleCheckStats = async () => {
    if (!topshotUsername.trim() || !selectedContest) return;
    try {
      const statsRes = await fetch(`https://mvponflow.cc/api/fastbreak_racing_stats/${topshotUsername}`);
      const statsData = await statsRes.json();

      const lineupRes = await fetch(`https://mvponflow.cc/api/has_lineup?username=${topshotUsername}&fastbreak_id=${selectedContest.fastbreak_id}`);
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

  return (
    <div className="container">
      <div className="card shadow mb-4">
        <div className="card-body">
          <h2 className="mb-4 text-center">Fastbreak Horse Race</h2>
          <p>
            🏇 Welcome to the Fastbreak Horse Race!
            Pick your champion, a Top Shot user you think will finish highest in the next Fastbreak.
          </p>
          <div className="mb-4 px-2">
            <ul className="text-start ps-3">
              <li>Pick a Top Shot user ("horse") before the contest locks.</li>
              <li>If your horse finishes better than everyone else’s, you win!</li>
              <li><strong>90%</strong> of the pot goes to the winning picker.</li>
              <li><strong>5%</strong> goes to the horse who actually performed!</li>
              <li>Remaining 5% goes to the Treasury.</li>
            </ul>
          </div>

          {user.loggedIn && (
            <p className="text-info text-center">
              Connected as: <strong>{user.addr}</strong>
            </p>
          )}

          {countdown && (
            <p className="text-warning text-center mb-2">
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
          <div className="d-flex flex-column flex-md-row gap-3 mt-3 justify-content-center">
            <button
              className="btn btn-outline-light flex-fill"
              style={{
                backgroundColor: '#0E2240',
                color: '#FDB927',
                border: '1px solid #FDB927',
                fontWeight: '600'
              }}
              disabled={!topshotUsername.trim()}
              onClick={handleCheckStats}
            >
              📊 Check Stats
            </button>
            <button
              className="btn btn-primary flex-fill"
              onClick={handleBuyIn}
              disabled={!user.loggedIn || processing || leaderboardData?.status === "STARTED"}
            >
              {processing
                ? "Processing..."
                : `Buy In for ${selectedContest?.buy_in_amount || ''} ${selectedContest?.buy_in_currency || ''}`}
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
                  📊 Stats for {modalStats.username} in the last 15
                </h5>
                <button type="button" className="btn-close" style={{ filter: 'invert(90%)' }} onClick={() => setShowModal(false)} />
              </div>
              <div className="modal-body">
                <div className="d-flex flex-wrap justify-content-around text-center mb-3">
                  <div><strong style={{ color: '#FDB927' }}>Best:</strong> {modalStats.best}</div>
                  <div><strong style={{ color: '#FDB927' }}>Mean:</strong> {modalStats.mean}</div>
                  <div><strong style={{ color: '#FDB927' }}>Median:</strong> {modalStats.median}</div>
                  <div>
                    <strong style={{ color: '#FDB927' }}>Lineup Submitted:</strong> {modalStats.hasLineup ? "✅ Yes" : "❌ No"}
                  </div>
                </div>
                <div className="mt-3">
                  <strong style={{ color: '#FDB927' }}>Recent Ranks:</strong>
                  <p className="mt-2 text-muted" style={{ wordBreak: 'break-word' }}>
                    {modalStats.rankings.map(r => r.rank).join(', ')}
                  </p>
                </div>
              </div>
              <div className="modal-footer border-top-0">
                <button className="btn btn-outline-light" onClick={() => setShowModal(false)}>Close</button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
