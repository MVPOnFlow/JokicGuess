import React, { useEffect, useState } from "react";

export default function FastbreakStats() {
  const [leaderboard, setLeaderboard] = useState([]);
  const [page, setPage] = useState(1);
  const [perPage] = useState(25);
  const [totalUsers, setTotalUsers] = useState(0);

  const [showModal, setShowModal] = useState(false);
  const [modalStats, setModalStats] = useState(null);

  const [searchInput, setSearchInput] = useState("");

  useEffect(() => {
    fetchLeaderboard(page);
  }, [page]);

  const fetchLeaderboard = async (pageNum) => {
    try {
      const res = await fetch(
        `https://mvponflow.cc/api/fastbreak_racing_stats?page=${pageNum}&per_page=${perPage}`
      );
      const data = await res.json();
      setLeaderboard(data.leaderboard);
      setTotalUsers(data.total_users);
    } catch (err) {
      console.error("Failed to load leaderboard:", err);
    }
  };

  const handleUsernameClick = async (username) => {
    try {
      const res = await fetch(`https://mvponflow.cc/api/fastbreak_racing_stats/${username}`);
      const data = await res.json();
      setModalStats(data);
      setShowModal(true);
    } catch (err) {
      console.error("Failed to fetch user stats:", err);
      alert("Failed to load user stats");
    }
  };

  const handleSearch = async () => {
    if (!searchInput.trim()) return;
    handleUsernameClick(searchInput.trim());
  };

  const totalPages = Math.ceil(totalUsers / perPage);

  return (
    <div className="container mt-4">
      <h2 className="text-center mb-4" style={{ color: "#FDB927" }}>
        🏇 Fastbreak Stats (Last 15 Games)
      </h2>

      <div className="d-flex mb-3">
        <input
          type="text"
          className="form-control me-2"
          placeholder="Search username"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
        />
        <button className="btn btn-primary" onClick={handleSearch}>
          🔍 Search
        </button>
      </div>

      <div className="table-responsive">
        <table className="mvp-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Username</th>
              <th>Best</th>
              <th>Mean</th>
            </tr>
          </thead>
          <tbody>
            {leaderboard.map((user, idx) => (
              <tr key={user.username}>
                <td>{(page - 1) * perPage + idx + 1}</td>
                <td>
                  <button
                    className="btn btn-link p-0"
                    onClick={() => handleUsernameClick(user.username)}
                    style={{ color: "#FDB927", fontWeight: "600" }}
                  >
                    {user.username}
                  </button>
                </td>
                <td>{user.best}</td>
                <td>{user.mean}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="d-flex justify-content-center align-items-center mt-3 gap-2">
        <button
          className="btn btn-outline-light"
          onClick={() => setPage((p) => Math.max(1, p - 1))}
          disabled={page === 1}
        >
          ⬅ Prev
        </button>
        <span>
          Page {page} of {totalPages}
        </span>
        <button
          className="btn btn-outline-light"
          onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
          disabled={page === totalPages}
        >
          Next ➡
        </button>
      </div>

      {/* Modal */}
      {showModal && modalStats && (
        <div
          className="modal show d-block"
          tabIndex="-1"
          style={{ backgroundColor: "rgba(0, 0, 0, 0.6)" }}
        >
          <div className="modal-dialog modal-dialog-centered modal-lg">
            <div
              className="modal-content"
              style={{
                backgroundColor: "#1C2A3A",
                color: "#E5E7EB",
                border: "1px solid #273549",
              }}
            >
              <div className="modal-header border-bottom-0">
                <h5 className="modal-title" style={{ color: "#FDB927" }}>
                  📊 Stats for {modalStats.username}
                </h5>
                <button
                  type="button"
                  className="btn-close"
                  style={{ filter: "invert(90%)" }}
                  onClick={() => setShowModal(false)}
                />
              </div>
              <div className="modal-body">
                <div className="d-flex flex-wrap justify-content-around text-center mb-3">
                  <div>
                    <strong style={{ color: "#FDB927" }}>Best:</strong>{" "}
                    {modalStats.best}
                  </div>
                  <div>
                    <strong style={{ color: "#FDB927" }}>Mean:</strong>{" "}
                    {modalStats.mean}
                  </div>
                  <div>
                    <strong style={{ color: "#FDB927" }}>Median:</strong>{" "}
                    {modalStats.median}
                  </div>
                </div>
                <div className="mt-3">
                  <strong style={{ color: "#FDB927" }}>Recent Ranks:</strong>
                  <p
                    className="mt-2 text-muted"
                    style={{ wordBreak: "break-word" }}
                  >
                    {modalStats.rankings.map((r) => r.rank).join(", ")}
                  </p>
                </div>
              </div>
              <div className="modal-footer border-top-0">
                <button
                  className="btn btn-outline-light"
                  onClick={() => setShowModal(false)}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
