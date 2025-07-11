import React, { useState, useEffect } from 'react';
import * as fcl from "@onflow/fcl";

export default function Fastbreak() {
  const [user, setUser] = useState({ loggedIn: null });
  const [txStatus, setTxStatus] = useState('');
  const [processing, setProcessing] = useState(false);

  const [contests, setContests] = useState([]);
  const [selectedContest, setSelectedContest] = useState(null);
  const [topshotUsername, setTopshotUsername] = useState('');

  const COMMUNITY_WALLET = "0x2459710b1d10aed0";  // change as needed

  useEffect(() => {
    fcl.currentUser().subscribe(setUser);
    fetchContests();
  }, []);

  const fetchContests = async () => {
    try {
      const res = await fetch("/api/fastbreak/contests");
      const data = await res.json();
      setContests(data);
      if (data.length > 0) setSelectedContest(data[0]);
    } catch (err) {
      console.error("Failed to load contests", err);
    }
  };

  const handleContestChange = (e) => {
    const selectedId = parseInt(e.target.value);
    const contest = contests.find(c => c.id === selectedId);
    setSelectedContest(contest);
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
          arg(String(selectedContest.buy_in_amount), t.UFix64),
          arg(COMMUNITY_WALLET, t.Address)
        ],
        proposer: fcl.currentUser().authorization,
        payer: fcl.currentUser().authorization,
        authorizations: [fcl.currentUser().authorization],
        limit: 100
      });

      setTxStatus(`✅ Transaction submitted! ID: ${transactionId}`);

      // Wait for seal
      await fcl.tx(transactionId).onceSealed();
      setTxStatus('✅ Transaction Sealed! Registering your entry...');

      // Register in DB
      await fetch(`/api/fastbreak/contest/${selectedContest.id}/entries`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topshotUsernamePrediction: topshotUsername,
          userWalletAddress: user.addr
        })
      });

      setTxStatus('✅ Entry submitted! Thank you for joining.');
      setProcessing(false);
      setTopshotUsername('');

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
        <h2 className="mb-4 text-center">Fastbreak Contest Buy-In</h2>

        {user.loggedIn ? (
          <>
            <p className="text-muted text-center">Connected as: <strong>{user.addr}</strong></p>

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
                placeholder="Enter Topshot username of your champion"
              />
            </div>

            <button
              className="btn btn-primary btn-lg w-100"
              onClick={handleBuyIn}
              disabled={processing}
            >
              {processing ? "Processing..." : `Buy In for ${selectedContest?.buy_in_amount || ''} ${selectedContest?.buy_in_currency || ''}`}
            </button>
          </>
        ) : (
          <p className="text-muted text-center">Please connect your wallet using the top-right button.</p>
        )}

        {txStatus && (
          <div className="mt-3 text-center">
            <p>{txStatus}</p>
          </div>
        )}
      </div>
    </div>

    {/* Contest Info Card */}
    <div className="card shadow mb-4">
      <div className="card-body">
        <h3 className="card-title mb-3 text-center">Fastbreak horse race</h3>
        <p className="mt-3 text-center">
          Pick the top-ranked NBA Top Shot user in the NBA Fastbreak. Buy in, submit your pick before lock, and if your horse is the fastest, i.e. ranks better than everyone else's pick, you win the pot!
        </p>
      </div>
    </div>

  </div>
);
}
