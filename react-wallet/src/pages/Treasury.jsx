import React, { useEffect, useState, useMemo } from 'react';

/* ================================================================
   Constants
   ================================================================ */
const TIERS = [
  { key: 'COMMON',    label: 'Common',    emoji: '🟢', color: '#4ade80' },
  { key: 'FANDOM',    label: 'Fandom',    emoji: '🔹', color: '#40e0d0' },
  { key: 'RARE',      label: 'Rare',      emoji: '🔵', color: '#60a5fa' },
  { key: 'LEGENDARY', label: 'Legendary', emoji: '🟡', color: '#fbbf24' },
  { key: 'ULTIMATE',  label: 'Ultimate',  emoji: '💎', color: '#a78bfa' },
];
const TIER_MAP = {};
TIERS.forEach(t => { TIER_MAP[t.key] = t; });

const PARALLEL_NAMES = {
  '': 'Standard', 'Standard': 'Standard',
  'Explosion': 'Explosion', 'Torn': 'Torn', 'Vortex': 'Vortex',
  'Rippled': 'Rippled', 'Coded': 'Coded', 'Halftone': 'Halftone',
  'Bubbled': 'Bubbled', 'Diced': 'Diced', 'Bit': 'Bit',
  'Vibe': 'Vibe', 'Astra': 'Astra', 'Voltage': 'Voltage',
  'Livewire': 'Livewire', 'Championship': 'Championship',
  'Club Collection': 'Club Collection', 'Blockchain': 'Blockchain',
  'Hardcourt': 'Hardcourt', 'Hexwave': 'Hexwave',
  'Jukebox': 'Jukebox', 'Galactic': 'Galactic', 'Omega': 'Omega',
};

/* ================================================================
   Treasury page — lists all Jokic editions owned by the treasury
   ================================================================ */
