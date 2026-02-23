import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Spinner, Alert } from 'react-bootstrap';
import * as fcl from '@onflow/fcl';
import './Museum.css';

const TIER_COLORS = {
  ULTIMATE: '#e600ff',
  LEGENDARY: '#ffd700',
  RARE: '#00bfff',
  FANDOM: '#40e0d0',
  COMMON: '#adb5bd',
};

const TIER_RANK = { ULTIMATE: 5, LEGENDARY: 4, RARE: 3, FANDOM: 2, COMMON: 1 };

/* ================================================================== */
/*  Museum – first-person immersive gallery                            */
/* ================================================================== */
export default function Museum() {
  const [editions, setEditions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [user, setUser] = useState({ loggedIn: null });
  const [ownershipLoaded, setOwnershipLoaded] = useState(false);

  useEffect(() => { fcl.currentUser().subscribe(setUser); }, []);

  // Fetch editions on mount
  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const resp = await fetch('/api/museum');
        const json = await resp.json();
        if (!resp.ok) { setError(json.error || 'Failed'); return; }
        setEditions(json.editions || []);
      } catch (e) { setError(e.message); }
      finally { setLoading(false); }
    })();
  }, []);

  // Re-fetch with wallet for ownership
  useEffect(() => {
    if (!user?.addr) { setOwnershipLoaded(false); return; }
    let cancelled = false;
    (async () => {
      try {
        const resp = await fetch(`/api/museum?wallet=${user.addr}`);
        const json = await resp.json();
        if (!cancelled && resp.ok) {
          setEditions(json.editions || []);
          setOwnershipLoaded(true);
        }
      } catch { /* ignore */ }
    })();
    return () => { cancelled = true; };
  }, [user?.addr]);

  // Deduplicate by playId — keep highest tier, merge ownership
  const deduped = useMemo(() => {
    const byPlay = new Map();
    for (const ed of editions) {
      const key = ed.playId || ed.id;
      if (!byPlay.has(key)) {
        byPlay.set(key, { primary: ed, parallels: [ed] });
      } else {
        const entry = byPlay.get(key);
        entry.parallels.push(ed);
        if ((TIER_RANK[ed.tier] || 0) > (TIER_RANK[entry.primary.tier] || 0)) {
          entry.primary = ed;
        }
      }
    }
    return [...byPlay.values()].map(({ primary, parallels }) => ({
      ...primary,
      userOwnedCount: parallels.reduce((sum, p) => sum + (p.userOwnedCount || 0), 0),
      parallels: parallels.length > 1
        ? parallels.map(p => ({ tier: p.tier, setName: p.setName, owned: (p.userOwnedCount || 0) > 0 }))
        : null,
    }));
  }, [editions]);

  // Sort chronologically; null dateOfMoment → end of season
  const sortKey = (ed) => {
    if (ed.dateOfMoment) return ed.dateOfMoment;
    const m = (ed.nbaSeason || '').match(/\d{4}-(\d{2})/);
    if (m) {
      const endYear = parseInt(m[1], 10) + (m[1] < '50' ? 2000 : 1900);
      return `${endYear}-10-01T00:00:00Z`;
    }
    return 'Z';
  };
  const sorted = useMemo(() =>
    [...deduped].sort((a, b) => sortKey(a).localeCompare(sortKey(b))),
    [deduped]
  );

  // Group by season
  const seasonGroups = useMemo(() => {
    const groups = [];
    let cur = null;
    for (const ed of sorted) {
      const season = ed.nbaSeason || 'Unknown';
      if (season !== cur) { cur = season; groups.push({ season, editions: [] }); }
      groups[groups.length - 1].editions.push(ed);
    }
    return groups;
  }, [sorted]);

  const isOwned = useCallback((ed) => (ed.userOwnedCount || 0) > 0, []);
  const walletConnected = !!user?.addr;
  const ownedCount = ownershipLoaded ? sorted.filter(isOwned).length : 0;

  return (
    <div className="museum-root">
      {/* ---- Entrance screen ---- */}
      <div className="museum-entrance">
        <div className="entrance-content">
          <h1 className="museum-title">The Jokić Museum</h1>
          <p className="museum-subtitle">Every Nikola Jokić NBA TopShot Moment — Walk Through History</p>

          {walletConnected && ownershipLoaded && (
            <p className="museum-owned-count">
              🎟️ You own <strong>{ownedCount}</strong> of {sorted.length} unique moments
            </p>
          )}
          {walletConnected && !ownershipLoaded && (
            <p className="museum-owned-count">
              <Spinner animation="border" size="sm" variant="warning" /> Checking your collection…
            </p>
          )}
          {!walletConnected && (
            <p className="museum-connect-hint">
              Connect your wallet to see which moments you own
            </p>
          )}
        </div>

        <div className="entrance-scroll">
          <span>Scroll to enter</span>
          <span className="scroll-arrow">▼</span>
        </div>
      </div>

      {/* ---- Loading / Error ---- */}
      {loading && (
        <div className="text-center py-5">
          <Spinner animation="border" variant="warning" />
          <p className="mt-3 text-muted">Opening the museum…</p>
        </div>
      )}
      {error && (
        <Alert variant="danger" className="text-center mx-auto" style={{ maxWidth: 500 }}>{error}</Alert>
      )}

      {/* ---- The Corridor ---- */}
      {!loading && !error && (
        <div className="corridor">
          {seasonGroups.map((group) => (
            <SeasonRoom key={group.season} season={group.season} editions={group.editions} isOwned={isOwned} />
          ))}

          <div className="museum-end">
            <div className="end-sign">🏆 End of Tour — {sorted.length} Moments</div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ================================================================== */
/*  Season Room – a wing of the museum for one season                  */
/* ================================================================== */
function SeasonRoom({ season, editions, isOwned }) {
  // Pair editions into rows of 2 (left + right wall)
  const rows = [];
  for (let i = 0; i < editions.length; i += 2) {
    rows.push({ left: editions[i], right: editions[i + 1] || null });
  }

  return (
    <div className="season-room">
      {/* Season archway */}
      <div className="season-arch">
        <div className="season-plaque">
          <span className="season-year">{season}</span>
          <span className="season-count">{editions.length} moment{editions.length !== 1 ? 's' : ''}</span>
        </div>
      </div>

      {/* TV rows */}
      {rows.map((row, idx) => (
        <div className="wall-row" key={idx}>
          <TVMount edition={row.left} side="left" owned={isOwned(row.left)} />
          <div className="wall-pillar" />
          {row.right ? (
            <TVMount edition={row.right} side="right" owned={isOwned(row.right)} />
          ) : (
            <div /> /* empty cell keeps grid aligned */
          )}
        </div>
      ))}
    </div>
  );
}

/* ================================================================== */
/*  TV Mount – screen + plaque                                         */
/* ================================================================== */
function TVMount({ edition, side, owned }) {
  const [hovering, setHovering] = useState(false);
  const [imgError, setImgError] = useState(false);
  const videoRef = useRef(null);
  const tierColor = TIER_COLORS[edition.tier] || '#adb5bd';

  const handleEnter = useCallback(() => setHovering(true), []);
  const handleLeave = useCallback(() => setHovering(false), []);

  const dateStr = edition.dateOfMoment
    ? new Date(edition.dateOfMoment).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    : '';

  const stats = edition.gameStats || {};
  const hasStats = stats.points != null || stats.rebounds != null || stats.assists != null;

  return (
    <div className={`tv-mount tv-mount-${side}`}>
      <div
        className="tv-wall-panel"
        style={{ '--tier-color': tierColor }}
        onMouseEnter={handleEnter}
        onMouseLeave={handleLeave}
      >
        {/* Screen */}
        <div className="tv-screen">
          {edition.imageUrl && !imgError ? (
            <img
              src={edition.imageUrl}
              alt={edition.setName}
              className="tv-image"
              style={{ opacity: hovering && edition.videoUrl ? 0 : 1 }}
              onError={() => setImgError(true)}
              loading="lazy"
            />
          ) : (
            <div className="tv-placeholder">🏀</div>
          )}

          {hovering && edition.videoUrl && (
            <video
              ref={videoRef}
              src={edition.videoUrl}
              className="tv-video"
              autoPlay
              loop
              playsInline
              muted
            />
          )}

          {owned && <div className="tv-owned-indicator">✓ OWNED</div>}
        </div>

        {/* Plaque */}
        <div className="tv-plaque" style={{ '--tier-color': tierColor }}>
          <div className="plaque-header">
            <span className="plaque-tier">{edition.tier}</span>
            {edition.playCategory && <span className="plaque-category">{edition.playCategory}</span>}
          </div>

          <div className="plaque-set-name">{edition.setName}</div>

          {edition.shortDescription && (
            <div className="plaque-description">{edition.shortDescription}</div>
          )}

          {dateStr && <div className="plaque-date">{dateStr}</div>}

          {hasStats && (
            <div className="plaque-stats">
              {stats.points != null && (
                <div className="plaque-stat">
                  <span className="plaque-stat-value">{stats.points}</span>
                  <span className="plaque-stat-label">PTS</span>
                </div>
              )}
              {stats.rebounds != null && (
                <div className="plaque-stat">
                  <span className="plaque-stat-value">{stats.rebounds}</span>
                  <span className="plaque-stat-label">REB</span>
                </div>
              )}
              {stats.assists != null && (
                <div className="plaque-stat">
                  <span className="plaque-stat-value">{stats.assists}</span>
                  <span className="plaque-stat-label">AST</span>
                </div>
              )}
            </div>
          )}

          {edition.parallels && (
            <div className="plaque-parallels">
              {edition.parallels.map((p, i) => (
                <span
                  key={i}
                  className={`parallel-badge ${p.owned ? 'parallel-badge-owned' : ''}`}
                  style={{ borderColor: TIER_COLORS[p.tier] || '#adb5bd', color: TIER_COLORS[p.tier] || '#adb5bd' }}
                >
                  {p.tier}{p.owned ? ' ✓' : ''}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
