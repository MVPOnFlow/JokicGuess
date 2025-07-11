import React, { useState, useEffect } from 'react';
import * as fcl from "@onflow/fcl";

export default function Fastbreak() {
  const [user, setUser] = useState({ loggedIn: null });
  const [txStatus, setTxStatus] = useState('');
  const [processing, setProcessing] = useState(false);

  // Community wallet address to receive tokens
  const COMMUNITY_WALLET = "0x2459710b1d10aed0";

  // Amount to send
  const AMOUNT = "0.01";

  useEffect(() => {
    fcl.currentUser().subscribe(setUser);
  }, []);

  const handleBuyIn = async () => {
    try {
      if (!user.loggedIn) {
        setTxStatus("❗ Please connect your wallet first.");
        return;
      }

      setProcessing(true);
      setTxStatus("Waiting for wallet approval...");

      // Send transaction
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
          arg(AMOUNT, t.UFix64),
          arg(COMMUNITY_WALLET, t.Address)
        ],
        proposer: fcl.currentUser().authorization,
        payer: fcl.currentUser().authorization,
        authorizations: [fcl.currentUser().authorization],
        limit: 100
      });

      setTxStatus(`✅ Transaction submitted! ID: ${transactionId}`);

      // Watch for sealing
      fcl.tx(transactionId).subscribe(res => {
        if (res.status === 4) {
          setProcessing(false);
          setTxStatus('✅ Transaction Sealed! Thank you for buying in.');
        }
      });
    } catch (error) {
      console.error(error);
      setProcessing(false);
      setTxStatus(`❗ Error: ${error.message}`);
    }
  };

  return (
    <div className="container">
      <div className="card shadow mb-4">
        <div className="card-body text-center">
          <h2 className="mb-4">Fastbreak Buy-In</h2>
          <p className="mb-3">
            Send 5 $MVP to join the community contest!
          </p>

          {user.loggedIn ? (
            <>
              <p className="text-muted mb-3">Connected as: <strong>{user.addr}</strong></p>
              <button
                className="btn btn-primary btn-lg"
                onClick={handleBuyIn}
                disabled={processing}
              >
                {processing ? "Processing..." : "Buy In for 5 $MVP"}
              </button>
            </>
          ) : (
            <p className="text-muted">Please connect your wallet using the top-right button.</p>
          )}

          {txStatus && (
            <div className="mt-3">
              <p>{txStatus}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