export default function Treasury() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Filters
  const [tierFilter, setTierFilter] = useState('ALL');
  const [setFilter, setSetFilter] = useState('ALL');
  const [parallelFilter, setParallelFilter] = useState('ALL');
  const [search, setSearch] = useState('');

  useEffect(() => {
    setLoading(true);
    fetch('/api/treasury/editions')
      .then(r => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then(d => {
        if (d.error) throw new Error(d.error);
        setData(d);
        setLoading(false);
      })
      .catch(e => { setError(e.message); setLoading(false); });
  }, []);

  /* ── Derived filter options ── */
  const editions = data?.editions || [];

  const setOptions = useMemo(() =>
    [...new Set(editions.map(e => e.setName).filter(Boolean))].sort(),
    [editions]
  );

  const parallelOptions = useMemo(() =>
    [...new Set(editions.map(e => e.parallelName || 'Standard').filter(Boolean))].sort(),
    [editions]
  );

  /* ── Filtered editions ── */
  const filtered = useMemo(() => {
    let list = editions;
    if (tierFilter !== 'ALL') list = list.filter(e => e.tier === tierFilter);
    if (setFilter !== 'ALL') list = list.filter(e => e.setName === setFilter);
    if (parallelFilter !== 'ALL') list = list.filter(e => (e.parallelName || 'Standard') === parallelFilter);
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(e =>
        (e.shortDescription || '').toLowerCase().includes(q) ||
        (e.setName || '').toLowerCase().includes(q) ||
        (e.playCategory || '').toLowerCase().includes(q) ||
        (e.dateOfMoment || '').toLowerCase().includes(q) ||
        (e.nbaSeason || '').toLowerCase().includes(q)
      );
    }
    return list;
  }, [editions, tierFilter, setFilter, parallelFilter, search]);

  const filteredMomentCount = useMemo(() =>
    filtered.reduce((sum, e) => sum + (e.userOwnedCount || 0), 0),
    [filtered]
  );

  /* ── Tier breakdown for the stat bar ── */
  const tierBreakdown = data?.tierBreakdown || {};

  /* ── Loading / error states ── */
  if (loading) {
    return (
      <div className="container" style={{ textAlign: 'center', paddingTop: '4rem' }}>
        <div className="spinner-border" style={{ color: '#FDB927', width: '3rem', height: '3rem' }} role="status" />
        <p style={{ color: '#ccc', marginTop: '1rem' }}>Loading treasury editions…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container" style={{ textAlign: 'center', paddingTop: '4rem' }}>
        <p style={{ color: '#ef4444' }}>Failed to load treasury: {error}</p>
      </div>
    );
  }

  return (
    <div className="container">
      {/* ── Header ── */}
      <div className="card shadow mb-4">
        <div className="card-body text-center">
          <h2 style={{ color: '#FDB927' }}>🏦 Treasury Vault</h2>
          <p style={{ color: '#9CA3AF', marginBottom: '0.5rem' }}>
            All Nikola Jokić editions held in the community treasury
          </p>
        </div>
      </div>

      {/* ── Summary stats ── */}
      <div className="row mb-4">
        <div className="col-6 col-md-3 mb-3">
          <div className="card treasury-card h-100 text-center">
            <div className="card-body py-3">
              <div style={{ fontSize: '0.8rem', color: '#9CA3AF', marginBottom: 4 }}>Total Editions</div>
              <div style={{ fontSize: '1.8rem', fontWeight: 700, color: '#FDB927' }}>{data.totalEditions}</div>
            </div>
          </div>
        </div>
        <div className="col-6 col-md-3 mb-3">
          <div className="card treasury-card h-100 text-center">
            <div className="card-body py-3">
              <div style={{ fontSize: '0.8rem', color: '#9CA3AF', marginBottom: 4 }}>Total Moments</div>
              <div style={{ fontSize: '1.8rem', fontWeight: 700, color: '#FDB927' }}>{data.totalMoments}</div>
            </div>
          </div>
        </div>
        {TIERS.map(t => {
          const count = tierBreakdown[t.key];
          if (!count) return null;
          return (
            <div key={t.key} className="col-6 col-md-3 mb-3">
              <div className="card treasury-card h-100 text-center">
                <div className="card-body py-3">
                  <div style={{ fontSize: '0.8rem', color: '#9CA3AF', marginBottom: 4 }}>{t.emoji} {t.label}</div>
                  <div style={{ fontSize: '1.8rem', fontWeight: 700, color: t.color }}>{count}</div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Filters ── */}
      <div className="card shadow mb-4" style={{ background: '#1a1d23', border: '1px solid #2d2f36' }}>
        <div className="card-body">
          <div className="row g-2 align-items-end">
            {/* Search */}
            <div className="col-12 col-md-3">
              <label className="form-label" style={{ color: '#9CA3AF', fontSize: '0.8rem' }}>Search</label>
              <input
                type="text"
                className="form-control form-control-sm"
                placeholder="Description, set, date…"
                value={search}
                onChange={e => setSearch(e.target.value)}
                style={{ background: '#111318', border: '1px solid #3a3d45', color: '#e5e7eb' }}
              />
            </div>
            {/* Tier */}
            <div className="col-6 col-md-2">
              <label className="form-label" style={{ color: '#9CA3AF', fontSize: '0.8rem' }}>Tier</label>
              <select
                className="form-select form-select-sm"
                value={tierFilter}
                onChange={e => setTierFilter(e.target.value)}
                style={{ background: '#111318', border: '1px solid #3a3d45', color: '#e5e7eb' }}
              >
                <option value="ALL">All Tiers</option>
                {TIERS.map(t => (
                  <option key={t.key} value={t.key}>{t.emoji} {t.label}</option>
                ))}
              </select>
            </div>
            {/* Set */}
            <div className="col-6 col-md-3">
              <label className="form-label" style={{ color: '#9CA3AF', fontSize: '0.8rem' }}>Set</label>
              <select
                className="form-select form-select-sm"
                value={setFilter}
                onChange={e => setSetFilter(e.target.value)}
                style={{ background: '#111318', border: '1px solid #3a3d45', color: '#e5e7eb' }}
              >
                <option value="ALL">All Sets</option>
                {setOptions.map(s => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
            {/* Parallel */}
            <div className="col-6 col-md-2">
              <label className="form-label" style={{ color: '#9CA3AF', fontSize: '0.8rem' }}>Parallel</label>
              <select
                className="form-select form-select-sm"
                value={parallelFilter}
                onChange={e => setParallelFilter(e.target.value)}
                style={{ background: '#111318', border: '1px solid #3a3d45', color: '#e5e7eb' }}
              >
                <option value="ALL">All Parallels</option>
                {parallelOptions.map(p => (
                  <option key={p} value={p}>{PARALLEL_NAMES[p] || p}</option>
                ))}
              </select>
            </div>
            {/* Result count */}
            <div className="col-6 col-md-2 d-flex align-items-end">
              <span style={{ color: '#9CA3AF', fontSize: '0.8rem', paddingBottom: 6 }}>
                {filtered.length} edition{filtered.length !== 1 ? 's' : ''} · {filteredMomentCount} moment{filteredMomentCount !== 1 ? 's' : ''}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Edition grid ── */}
      {filtered.length === 0 ? (
        <div className="text-center" style={{ color: '#6b7280', padding: '3rem 0' }}>
          No matching editions found.
        </div>
      ) : (
        <div className="row">
          {filtered.map(ed => (
            <EditionCard key={ed.id} edition={ed} />
          ))}
        </div>
      )}
    </div>
  );
}

/* ================================================================
   EditionCard — single edition in the grid
   ================================================================ */
function EditionCard({ edition: ed }) {
  const tier = TIER_MAP[ed.tier] || { label: ed.tier, color: '#adb5bd', emoji: '' };
  const parallel = ed.parallelName || 'Standard';
  const [imgError, setImgError] = useState(false);

  // Format date nicely
  const dateStr = ed.dateOfMoment
    ? new Date(ed.dateOfMoment).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    : '';

  const gameStats = ed.gameStats;
  const statLine = gameStats
    ? [
        gameStats.points != null && `${gameStats.points} PTS`,
        gameStats.rebounds != null && `${gameStats.rebounds} REB`,
        gameStats.assists != null && `${gameStats.assists} AST`,
      ].filter(Boolean).join(' / ')
    : '';

  return (
    <div className="col-12 col-sm-6 col-lg-4 col-xl-3 mb-3">
      <div
        className="card h-100"
        style={{
          background: '#15171c',
          border: `1px solid ${tier.color}33`,
          borderRadius: 12,
          overflow: 'hidden',
          transition: 'border-color 0.2s, transform 0.2s',
        }}
        onMouseEnter={e => { e.currentTarget.style.borderColor = tier.color; e.currentTarget.style.transform = 'translateY(-2px)'; }}
        onMouseLeave={e => { e.currentTarget.style.borderColor = `${tier.color}33`; e.currentTarget.style.transform = 'translateY(0)'; }}
      >
        {/* Image */}
        {ed.imageUrl && !imgError ? (
          <div style={{ position: 'relative', background: '#0d0f13' }}>
            <img
              src={ed.imageUrl}
              alt={ed.shortDescription}
              loading="lazy"
              onError={() => setImgError(true)}
              style={{
                width: '100%',
                aspectRatio: '1',
                objectFit: 'cover',
                display: 'block',
              }}
            />
            {/* Owned badge */}
            <div style={{
              position: 'absolute', top: 8, right: 8,
              background: '#FDB927', color: '#111', fontWeight: 700,
              fontSize: '0.85rem', padding: '2px 10px', borderRadius: 20,
            }}>
              ×{ed.userOwnedCount}
            </div>
          </div>
        ) : (
          <div style={{
            aspectRatio: '1', background: '#0d0f13',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            position: 'relative',
          }}>
            <span style={{ fontSize: '3rem' }}>{tier.emoji || '🏀'}</span>
            <div style={{
              position: 'absolute', top: 8, right: 8,
              background: '#FDB927', color: '#111', fontWeight: 700,
              fontSize: '0.85rem', padding: '2px 10px', borderRadius: 20,
            }}>
              ×{ed.userOwnedCount}
            </div>
          </div>
        )}

        {/* Info */}
        <div className="card-body" style={{ padding: '0.75rem' }}>
          {/* Tier + Parallel row */}
          <div className="d-flex justify-content-between align-items-center mb-1">
            <span style={{ color: tier.color, fontWeight: 600, fontSize: '0.75rem' }}>
              {tier.emoji} {tier.label}
            </span>
            {parallel !== 'Standard' && (
              <span style={{ color: '#9CA3AF', fontSize: '0.7rem', background: '#1e2028', padding: '1px 6px', borderRadius: 4 }}>
                {parallel}
              </span>
            )}
          </div>

          {/* Set name */}
          <div style={{ color: '#e5e7eb', fontWeight: 600, fontSize: '0.85rem', lineHeight: 1.3, marginBottom: 4 }}>
            {ed.setName}
            {ed.seriesNumber ? <span style={{ color: '#6b7280', fontWeight: 400 }}> · S{ed.seriesNumber}</span> : ''}
          </div>

          {/* Play description */}
          {ed.shortDescription && (
            <div style={{ color: '#9CA3AF', fontSize: '0.75rem', lineHeight: 1.3, marginBottom: 4 }}>
              {ed.shortDescription}
            </div>
          )}

          {/* Date + Category */}
          <div className="d-flex justify-content-between" style={{ fontSize: '0.7rem', color: '#6b7280' }}>
            <span>{dateStr}</span>
            {ed.playCategory && <span>{ed.playCategory}</span>}
          </div>

          {/* Game stats */}
          {statLine && (
            <div style={{ color: '#FDB927', fontSize: '0.75rem', fontWeight: 600, marginTop: 4 }}>
              {statLine}
            </div>
          )}

          {/* Market info */}
          <div className="d-flex justify-content-between mt-2" style={{ fontSize: '0.7rem', color: '#6b7280', borderTop: '1px solid #2d2f36', paddingTop: 4 }}>
            <span>
              {ed.circulationCount != null ? `/${ed.circulationCount} minted` : ''}
            </span>
            {ed.lowAsk != null && (
              <span style={{ color: '#4ade80' }}>
                Low ask ${parseFloat(ed.lowAsk).toFixed(0)}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
