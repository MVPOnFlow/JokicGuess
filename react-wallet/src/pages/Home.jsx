import React, { useState } from 'react';
import { Link } from 'react-router-dom';

const FEATURES = [
  { emoji: '🏛️', title: 'Museum',       desc: 'Browse every Jokic moment on the platform',                to: '/museum' },
  { emoji: '🎁', title: 'Swap Rewards', desc: 'Swap $MVP and moments and earn community rewards',         to: '/rewards' },
  { emoji: '📊', title: 'TD Watch',     desc: "Track Jokic's triple-double pace all season",              to: '/tdwatch' },
  { emoji: '🗳️', title: 'Vote',         desc: 'Weigh in on community decisions',                          to: '/vote' },
  { emoji: '📝', title: 'Blog',         desc: 'Fan stories and project updates',                          to: '/blog' },
  { emoji: '🏇', title: 'Fastbreak',    desc: 'Predict fastbreak winners and earn prizes',                to: '/fastbreak' },
];

export default function Home() {
  const [chartOpen, setChartOpen] = useState(false);

  return (
    <>
      {/* ── Hero ── */}
      <div className="hero hero-home">
        <img src="/images/Logo.jpg" alt="MVP on Flow" className="hero-logo" />
        <h1 style={{ color: '#FDB927' }}>The Jokic Fan Economy on Flow</h1>
        <p className="hero-subtitle">
          Collect, swap, and earn <strong>$MVP</strong> tokens backed by Nikola Jokic's NBA TopShot moments.
        </p>
        <div className="d-flex gap-3 justify-content-center flex-wrap mt-3">
          <Link to="/museum" className="btn btn-swap">🏛️ Explore the Museum</Link>
          <Link to="/swap" className="btn btn-swap">🔄 Start Swapping</Link>
          <a
            href="https://discord.gg/3p3ff9PHqW"
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-discord"
          >
            <i className="bi bi-discord"></i> Join Discord
          </a>
        </div>
      </div>

      {/* ── How It Works ── */}
      <div className="card shadow mb-4">
        <div className="card-body">
          <h2 className="card-title text-center mb-4">How It Works</h2>
          <div className="row g-4 text-center">
            {[
              { step: '1', emoji: '🏛️', title: 'Collect',  text: 'Browse & collect Jokic TopShot moments in the Museum', to: '/museum' },
              { step: '2', emoji: '🐎', title: 'Earn',     text: "Pet Jokic's horses, win contests & earn $MVP tokens",  to: '/fastbreak' },
              { step: '3', emoji: '🔄', title: 'Swap',     text: 'Redeem $MVP for moments or trade on Flow DEXs',        to: '/swap' },
            ].map(s => (
              <div className="col-md-4" key={s.step}>
                <Link to={s.to} className="hiw-card">
                  <div className="hiw-step">{s.step}</div>
                  <div className="hiw-emoji">{s.emoji}</div>
                  <h5 className="hiw-title">{s.title}</h5>
                  <p className="hiw-text">{s.text}</p>
                </Link>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Feature Grid ── */}
      <div className="card shadow mb-4">
        <div className="card-body">
          <h2 className="card-title text-center mb-4">Explore</h2>
          <div className="row g-3">
            {FEATURES.map(f => (
              <div className="col-6 col-md-4" key={f.to}>
                <Link to={f.to} className="feature-card">
                  <span className="feature-emoji">{f.emoji}</span>
                  <strong className="feature-title">{f.title}</strong>
                  <span className="feature-desc">{f.desc}</span>
                </Link>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── $MVP Chart (collapsed) ── */}
      <div className="card shadow mb-4">
        <div
          className="card-body py-3 d-flex align-items-center justify-content-between"
          style={{ cursor: 'pointer' }}
          onClick={() => setChartOpen(o => !o)}
        >
          <h2 className="card-title mb-0" style={{ borderBottom: 'none', paddingBottom: 0 }}>
            📊 $MVP Token Chart
          </h2>
          <span style={{ fontSize: '1.4rem', color: '#FDB927' }}>{chartOpen ? '▲' : '▼'}</span>
        </div>
        {chartOpen && (
          <div className="card-body pt-0">
            <style dangerouslySetInnerHTML={{__html: `
              #dexscreener-embed{position:relative;width:100%;padding-bottom:125%;}
              @media(min-width:1400px){#dexscreener-embed{padding-bottom:65%;}}
              #dexscreener-embed iframe{position:absolute;width:100%;height:100%;top:0;left:0;border:0;}
            `}} />
            <div id="dexscreener-embed">
              <iframe src="https://dexscreener.com/flowevm/0xa4BaC0A22b689565ddA7C9d5320333ac63531971?embed=1&loadChartSettings=0&chartLeftToolbar=0&chartDefaultOnMobile=1&chartTheme=dark&theme=dark&chartStyle=0&chartType=usd&interval=15"></iframe>
            </div>
          </div>
        )}
      </div>

      {/* ── Discord CTA Banner ── */}
      <div className="discord-banner">
        <h3>🏀 Join the Jokic Fan Community</h3>
        <p>Prediction contests, moment giveaways, and daily Jokic talk.</p>
        <a
          href="https://discord.gg/3p3ff9PHqW"
          target="_blank"
          rel="noopener noreferrer"
          className="btn btn-discord btn-lg"
        >
          <i className="bi bi-discord"></i> Join Our Discord
        </a>
      </div>
    </>
  );
}
