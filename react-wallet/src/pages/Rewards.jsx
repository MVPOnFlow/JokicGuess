import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import SwapLeaderboard from './SwapLeaderboard';
import './Swap.css';
import './Rewards.css';

const TYPE_EMOJI = { pack: '📦', nft: '🐎', petting: '🤚', wildcard: '🃏' };

const STEPS = [
  { icon: '🔄', title: 'Swap Moments',    desc: 'Earn points by swapping TopShot moments for $MVP (Common = 1, Rare = 50, Legendary = 1 000).' },
  { icon: '⭐', title: 'Points = Tickets', desc: 'Each point is 1 weighted raffle entry.' },
  { icon: '🏀', title: 'Triple-Double!',   desc: 'When Jokić records a triple-double, a raffle is triggered.' },
  { icon: '🎰', title: 'Random Reward',    desc: 'A random prize is drawn and awarded to a weighted random winner.' },
];

export default function Rewards() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  const copyForWheel = () => {
    if (!data) return;
    const lines = data.reward_pool.flatMap(r =>
      Array.from({ length: r.quantity }, () => r.name)
    );
    navigator.clipboard.writeText(lines.join('\n')).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  useEffect(() => {
    fetch('/api/rewards')
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="rewards-container" style={{ paddingTop: '4rem', textAlign: 'center' }}>
        <div className="spinner-border" role="status" style={{ color: '#FDB927' }} />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="rewards-container" style={{ paddingTop: '4rem', textAlign: 'center' }}>
        <p style={{ color: '#9CA3AF' }}>Failed to load rewards data.</p>
      </div>
    );
  }

  const { reward_pool, total_items } = data;
  const uniqueRewards = reward_pool.length;

  return (
    <div className="rewards-container">

      {/* ── Hero ───────────────────────────────────────────── */}
      <div className="rewards-hero">
        <h2>🎁 Reward Pool &amp; Raffle</h2>
        <p>
          Every time Jokić records a triple-double, a random reward is selected
          from the pool and distributed to a random winner via weighted raffle.
          Each $MVP point earned is <strong>1 raffle entry</strong> — the more you
          swap, the better your odds!
        </p>
        <Link to="/swap" className="rewards-cta-btn">
          🔄 Start Swapping to Earn Points
        </Link>
      </div>

      {/* ── Stats ──────────────────────────────────────────── */}
      <div className="rewards-stats">
        <div className="rewards-stat-card">
          <div className="rewards-stat-value">{total_items}</div>
          <div className="rewards-stat-label">Total Prizes</div>
        </div>
        <div className="rewards-stat-card">
          <div className="rewards-stat-value">{uniqueRewards}</div>
          <div className="rewards-stat-label">Unique Rewards</div>
        </div>
      </div>

      {/* ── How it works ───────────────────────────────────── */}
      <div className="rewards-steps">
        {STEPS.map((s, i) => (
          <div className="rewards-step" key={i}>
            <div className="rewards-step-number">{i + 1}</div>
            <div className="rewards-step-icon">{s.icon}</div>
            <div className="rewards-step-title">{s.title}</div>
            <p className="rewards-step-desc">{s.desc}</p>
          </div>
        ))}
      </div>

      {/* ── Reward Pool ────────────────────────────────────── */}
      <div className="rewards-section">
        <div className="rewards-section-header">
          <span className="section-icon">🏆</span>
          <h5>Reward Pool</h5>
        </div>
        <p className="rewards-section-subtitle">
          {total_items} items across {uniqueRewards} unique rewards available for raffle draws.
          <button className="rpt-copy-btn" onClick={copyForWheel}>
            {copied ? '✅ Copied!' : '📋 Copy for Wheel of Names'}
          </button>
        </p>

        <table className="rewards-pool-table">
          <thead>
            <tr>
              <th style={{ width: 40 }}></th>
              <th>Reward</th>
              <th style={{ width: 60, textAlign: 'center' }}>Qty</th>
            </tr>
          </thead>
          <tbody>
            {reward_pool.map((item, i) => (
              <tr key={i}>
                <td className="rpt-icon">{TYPE_EMOJI[item.type] || '🎁'}</td>
                <td className="rpt-name">{item.name}</td>
                <td className="rpt-qty">×{item.quantity}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ── Monthly Swap Leaderboard ─────────────────────── */}
      <SwapLeaderboard />
    </div>
  );
}
