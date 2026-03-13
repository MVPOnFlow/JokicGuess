import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import SwapLeaderboard from './SwapLeaderboard';
import './Swap.css';
import './Rewards.css';

/* ── tier badge colours ─────────────────────────────────────── */
const TIER_COLORS = {
  common:    { bg: '#4ade8015', border: '#4ade80', text: '#4ade80', label: 'Common' },
  fandom:    { bg: '#40e0d015', border: '#40e0d0', text: '#40e0d0', label: 'Fandom' },
  rare:      { bg: '#60a5fa15', border: '#60a5fa', text: '#60a5fa', label: 'Rare' },
  legendary: { bg: '#fbbf2418', border: '#fbbf24', text: '#fbbf24', label: 'Legendary' },
  special:   { bg: '#c084fc15', border: '#c084fc', text: '#c084fc', label: 'Special' },
};

const TYPE_EMOJI = { pack: '📦', nft: '🐎', petting: '🤚', wildcard: '🃏' };

const STEPS = [
  { icon: '🔄', title: 'Swap Moments',    desc: 'Earn points by swapping TopShot moments for $MVP (Common = 1, Rare = 50, Legendary = 1 000).' },
  { icon: '⭐', title: 'Points = Tickets', desc: 'Each point is 1 weighted raffle entry.' },
  { icon: '🏀', title: 'Triple-Double!',   desc: 'When Jokić records a triple-double, a raffle is triggered.' },
  { icon: '🎰', title: 'Random Reward',    desc: 'A random prize is drawn and awarded to a weighted random winner.' },
];

function TierBadge({ tier }) {
  const c = TIER_COLORS[tier] || TIER_COLORS.common;
  return (
    <span
      className="tier-badge"
      style={{ background: c.bg, border: `1px solid ${c.border}`, color: c.text }}
    >
      {c.label}
    </span>
  );
}

export default function Rewards() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

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
        </p>

        <div className="rewards-pool-grid">
          {reward_pool.map((item, i) => (
            <div className="reward-item" key={i}>
              <div className="reward-item-icon">
                {TYPE_EMOJI[item.type] || '🎁'}
              </div>
              <div className="reward-item-info">
                <div className="reward-item-name" title={item.name}>{item.name}</div>
                <div className="reward-item-meta">
                  <TierBadge tier={item.tier} />
                  <span className="reward-item-qty">×{item.quantity}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Monthly Swap Leaderboard ─────────────────────── */}
      <SwapLeaderboard />
    </div>
  );
}
