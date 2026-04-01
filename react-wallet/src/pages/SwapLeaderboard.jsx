import React, { useState, useEffect, useCallback } from 'react';

/* ================================================================
   Swap Leaderboard (monthly) — shared component
   ================================================================ */
export default function SwapLeaderboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedMonth, setSelectedMonth] = useState('');
  const [copiedLb, setCopiedLb] = useState(false);

  const copyLeaderboardForWheel = () => {
    if (!data?.leaderboard?.length) return;
    const lines = data.leaderboard.flatMap(row => {
      const name = row.topshotUsername || row.address;
      const pts = row.points || 0;
      return Array.from({ length: pts }, () => name);
    });
    navigator.clipboard.writeText(lines.join('\n')).then(() => {
      setCopiedLb(true);
      setTimeout(() => setCopiedLb(false), 2000);
    });
  };

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

  const marchPrizes = [
    { label: 'Steph Curry Rare 2022 All-Star Game (Series 3)', url: 'https://nbatopshot.com/moment/427f928f-748d-4022-848b-fbedede78aea' },
    { label: 'LeBron James Top Shot This Pack', url: 'https://nbatopshot.com/listings/pack/2d288490-b22c-48d7-bacb-e798e21eb3e2' },
    { label: "Collector's Court II: Guaranteed Hit", url: 'https://nbatopshot.com/listings/pack/bca73720-7150-4725-b78c-c05d637f26cf' },
    { label: 'Courtside: Guaranteed Hit', url: 'https://nbatopshot.com/listings/pack/7ebd77e0-80e1-4808-98b8-5d1d1392b5b2' },
    { label: '$MVP Horse NFT', url: '/pettingzoo', internal: true },
  ];

  const prizesByMonth = {
    '2026-03': marchPrizes,
  };

  const prizes = prizesByMonth[selectedMonth] || null;

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

      <div className="swap-lb-prizes">
        {prizes ? (
          <>
            <p className="swap-lb-prizes-heading">🎁 Guaranteed prizes drafted among the Top 5 at the end of the month:</p>
            <ul className="swap-lb-prizes-list">
              {prizes.map((p, i) => (
                <li key={i}>
                  {p.internal ? (
                    <a href={p.url} className="swap-lb-prize-link">{p.label}</a>
                  ) : (
                    <a href={p.url} target="_blank" rel="noopener noreferrer" className="swap-lb-prize-link">{p.label}</a>
                  )}
                </li>
              ))}
            </ul>
            <p className="swap-lb-prizes-pick">
              🥇 1st place gets 1st pick, draft order follows leaderboard rank in{' '}
              <a href="https://discord.gg/3p3ff9PHqW" target="_blank" rel="noopener noreferrer" className="swap-lb-prize-link">Discord</a>!
            </p>
          </>
        ) : (
          <p className="swap-lb-prizes-heading">🎁 Prizes for {formatMonth(selectedMonth)} — TBD</p>
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
          <p className="swap-lb-footnote">
            * Ties broken by earliest last swap date
            <button className="rpt-copy-btn" onClick={copyLeaderboardForWheel}>
              {copiedLb ? '✅ Copied!' : '📋 Copy for Wheel of Names'}
            </button>
          </p>
        </div>
      )}
    </div>
  );
}
