import React, { useEffect, useState } from 'react';

export default function Swapfest() {
  const [prizePool, setPrizePool] = useState(0);
  const [leaderboard, setLeaderboard] = useState([]);

  useEffect(() => {
    fetch('https://pjh-gzerbpd3gecjhab5.westus-01.azurewebsites.net/api/leaderboard')
      .then(res => res.json())
      .then(data => {
        setPrizePool(data.prize_pool);
        setLeaderboard(data.leaderboard);
      });
  }, []);

  return (
    <div className="container">
      <div className="card shadow mb-4">
        <div className="card-body">
          <h2 className="mb-4 text-center">🏀 $MVP Swap Fest July 1st - 11th 🏆</h2>

          <div className="text-center mb-4">
            <img
              src="/images/1-11-07-25.png"
              alt="Swap Fest Rules"
              className="img-fluid rounded shadow"
            />
          </div>

          <p className="text-center mb-3">
            Prize Pool: {prizePool} points
          </p>

          <div className="table-responsive">
            <table className="mvp-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>TopShot Username</th>
                  <th>Points</th>
                  <th>Prize</th>
                </tr>
              </thead>
              <tbody>
                {leaderboard.map((entry, index) => (
                  <tr key={index}>
                    <td>{index + 1}</td>
                    <td>{entry.username}</td>
                    <td>{entry.points}</td>
                    <td>{entry.prize}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
