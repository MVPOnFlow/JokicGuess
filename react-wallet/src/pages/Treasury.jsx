import React, { useEffect, useState } from 'react';

export default function Treasury() {
  const [treasury, setTreasury] = useState(null);

  useEffect(() => {
    fetch('mvponflow.cc/api/treasury')
      .then(res => res.json())
      .then(data => setTreasury(data));
  }, []);

  if (!treasury) {
    return <div className="container"><p>Loading...</p></div>;
  }

  return (
    <div className="container">
      <div className="card shadow mb-4">
        <div className="card-body">
          <h2 className="mb-3 text-center">🏦 $MVP Treasury Overview</h2>
          <p className="text-center mb-2">
            See the current state of the treasury and the $MVP token economy.
          </p>
          <p className="text-center mb-4">
            Last Updated: {treasury.last_updated}
          </p>

          <div className="row">
            <div className="col-md-6 mb-3">
              <div className="card treasury-card h-100">
                <div className="card-body">
                  <h5 className="fw-bold mb-3">🔢 Tokens in the Wild</h5>
                  <p className="display-6">{treasury.tokens_in_wild}</p>
                  <p>
                    Total $MVP tokens released into circulation, not owned by the treasury.
                  </p>
                </div>
              </div>
            </div>

            <div className="col-md-6 mb-3">
              <div className="card treasury-card h-100">
                <div className="card-body">
                  <h5 className="fw-bold mb-3">📦 Treasury Holdings</h5>
                  <ul className="list-group list-group-flush">
                    <li className="list-group-item">Common Moments: <strong>{treasury.common_count}</strong></li>
                    <li className="list-group-item">Rare Moments: <strong>{treasury.rare_count}</strong></li>
                    <li className="list-group-item">Top Shot Debut: <strong>{treasury.tsd_count}</strong></li>
                    <li className="list-group-item">Legendary Moments: <strong>{treasury.lego_count}</strong></li>
                  </ul>
                </div>
              </div>
            </div>

            <div className="col-md-6 mb-3">
              <div className="card treasury-card h-100">
                <div className="card-body">
                  <h5 className="fw-bold mb-3">💰 Backed Supply</h5>
                  <p className="display-6">{treasury.backed_supply}</p>
                  <p>
                    Calculated as:<br />
                    2x Common + 100x Rare + 500x TSD + 2000x Legendary
                  </p>
                </div>
              </div>
            </div>

            <div className="col-md-6 mb-3">
              <div className="card treasury-card h-100">
                <div className="card-body">
                  <h5 className="fw-bold mb-3">✨ Treasury Surplus</h5>
                  <p className="display-6">{treasury.surplus}</p>
                  <p>
                    Backed Supply minus Tokens in the Wild.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
