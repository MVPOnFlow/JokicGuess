import { useState, useEffect } from 'react';
import * as fcl from "@onflow/fcl";
import axios from 'axios';
import TopShotTrading from './components/TopShotTrading';

// Configure FCL
fcl.config({
  "app.detail.title": "Horse Petting & TopShot Trading dApp",
  "app.detail.icon": "https://placekitten.com/g/200/200",
  "accessNode.api": "https://rest-mainnet.onflow.org",
  "discovery.wallet": "https://fcl-discovery.onflow.org/authn",
  "flow.network": "mainnet",
  "walletconnect.projectId": "2f5a2c1b8e4d3a9c7f1e6b8d4a2c9e7f"
});

function App() {
  const [user, setUser] = useState({ loggedIn: false });
  const [petResult, setPetResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('petting');

  useEffect(() => {
    fcl.currentUser.subscribe(setUser);
  }, []);

  const handlePet = async () => {
    if (!user.loggedIn) {
      alert("Please connect your Flow wallet first!");
      return;
    }

    setLoading(true);
    try {
      // Call your existing pet endpoint
      const response = await axios.post('/api/pet', {
        userId: user.addr // Flow wallet address as user ID
      });
      setPetResult(response.data);
    } catch (error) {
      console.error('Error petting horse:', error);
      setPetResult({ error: 'Failed to pet horse. Please try again.' });
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-purple-600 to-blue-600 p-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-xl p-6 mb-6">
          <h1 className="text-3xl font-bold text-center mb-6">🐎 Horse Petting & TopShot Trading dApp</h1>
          
          {user.loggedIn ? (
            <div className="text-center">
              <p className="text-gray-600 mb-4">Connected: {user.addr}</p>
              <button
                onClick={() => fcl.unauthenticate()}
                className="text-sm bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-full transition-colors"
              >
                Disconnect Wallet
              </button>
            </div>
          ) : (
            <div className="text-center">
              <button
                onClick={() => fcl.authenticate()}
                className="bg-blue-500 hover:bg-blue-600 text-white font-bold py-3 px-6 rounded-full transition-colors"
              >
                Connect Flow Wallet
              </button>
            </div>
          )}
        </div>

        {/* Navigation Tabs */}
        <div className="bg-white rounded-lg shadow-xl mb-6">
          <div className="flex border-b">
            <button
              onClick={() => setActiveTab('petting')}
              className={`flex-1 py-4 px-6 text-center font-semibold transition-colors ${
                activeTab === 'petting'
                  ? 'bg-blue-500 text-white'
                  : 'text-gray-600 hover:text-blue-500'
              }`}
            >
              🐎 Horse Petting
            </button>
            <button
              onClick={() => setActiveTab('trading')}
              className={`flex-1 py-4 px-6 text-center font-semibold transition-colors ${
                activeTab === 'trading'
                  ? 'bg-blue-500 text-white'
                  : 'text-gray-600 hover:text-blue-500'
              }`}
            >
              🏀 TopShot Trading
            </button>
          </div>

          <div className="p-6">
            {activeTab === 'petting' && (
              <div className="space-y-6">
                <div className="text-center">
                  <h2 className="text-2xl font-bold mb-4">Pet Your Horse for $MVP Rewards</h2>
                  <p className="text-gray-600 mb-6">
                    Connect your wallet and pet your horse to earn random $MVP rewards!
                  </p>
                </div>

                <button
                  onClick={handlePet}
                  disabled={!user.loggedIn || loading}
                  className={`w-full ${
                    user.loggedIn 
                      ? 'bg-green-500 hover:bg-green-600' 
                      : 'bg-gray-300 cursor-not-allowed'
                  } text-white font-bold py-4 px-6 rounded-full transition-colors`}
                >
                  {loading ? 'Petting...' : 'Pet Horse 🐎'}
                </button>

                {petResult && (
                  <div className={`text-center p-4 rounded-lg ${
                    petResult.error ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'
                  }`}>
                    {petResult.error || petResult.message}
                  </div>
                )}
              </div>
            )}

            {activeTab === 'trading' && (
              <TopShotTrading user={user} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;