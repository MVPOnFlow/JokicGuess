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

// Higher = rarer; used to pick the "best" edition when deduplicating
const TIER_RANK = { ULTIMATE: 5, LEGENDARY: 4, RARE: 3, FANDOM: 2, COMMON: 1 };

/* ------------------------------------------------------------------ */
/*  Main – "The Jokić Museum"                                          */
/* ------------------------------------------------------------------ */
export default function Museum() {
  const [editions, setEditions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [user, setUser] = useState({ loggedIn: null });
  const [ownershipLoaded, setOwnershipLoaded] = useState(false);

  // Subscribe to FCL user
  useEffect(() => {
    fcl.currentUser().subscribe(setUser);
  }, []);

  // Fetch editions (without ownership) on mount
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

  // Re-fetch with wallet param when user connects (to get userOwnedCount)
  useEffect(() => {
    if (!user?.addr) { setOwnershipLoaded(false); return; }
    let cancelled = false;
    (async () => {
      try {
        const resp = await fetch(`/api/museum?wallet=${user.addr}`);
        const json = await resp.json();
        if (!cancelled && !resp.ok) return;
        if (!cancelled) {
          setEditions(json.editions || []);
          setOwnershipLoaded(true);
        }
      } catch { /* ignore */ }
    })();
    return () => { cancelled = true; };
  }, [user?.addr]);

  // Deduplicate editions that share the same video highlight (same playId).
  // Keep the highest-tier edition as the "primary", but gather parallel info.
  const deduped = useMemo(() => {
    const byPlay = new Map();
    for (const ed of editions) {
      const key = ed.playId || ed.id;            // fallback to id if no playId
      if (!byPlay.has(key)) {
        byPlay.set(key, { primary: ed, parallels: [ed] });
      } else {
        const entry = byPlay.get(key);
        entry.parallels.push(ed);
        // Promote higher tier as primary
        if ((TIER_RANK[ed.tier] || 0) > (TIER_RANK[entry.primary.tier] || 0)) {
          entry.primary = ed;
        }
      }
    }
    return [...byPlay.values()].map(({ primary, parallels }) => ({
      ...primary,
      // Merge ownership across all parallels
      userOwnedCount: parallels.reduce((sum, p) => sum + (p.userOwnedCount || 0), 0),
      parallels: parallels.length > 1
        ? parallels.map(p => ({ tier: p.tier, setName: p.setName, owned: (p.userOwnedCount || 0) > 0 }))
        : null,
    }));
  }, [editions]);

  // Sort by game date ascending (chronological walk through museum).
  // Some editions have no dateOfMoment (e.g. Honors, Hardware, Champion's Path).
  // For those, derive a synthetic sort key from nbaSeason so they land at the end
  // of their season rather than floating to the very top.
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

  // Group by NBA season
  const seasonGroups = useMemo(() => {
    const groups = [];
    let currentSeason = null;
    for (const ed of sorted) {
      const season = ed.nbaSeason || 'Unknown';
      if (season !== currentSeason) {
        currentSeason = season;
        groups.push({ season, editions: [] });
      }
      groups[groups.length - 1].editions.push(ed);
    }
    return groups;
  }, [sorted]);

  // Ownership helper — uses userOwnedCount from the API
  const isOwned = useCallback((edition) => {
    return (edition.userOwnedCount || 0) > 0;
  }, []);

  const walletConnected = !!user?.addr;
  const ownedCount = ownershipLoaded ? sorted.filter(e => isOwned(e)).length : 0;

  return (
    <div className="museum-root">
      {/* Entrance arch */}
      <div className="museum-entrance">
        <div className="entrance-arch">
          <h1 className="museum-title">The Jokić Museum</h1>
          <p className="museum-subtitle">Walk through every Nikola Jokić NBA TopShot moment</p>
          {walletConnected && ownershipLoaded && (
            <p className="museum-owned-count">
              🎟️ You own <strong>{ownedCount}</strong> of {sorted.length} unique moments — hover any TV to play
            </p>
          )}
          {walletConnected && !ownershipLoaded && (
            <p className="museum-owned-count">
              <Spinner animation="border" size="sm" variant="warning" /> Checking your collection...
            </p>
          )}
          {!walletConnected && (
            <p className="museum-connect-hint">Hover any TV to play — connect your wallet to see which moments you own</p>
          )}
        </div>
        <div className="entrance-arrow">▼</div>
      </div>

      {/* Loading */}
      {loading && (
        <div className="text-center py-5">
          <Spinner animation="border" variant="warning" />
          <p className="mt-3 text-muted">Preparing the museum...</p>
        </div>
      )}

      {error && <Alert variant="danger" className="text-center mx-auto" style={{ maxWidth: 500 }}>{error}</Alert>}

      {/* The hallway */}
      {!loading && !error && (
        <div className="hallway">
          <div className="hallway-floor" />
          {seasonGroups.map((group) => (
            <SeasonWing key={group.season} season={group.season} editions={group.editions} isOwned={isOwned} walletConnected={walletConnected} />
          ))}

          {/* End of museum */}
          <div className="museum-end">
            <div className="end-sign">🏆 End of Tour — {sorted.length} Moments</div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Season Wing – year sign + TVs on alternating sides                 */
/* ------------------------------------------------------------------ */
function SeasonWing({ season, editions, isOwned, walletConnected }) {
  return (
    <div className="season-wing">
      {/* Overhead sign */}
      <div className="season-sign-wrapper">
        <div className="season-sign">
          <span className="season-sign-icon">🏀</span>
          <span className="season-sign-text">{season}</span>
          <span className="season-sign-count">{editions.length} moment{editions.length !== 1 ? 's' : ''}</span>
        </div>
      </div>

      {/* TV pairs */}
      <div className="tv-corridor">
        {editions.map((edition, idx) => (
          <TV
            key={edition.playId || edition.id}
            edition={edition}
            side={idx % 2 === 0 ? 'left' : 'right'}
            owned={isOwned(edition)}
            walletConnected={walletConnected}
          />
        ))}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  TV – a single "television" on the wall                             */
/* ------------------------------------------------------------------ */
function TV({ edition, side, owned, walletConnected }) {
  const [hovering, setHovering] = useState(false);
  const [imgError, setImgError] = useState(false);
  const videoRef = useRef(null);
  const tierColor = TIER_COLORS[edition.tier] || '#adb5bd';

  const handleEnter = useCallback(() => setHovering(true), []);
  const handleLeave = useCallback(() => setHovering(false), []);

  const dateStr = edition.dateOfMoment
    ? new Date(edition.dateOfMoment).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    : '';

  const statsLine = edition.gameStats
    ? [
        edition.gameStats.points != null && `${edition.gameStats.points} PTS`,
        edition.gameStats.rebounds != null && `${edition.gameStats.rebounds} REB`,
        edition.gameStats.assists != null && `${edition.gameStats.assists} AST`,
      ].filter(Boolean).join(' · ')
    : '';

  return (
    <div className={`tv-row tv-${side}`}>
      <div
        className={`tv-frame ${owned ? 'tv-owned' : ''}`}
        style={{ '--tier-color': tierColor }}
        onMouseEnter={handleEnter}
        onMouseLeave={handleLeave}
      >
        {/* Screen */}
        <div className="tv-screen">
          {/* Static image */}
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

          {/* Video on hover (always plays) */}
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

          {/* Ownership glow indicator */}
          {owned && <div className="tv-owned-indicator">✓ OWNED</div>}
        </div>

        {/* TV stand / label */}
        <div className="tv-label">
          <div className="tv-label-top">
            <span className="tv-tier" style={{ color: tierColor }}>{edition.tier}</span>
            {edition.playCategory && <span className="tv-category">{edition.playCategory}</span>}
          </div>
          <div className="tv-set-name">{edition.setName}</div>
          {/* Show parallel editions if this play appears in multiple sets */}
          {edition.parallels && (
            <div className="tv-parallels">
              {edition.parallels.map((p, i) => (
                <span key={i} className={`tv-parallel-badge ${p.owned ? 'tv-parallel-owned' : ''}`}
                      style={{ borderColor: TIER_COLORS[p.tier] || '#adb5bd', color: TIER_COLORS[p.tier] || '#adb5bd' }}>
                  {p.tier}{p.owned ? ' ✓' : ''}
                </span>
              ))}
            </div>
          )}
          <div className="tv-meta">
            {dateStr && <span>{dateStr}</span>}
            {statsLine && <span className="tv-stats">{statsLine}</span>}
          </div>
        </div>
      </div>
    </div>
  );
}
