import React, { useState, useRef } from 'react';

export default function Vote() {
  const [hasVoted, setHasVoted] = useState(false);
  const embiidRef = useRef(null);
  const sgaRef = useRef(null);

  // When user votes for Jokic
  const handleJokicVote = () => {
    setHasVoted(true);
  };

  // Make Embiid/SGA buttons dodge
  const dodge = (btnRef) => {
    const offsetX = Math.floor(Math.random() * 200) - 100;
    const offsetY = Math.floor(Math.random() * 200) - 100;
    btnRef.current.style.transform = `translate(${offsetX}px, ${offsetY}px)`;
  };

  return (
    <div className="container">
      <div className="card shadow mb-4">
        <div className="card-body text-center">
          <h2 className="mb-4">
            Who is the only real $MVP of the past 5 seasons in the NBA?
          </h2>
          <p className="text-muted mb-4">
            Result of this vote will decide which player's moments the project will collect in the following period.
          </p>

          {!hasVoted ? (
            <div id="vote-section">
              <button
                className="btn btn-success btn-lg mb-3"
                onClick={handleJokicVote}
              >
                Jokić
              </button>
              <button
                ref={embiidRef}
                className="btn btn-outline-secondary btn-lg mb-3"
                onMouseEnter={() => dodge(embiidRef)}
              >
                Embiid
              </button>
              <button
                ref={sgaRef}
                className="btn btn-outline-secondary btn-lg mb-3"
                onMouseEnter={() => dodge(sgaRef)}
              >
                SGA
              </button>
            </div>
          ) : (
            <div id="result-section" className="mt-4">
              <h3 className="mb-3">🏆 Voting Results:</h3>
              <div className="list-group w-50 mx-auto">
                <div className="list-group-item d-flex justify-content-between">
                  <span>Jokić</span><span>100%</span>
                </div>
                <div className="list-group-item d-flex justify-content-between">
                  <span>Embiid</span><span>0%</span>
                </div>
                <div className="list-group-item d-flex justify-content-between">
                  <span>SGA</span><span>0%</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
