import React, { useState, useEffect, useCallback } from 'react';

/* ================================================================
   Swap Leaderboard (monthly) — shared component
   ================================================================ */
export default function SwapLeaderboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedMonth, setSelectedMonth] = useState('');

  const fetchLeaderboard = useCallback((month) => {
    setLoading(true);
    const qs = month ? `?month=${month}` : '';
    fetch(`/api/swap/leaderboard${qs}`)
      .then(r => r.json())
      .then(d => {
        setData(d);
        if (!selectedMonth && d.month) setSelectedMonth(d.month);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [selectedMonth]);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { fetchLeaderboard(selectedMonth); }, [selectedMonth]);

  const handleMonthChange = (e) => {
    setSelectedMonth(e.target.value);
  };

  const formatMonth = (m) => {
    const [y, mo] = m.split('-');
    const date = new Date(+y, +mo - 1);
    return date.toLocaleString('default', { month: 'long', year: 'numeric' });
  };

  const shortAddr = (addr) => addr ? `${addr.slice(0, 6)}…${addr.slice(-4)}` : '';

  const formatLastSwap = (epoch) => {
    if (!epoch) return '';
    const d = new Date(epoch * 1000);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
      + ' ' + d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  };

  return (
    <div className="swap-leaderboard-card">
      <div className="swap-lb-header">
        <h3>🏆 Monthly Swap Leaderboard</h3>
        {data?.availableMonths?.length > 0 && (
          <select
            className="swap-lb-month-select"
            value={selectedMonth}
            onChange={handleMonthChange}
          >
            {data.availableMonths.map(m => (
              <option key={m} value={m}>{formatMonth(m)}</option>
            ))}
          </select>
        )}
      </div>

      {loading ? (
        <div className="swap-lb-loading">Loading leaderboard…</div>
      ) : !data?.leaderboard?.length ? (
        <div className="swap-lb-empty">No swaps recorded {selectedMonth ? `for ${formatMonth(selectedMonth)}` : 'this month'}.</div>
      ) : (
        <div className="swap-lb-table-wrap">
          <table className="swap-lb-table">
            <thead>
              <tr>
                <th>#</th>
                <th>User</th>
                <th>Swaps</th>
                <th>$MVP Earned</th>
                <th>⭐ Points</th>
                <th>Last Swap</th>
              </tr>
            </thead>
            <tbody>
              {data.leaderboard.map((row) => (
                <tr key={row.address} className={row.rank <= 3 ? `swap-lb-top${row.rank}` : ''}>
                  <td className="swap-lb-rank">
                    {row.rank === 1 ? '🥇' : row.rank === 2 ? '🥈' : row.rank === 3 ? '🥉' : row.rank}
                  </td>
                  <td className="swap-lb-user">
                    {row.topshotUsername ? (
                      <a
                        href={`https://www.nbatopshot.com/user/@${row.topshotUsername}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="swap-lb-ts-link"
                        title={row.address}
                      >
                        {row.topshotUsername}
                      </a>
                    ) : (
                      <a
                        href={`https://www.flowdiver.io/account/${row.address}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="swap-lb-addr-link"
                      >
                        {shortAddr(row.address)}
                      </a>
                    )}
                  </td>
                  <td>{row.swapCount}</td>
                  <td className="swap-lb-mvp">{row.totalMvp.toLocaleString(undefined, { maximumFractionDigits: 1 })}</td>
                  <td className="swap-lb-raffle">{(row.points || 0).toLocaleString()}</td>
                  <td className="swap-lb-last-swap">{formatLastSwap(row.lastSwapAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="swap-lb-footnote">* Ties broken by earliest last swap date</p>
        </div>
      )}
    </div>
  );
}
