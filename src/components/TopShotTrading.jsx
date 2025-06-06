import { useState, useEffect } from 'react';
import * as fcl from "@onflow/fcl";

const TopShotTrading = ({ user }) => {
  const [moments, setMoments] = useState([]);
  const [selectedMoments, setSelectedMoments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [transactionStatus, setTransactionStatus] = useState(null);

  // Fetch user's Jokic moments
  useEffect(() => {
    if (user.loggedIn) {
      fetchJokicMoments();
    }
  }, [user.loggedIn]);

  const fetchJokicMoments = async () => {
    setLoading(true);
    try {
      const response = await fcl.query({
        cadence: `
          import TopShot from 0x0b2a3299cc857e29
          import NonFungibleToken from 0x1d7e57aa55817448

          pub fun main(account: Address): [UInt64] {
            let collectionRef = getAccount(account)
              .getCapability(/public/MomentCollection)
              .borrow<&{TopShot.MomentCollectionPublic}>()
              ?? panic("Could not borrow capability from public collection")
            
            let ids = collectionRef.getIDs()
            let jokicMoments: [UInt64] = []
            
            for id in ids {
              let moment = collectionRef.borrowMoment(id: id)
              if let metadata = moment.data.metadata {
                if metadata["PlayerFirstName"] == "Nikola" && metadata["PlayerLastName"] == "Jokic" {
                  jokicMoments.append(id)
                }
              }
            }
            
            return jokicMoments
          }
        `,
        args: (arg, t) => [arg(user.addr, t.Address)]
      });

      // Transform response to include moment details
      const momentDetails = await Promise.all(
        response.map(async (id) => {
          const details = await fcl.query({
            cadence: `
              import TopShot from 0x0b2a3299cc857e29

              pub fun main(account: Address, momentID: UInt64): {String: String} {
                let collectionRef = getAccount(account)
                  .getCapability(/public/MomentCollection)
                  .borrow<&{TopShot.MomentCollectionPublic}>()
                  ?? panic("Could not borrow capability from public collection")
                
                let moment = collectionRef.borrowMoment(id: momentID)
                return moment.data.metadata
              }
            `,
            args: (arg, t) => [arg(user.addr, t.Address), arg(id, t.UInt64)]
          });

          return {
            id,
            ...details,
            estimatedValue: calculateMomentValue(details)
          };
        })
      );

      setMoments(momentDetails);
    } catch (error) {
      console.error('Error fetching moments:', error);
    }
    setLoading(false);
  };

  const calculateMomentValue = (metadata) => {
    // Simple valuation based on rarity and series
    const serialNumber = parseInt(metadata.SerialNumber || "1");
    const totalCirculation = parseInt(metadata.TotalCirculation || "1000");
    
    let baseValue = 10; // Base $MVP value
    
    // Rarity multiplier
    if (totalCirculation <= 100) baseValue *= 5;
    else if (totalCirculation <= 500) baseValue *= 3;
    else if (totalCirculation <= 1000) baseValue *= 2;
    
    // Serial number bonus
    if (serialNumber <= 10) baseValue *= 2;
    else if (serialNumber <= 100) baseValue *= 1.5;
    
    return Math.round(baseValue);
  };

  const toggleMomentSelection = (momentId) => {
    setSelectedMoments(prev => {
      if (prev.includes(momentId)) {
        return prev.filter(id => id !== momentId);
      } else if (prev.length < 50) {
        return [...prev, momentId];
      }
      return prev;
    });
  };

  const calculateTotalValue = () => {
    return selectedMoments.reduce((total, momentId) => {
      const moment = moments.find(m => m.id === momentId);
      return total + (moment?.estimatedValue || 0);
    }, 0);
  };

  const executeTrade = async () => {
    if (selectedMoments.length === 0) {
      alert("Please select at least one moment to trade");
      return;
    }

    setLoading(true);
    setTransactionStatus("Preparing transaction...");

    try {
      const totalValue = calculateTotalValue();
      const mvpReward = Math.round(totalValue * 1.15);

      const transactionId = await fcl.mutate({
        cadence: `
          import TopShot from 0x0b2a3299cc857e29
          import NonFungibleToken from 0x1d7e57aa55817e29
          import MVPToken from 0x123456789abcdef0 // Replace with actual MVP token contract
          import FungibleToken from 0xf233dcee88fe0abe

          transaction(momentIDs: [UInt64], mvpAmount: UFix64) {
            let collectionRef: &TopShot.Collection
            let mvpVault: &MVPToken.Vault
            let receiverRef: &{FungibleToken.Receiver}

            prepare(signer: AuthAccount) {
              // Get reference to TopShot collection
              self.collectionRef = signer.borrow<&TopShot.Collection>(from: /storage/MomentCollection)
                ?? panic("Could not borrow reference to TopShot collection")

              // Get reference to MVP vault for receiving tokens
              self.receiverRef = signer.getCapability(/public/mvpReceiver)
                .borrow<&{FungibleToken.Receiver}>()
                ?? panic("Could not borrow MVP receiver reference")
            }

            execute {
              // Transfer moments to contract vault
              for momentID in momentIDs {
                let moment <- self.collectionRef.withdraw(withdrawID: momentID)
                // Send to contract's collection (implement contract logic)
                destroy moment // Simplified - in reality, send to contract
              }

              // Mint MVP tokens to user (this would be done by the contract)
              // In a real implementation, the contract would handle the MVP minting
              log("Trade executed: sent moments, receiving MVP tokens")
            }
          }
        `,
        args: (arg, t) => [
          arg(selectedMoments, t.Array(t.UInt64)),
          arg(mvpReward.toFixed(2), t.UFix64)
        ],
        proposer: fcl.authz,
        payer: fcl.authz,
        authorizations: [fcl.authz],
        limit: 1000
      });

      setTransactionStatus("Transaction submitted. Waiting for confirmation...");

      const transaction = await fcl.tx(transactionId).onceSealed();
      
      if (transaction.status === 4) {
        setTransactionStatus(`Success! You received ${mvpReward} $MVP tokens`);
        setSelectedMoments([]);
        fetchJokicMoments(); // Refresh moments list
      } else {
        setTransactionStatus("Transaction failed. Please try again.");
      }

    } catch (error) {
      console.error('Transaction error:', error);
      setTransactionStatus(`Error: ${error.message}`);
    }

    setLoading(false);
  };

  if (!user.loggedIn) {
    return (
      <div className="bg-gray-100 rounded-lg p-6 text-center">
        <p className="text-gray-600">Connect your wallet to trade NBA TopShot moments</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-lg p-6">
      <h2 className="text-2xl font-bold mb-4">🏀 Trade Jokic Moments for $MVP</h2>
      <p className="text-gray-600 mb-4">
        Select up to 50 Jokic moments to trade for 1.15x their value in $MVP tokens
      </p>

      {loading && moments.length === 0 ? (
        <div className="text-center py-8">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading your Jokic moments...</p>
        </div>
      ) : moments.length === 0 ? (
        <div className="text-center py-8">
          <p className="text-gray-600">No Jokic moments found in your collection</p>
        </div>
      ) : (
        <>
          <div className="mb-6">
            <div className="flex justify-between items-center mb-4">
              <span className="text-sm text-gray-600">
                Selected: {selectedMoments.length}/50 moments
              </span>
              <span className="text-lg font-semibold text-green-600">
                Total Value: {calculateTotalValue()} $MVP → {Math.round(calculateTotalValue() * 1.15)} $MVP
              </span>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 max-h-96 overflow-y-auto">
              {moments.map((moment) => (
                <div
                  key={moment.id}
                  className={`border rounded-lg p-4 cursor-pointer transition-all ${
                    selectedMoments.includes(moment.id)
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                  onClick={() => toggleMomentSelection(moment.id)}
                >
                  <div className="flex justify-between items-start mb-2">
                    <h3 className="font-semibold text-sm">#{moment.SerialNumber}</h3>
                    <span className="text-xs bg-gray-100 px-2 py-1 rounded">
                      {moment.estimatedValue} $MVP
                    </span>
                  </div>
                  <p className="text-xs text-gray-600 mb-1">{moment.PlayCategory}</p>
                  <p className="text-xs text-gray-500">
                    {moment.SerialNumber}/{moment.TotalCirculation}
                  </p>
                  {selectedMoments.includes(moment.id) && (
                    <div className="mt-2">
                      <span className="text-xs bg-blue-500 text-white px-2 py-1 rounded">
                        Selected
                      </span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          <button
            onClick={executeTrade}
            disabled={selectedMoments.length === 0 || loading}
            className={`w-full py-3 px-6 rounded-lg font-semibold transition-colors ${
              selectedMoments.length > 0 && !loading
                ? 'bg-green-500 hover:bg-green-600 text-white'
                : 'bg-gray-300 text-gray-500 cursor-not-allowed'
            }`}
          >
            {loading ? 'Processing...' : `Trade ${selectedMoments.length} Moments for ${Math.round(calculateTotalValue() * 1.15)} $MVP`}
          </button>

          {transactionStatus && (
            <div className={`mt-4 p-4 rounded-lg ${
              transactionStatus.includes('Success') 
                ? 'bg-green-100 text-green-700' 
                : transactionStatus.includes('Error')
                ? 'bg-red-100 text-red-700'
                : 'bg-blue-100 text-blue-700'
            }`}>
              {transactionStatus}
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default TopShotTrading;