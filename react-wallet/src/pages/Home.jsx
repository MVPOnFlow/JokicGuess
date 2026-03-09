import React, { useEffect, useState } from 'react';

export default function Home() {
  const [treasury, setTreasury] = useState(null);

  useEffect(() => {
    fetch('https://mvponflow.cc/api/treasury')
      .then(res => res.json())
      .then(data => setTreasury(data));
  }, []);
  return (
    <>
      <div className="hero">
        <h1 style={{ color: '#FDB927' }}>🏀 MVP on Flow - Pet Jokic's Horses 🐎</h1>
        <p>
          MVP on Flow, also known as <strong>Pet Jokic's horses</strong>, is a <strong>fan-powered project</strong> celebrating Nikola Jokic and his NBA TopShot moments on the Flow blockchain.
        </p>
        <p>
          Join our Discord community for Jokic-themed fun, prediction contests, raffles, giveaways, and more!
        </p>
        <p>
          Earn and use <strong>$MVP</strong> tokens in community games, swap them for Jokic moments, trade them on Flow exchanges or stake them to earn rewards. Whether you're a collector or a fan, there's something for everyone.
        </p>
        <a
          href="https://discord.gg/3p3ff9PHqW"
          target="_blank"
          rel="noopener noreferrer"
          className="btn btn-discord"
        >
          <i className="bi bi-discord"></i> Join Our Discord
        </a>
      </div>

      {/* ── Tokenomics ── */}
      <div className="card shadow mb-4">
        <div className="card-body">
          <h2 className="card-title text-center mb-3">💰 $MVP Tokenomics</h2>
          <p className="card-text text-center mb-4">
            Earn, trade and redeem <strong>$MVP</strong> tokens in the Jokic fan economy
          </p>

          {/* Exchange rates */}
          <h5 className="text-center mb-3" style={{ color: '#FDB927' }}>
            $MVP → Moment (Redeem)
          </h5>
          <div className="row g-3 mb-3">
            {[
              { tier: 'Common',   emoji: '🟢', rate: 2,    color: '#4ade80' },
              { tier: 'Rare',     emoji: '🔵', rate: 100,  color: '#60a5fa' },
              { tier: 'TSD',      emoji: '🟣', rate: 500,  color: '#c084fc' },
              { tier: 'Legendary',emoji: '🟡', rate: 2000, color: '#fbbf24' },
            ].map(t => (
              <div className="col-6 col-md-3" key={t.tier}>
                <div className="text-center p-3 rounded" style={{
                  background: 'rgba(255,255,255,0.04)',
                  border: `1px solid ${t.color}40`,
                }}>
                  <div style={{ fontSize: '1.8rem' }}>{t.emoji}</div>
                  <div className="fw-bold mt-1" style={{ color: t.color }}>{t.tier}</div>
                  <div className="mt-1" style={{ fontSize: '1.4rem', fontWeight: 700, color: '#FDB927' }}>
                    {t.rate.toLocaleString()} $MVP
                  </div>
                </div>
              </div>
            ))}
          </div>

          <h5 className="text-center mb-3" style={{ color: '#4ade80' }}>
            Moment → $MVP (Sell to Treasury – 75%)
          </h5>
          <div className="row g-3 mb-4">
            {[
              { tier: 'Common',   emoji: '🟢', rate: 1.5,  color: '#4ade80' },
              { tier: 'Rare',     emoji: '🔵', rate: 75,   color: '#60a5fa' },
              { tier: 'TSD',      emoji: '🟣', rate: 375,  color: '#c084fc' },
              { tier: 'Legendary',emoji: '🟡', rate: 1500, color: '#fbbf24' },
            ].map(t => (
              <div className="col-6 col-md-3" key={t.tier}>
                <div className="text-center p-3 rounded" style={{
                  background: 'rgba(255,255,255,0.04)',
                  border: `1px solid ${t.color}40`,
                }}>
                  <div style={{ fontSize: '1.8rem' }}>{t.emoji}</div>
                  <div className="fw-bold mt-1" style={{ color: t.color }}>{t.tier}</div>
                  <div className="mt-1" style={{ fontSize: '1.4rem', fontWeight: 700, color: '#4ade80' }}>
                    {t.rate.toLocaleString()} $MVP
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Earn & Spend */}
          <div className="row g-3">
            <div className="col-md-6">
              <div className="p-3 rounded h-100" style={{
                background: 'rgba(74,222,128,0.06)',
                border: '1px solid rgba(74,222,128,0.25)',
              }}>
                <h6 className="fw-bold mb-2" style={{ color: '#4ade80' }}>
                  📥 Earn $MVP
                </h6>
                <ul className="mb-0 ps-3" style={{ color: '#CBD5E1', lineHeight: 1.8 }}>
                  <li>Pet Jokic's horses 🐎</li>
                  <li>Prediction contests &amp; raffles</li>
                  <li>Swap Jokic moments to treasury</li>
                  <li>Community giveaways</li>
                </ul>
              </div>
            </div>
            <div className="col-md-6">
              <div className="p-3 rounded h-100" style={{
                background: 'rgba(251,191,36,0.06)',
                border: '1px solid rgba(251,191,36,0.25)',
              }}>
                <h6 className="fw-bold mb-2" style={{ color: '#fbbf24' }}>
                  📤 Use $MVP
                </h6>
                <ul className="mb-0 ps-3" style={{ color: '#CBD5E1', lineHeight: 1.8 }}>
                  <li>Redeem for Jokic TopShot moments</li>
                  <li>Trade on Flow DEXs (KittyPunch)</li>
                  <li>Enter exclusive contests</li>
                  <li>Stake for community rewards</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>

      {treasury && (
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
      )}

      <div className="card shadow mb-4">
        <div className="card-body">
          <h2 className="card-title text-center mb-3">📊 $MVP Token Chart on Flow EVM</h2>
          <style dangerouslySetInnerHTML={{__html: `
            #dexscreener-embed{position:relative;width:100%;padding-bottom:125%;}
            @media(min-width:1400px){#dexscreener-embed{padding-bottom:65%;}}
            #dexscreener-embed iframe{position:absolute;width:100%;height:100%;top:0;left:0;border:0;}
          `}} />
          <div id="dexscreener-embed">
            <iframe src="https://dexscreener.com/flowevm/0xa4BaC0A22b689565ddA7C9d5320333ac63531971?embed=1&loadChartSettings=0&chartLeftToolbar=0&chartDefaultOnMobile=1&chartTheme=dark&theme=dark&chartStyle=0&chartType=usd&interval=15"></iframe>
          </div>
        </div>
      </div>
    </>
  );
}
