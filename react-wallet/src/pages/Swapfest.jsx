import React from 'react';

export default function Swapfest() {
  // Fake data for now
  const prizePool = 5000;

  const leaderboard = [
    { username: "JokicFan1", points: 1200, prize: "300 MVP" },
    { username: "HorseWhisperer", points: 900, prize: "200 MVP" },
    { username: "SerbiaStrong", points: 750, prize: "100 MVP" },
  ];

  return (
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

        <p className="text-center text-muted mb-3">
          Prize Pool: {prizePool} points
        </p>

        <div className="table-responsive">
          <table className="table table-striped table-bordered table-hover">
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
  );
}
