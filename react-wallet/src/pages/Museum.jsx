import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Canvas, useFrame, useThree, useLoader } from '@react-three/fiber';
import { PointerLockControls, Html } from '@react-three/drei';
import * as THREE from 'three';
import { Spinner } from 'react-bootstrap';
import * as fcl from '@onflow/fcl';
import nipplejs from 'nipplejs';
import JOKIC_SEASON_DATA from './jokicSeasonData';
import './Museum.css';

/* ---- Tier look-up tables ---- */
const TIER_COLORS = {
  ULTIMATE: '#e600ff',
  LEGENDARY: '#ffd700',
  RARE: '#00bfff',
  FANDOM: '#40e0d0',
  COMMON: '#adb5bd',
};
const TIER_RANK = { ULTIMATE: 5, LEGENDARY: 4, RARE: 3, FANDOM: 2, COMMON: 1 };

/* ---- Moment badge tag → animated GIF URL ---- */
const _TS_CDN = 'https://www.nbatopshot.com/cdn-cgi/image/width=75,height=75,quality=80,format=webp/';
const BADGE_INFO = {
  topShotDebut:     { url: `${_TS_CDN}/img/momentTags/animated/topShotDebut.gif`,     label: 'Top Shot Debut' },
  rookieYear:       { url: `${_TS_CDN}/img/momentTags/animated/rookieYear.gif`,       label: 'Rookie Year' },
  rookieMint:       { url: `${_TS_CDN}/img/momentTags/animated/rookieMint.gif`,       label: 'Rookie Mint' },
  rookiePremiere:   { url: `${_TS_CDN}/img/momentTags/animated/rookiePremiere.gif`,   label: 'Rookie Premiere' },
  mvpYear:          { url: `${_TS_CDN}/img/momentTags/animated/mvpYear.gif`,          label: 'MVP Year' },
  championshipYear: { url: `${_TS_CDN}/img/momentTags/animated/championshipYear.gif`, label: 'Championship Year' },
  threeStars:       { url: `${_TS_CDN}/img/momentTags/animated/threeStars.gif`,       label: '3 Stars' },
};
const THREE_STARS_COMPONENTS = new Set(['rookieYear', 'rookiePremiere', 'topShotDebut']);

/** Given an edition's raw tags array, pick the badge GIFs to show. */
function resolveBadges(tags) {
  if (!tags || !tags.length) return [];
  const ids = new Set(tags);
  // If all three rookie badges present → show threeStars instead
  if ([...THREE_STARS_COMPONENTS].every(t => ids.has(t))) {
    ids.delete('rookieMint'); ids.delete('rookiePremiere'); ids.delete('rookieYear');
    ids.add('threeStars');
  }
  return [...ids].filter(id => BADGE_INFO[id]).map(id => BADGE_INFO[id]);
}

/* ---- Scene constants ---- */
const CW = 14;            // corridor width
const CH = 5.5;           // corridor height
const TV_SZ = 3;          // TV screen size
const TV_Y = 2.8;         // TV center height
const TV_GAP = 8;         // Z gap between TV pairs
const EYE_Y = 1.65;       // camera eye height
const SPEED = 6;           // walk speed  units/s
const VID_RANGE = 14;      // load video within this distance
const TEX_RANGE = 35;      // load image texture within this distance
const PLAQUE_RANGE = 10;   // show plaque within this distance
const LIGHT_SPACING = 12;  // ceiling light spacing
const CARPET_SPACING = 24; // floor carpet spacing
const CARPET_RADIUS = 2.2; // carpet circle radius
const MOUNT_RANGE = 50;    // only mount WallTV components within this distance
const MAX_VIDEOS = 4;      // max simultaneous video elements

/* ---- Shared geometries (created once, reused by every WallTV) ---- */
const _tvFrameGeo = new THREE.BoxGeometry(TV_SZ + 0.4, TV_SZ + 0.4, 0.06);
const _tvBezelGeo = new THREE.PlaneGeometry(TV_SZ + 0.15, TV_SZ + 0.15);
const _tvScreenGeo = new THREE.PlaneGeometry(TV_SZ, TV_SZ);
const _tvFixtureGeo = new THREE.BoxGeometry(1.8, 0.08, 0.12);
const _tvGlowStripGeo = new THREE.PlaneGeometry(1.6, 0.06);
const _tvGlowConeGeo = new THREE.PlaneGeometry(TV_SZ + 0.2, 0.35);
const _tvNoiseGeo = new THREE.PlaneGeometry(TV_SZ * 0.6, 0.08);
const _bannerBeamGeo = new THREE.BoxGeometry(CW - 0.5, 1.1, 0.3);
const _bannerStripGeo = new THREE.BoxGeometry(CW - 0.6, 0.08, 0.02);

/* ---- Shared materials (static, no per-instance variation) ---- */
const _tvFrameMat = new THREE.MeshBasicMaterial({ color: '#1a1a1a' });
const _tvFixtureMat = new THREE.MeshBasicMaterial({ color: '#222' });
const _tvGlowStripMat = new THREE.MeshBasicMaterial({ color: '#ffe8b0', transparent: true, opacity: 0.5 });
const _tvGlowConeMat = new THREE.MeshBasicMaterial({ color: '#fff5e0', transparent: true, opacity: 0.06, depthWrite: false });
const _tvNoiseMat = new THREE.MeshBasicMaterial({ color: '#FDB927', transparent: true, opacity: 0.15 });
const _tvEmptyScreenMat = new THREE.MeshBasicMaterial({ color: '#181830' });
const _bannerBeamMat = new THREE.MeshBasicMaterial({ color: '#0f1029' });
const _bannerGoldMat = new THREE.MeshBasicMaterial({ color: '#FDB927' });

/* ================================================================== */
/*  Museum – top-level data + routing between entrance & 3D scene      */
/* ================================================================== */
export default function Museum() {
  const [searchParams] = useSearchParams();
  const showcaseId = searchParams.get('showcaseId') || '';
  const [editions, setEditions] = useState([]);
  const [showcaseName, setShowcaseName] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [user, setUser] = useState({ loggedIn: null });
  const [ownershipLoaded, setOwnershipLoaded] = useState(false);
  const [entered, setEntered] = useState(false);
  const [locked, setLocked] = useState(false);
  const [muted, setMuted] = useState(false);
  const audioRef = useRef(null);
  const isMobile = useMemo(() =>
    ('ontouchstart' in window || navigator.maxTouchPoints > 0) && window.innerWidth < 1024
  , []);
  const mobileControls = useRef({ moveX: 0, moveY: 0, lookDX: 0, lookDY: 0 });

  useEffect(() => { fcl.currentUser().subscribe(setUser); }, []);

  /* Fetch editions – from showcase binder or default Jokic museum */
  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const url = showcaseId
          ? `/api/showcase/${encodeURIComponent(showcaseId)}`
          : '/api/museum';
        const r = await fetch(url);
        const j = await r.json();
        if (!r.ok) { setError(j.error || 'Load failed'); return; }
        setEditions(j.editions || []);
        if (j.showcaseName) setShowcaseName(j.showcaseName);
      } catch (e) { setError(e.message); }
      finally { setLoading(false); }
    })();
  }, [showcaseId]);

  /* Re-fetch with wallet for ownership (only for default Jokic museum) */
  useEffect(() => {
    if (showcaseId) { setOwnershipLoaded(false); return; }
    if (!user?.addr) { setOwnershipLoaded(false); return; }
    let cancelled = false;
    (async () => {
      try {
        const r = await fetch(`/api/museum?wallet=${user.addr}`);
        const j = await r.json();
        if (!cancelled && r.ok) { setEditions(j.editions || []); setOwnershipLoaded(true); }
      } catch { /* ignore */ }
    })();
    return () => { cancelled = true; };
  }, [user?.addr, showcaseId]);

  /* Deduplicate by playId */
  const deduped = useMemo(() => {
    const map = new Map();
    for (const ed of editions) {
      const key = ed.playId || ed.id;
      if (!map.has(key)) { map.set(key, { primary: ed, all: [ed] }); }
      else {
        const entry = map.get(key);
        entry.all.push(ed);
        if ((TIER_RANK[ed.tier] || 0) > (TIER_RANK[entry.primary.tier] || 0)) entry.primary = ed;
      }
    }
    return [...map.values()].map(({ primary, all }) => ({
      ...primary,
      userOwnedCount: all.reduce((s, p) => s + (p.userOwnedCount || 0), 0),
      tags: [...new Set(all.flatMap(p => p.tags || []))],
      parallels: all.length > 1
        ? all.map(p => ({ tier: p.tier, setName: p.setName, owned: (p.userOwnedCount || 0) > 0 }))
        : null,
    }));
  }, [editions]);

  /* Sort chronologically */
  const sortKey = (ed) => {
    if (ed.dateOfMoment) return ed.dateOfMoment;
    const m = (ed.nbaSeason || '').match(/\d{4}-(\d{2})/);
    if (m) { const y = parseInt(m[1], 10) + (m[1] < '50' ? 2000 : 1900); return `${y}-10-01T00:00:00Z`; }
    return 'Z';
  };
  const sorted = useMemo(() => [...deduped].sort((a, b) => sortKey(a).localeCompare(sortKey(b))), [deduped]);

  /* Group by season */
  const seasonGroups = useMemo(() => {
    const g = []; let cur = null;
    for (const ed of sorted) {
      const s = ed.nbaSeason || 'Unknown';
      if (s !== cur) { cur = s; g.push({ season: s, editions: [] }); }
      g[g.length - 1].editions.push(ed);
    }
    return g;
  }, [sorted]);

  const isOwned = useCallback((ed) => (ed.userOwnedCount || 0) > 0, []);
  const walletConnected = !!user?.addr;
  const ownedCount = ownershipLoaded ? sorted.filter(isOwned).length : 0;

  /* Compute 3D layout: positions for every TV, season banner, and season info panel */
  const layout = useMemo(() => {
    const items = [];
    let z = -10;
    for (const group of seasonGroups) {
      items.push({ type: 'season', season: group.season, count: group.editions.length, z });
      z -= 3;
      /* Season info panel – only for the default Jokic museum */
      if (!showcaseId) {
        const sData = JOKIC_SEASON_DATA[group.season];
        if (sData) {
          items.push({ type: 'seasonInfo', season: group.season, data: sData, z });
        }
      }
      z -= 5;
      for (let i = 0; i < group.editions.length; i += 2) {
        items.push({
          type: 'tv', edition: group.editions[i], side: 'left', owned: isOwned(group.editions[i]),
          pos: [-(CW / 2) + 0.02, TV_Y, z], rot: [0, Math.PI / 2, 0],
        });
        if (group.editions[i + 1]) {
          items.push({
            type: 'tv', edition: group.editions[i + 1], side: 'right', owned: isOwned(group.editions[i + 1]),
            pos: [(CW / 2) - 0.02, TV_Y, z], rot: [0, -Math.PI / 2, 0],
          });
        }
        z -= TV_GAP;
      }
      z -= 4;
    }
    return { items, length: Math.abs(z) + 10 };
  }, [seasonGroups, isOwned, showcaseId]);

  /* Pointer lock tracking */
  useEffect(() => {
    const h = () => setLocked(!!document.pointerLockElement);
    document.addEventListener('pointerlockchange', h);
    return () => document.removeEventListener('pointerlockchange', h);
  }, []);

  /* ---- Ambient music (royalty-free piano loop) ---- */
  useEffect(() => {
    if (!entered) {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
      }
      return;
    }

    let audio = audioRef.current;
    if (!audio) {
      audio = new Audio('/audio/museum-ambient.mp3');
      audio.loop = true;
      audio.volume = 0.25;
      audioRef.current = audio;
    }

    audio.muted = muted;
    audio.play().catch(() => {});

    return () => {
      audio.pause();
      audio.currentTime = 0;
    };
  }, [entered]);

  // Sync muted state
  useEffect(() => {
    if (audioRef.current) audioRef.current.muted = muted;
  }, [muted]);

  // M key handler
  useEffect(() => {
    if (!entered) return;
    const handler = (e) => {
      if (e.code === 'KeyM' && !e.repeat) setMuted(prev => !prev);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [entered]);

  const exitMuseum = useCallback(() => {
    if (document.pointerLockElement) document.exitPointerLock();
    setEntered(false);
  }, []);

  const resumePointerLock = useCallback(() => {
    const canvas = document.querySelector('.museum-3d-active canvas');
    if (canvas) canvas.requestPointerLock();
  }, []);

  /* ---------------------------------------------------------------- */
  /*  Entrance Screen                                                  */
  /* ---------------------------------------------------------------- */
  if (!entered) {
    return (
      <div className="museum-root">
        <div className="entrance-screen">
          <div className="entrance-content">
            <h1 className="entrance-title">{showcaseId ? (showcaseName || 'SHOWCASE MUSEUM') : 'THE JOKIĆ MUSEUM'}</h1>
            <p className="entrance-sub">
              {showcaseId
                ? 'A first-person walk through a curated NBA TopShot showcase'
                : 'A first-person walk through every Nikola Jokić NBA TopShot moment'}
            </p>

            {loading && (
              <div className="entrance-loading">
                <Spinner animation="border" variant="warning" size="sm" />
                <span>Loading moments…</span>
              </div>
            )}
            {error && <p className="entrance-error">{error}</p>}

            {!loading && !error && (
              <>
                <p className="entrance-count">
                  {sorted.length} unique moments across {seasonGroups.length} seasons
                </p>
                {!showcaseId && walletConnected && ownershipLoaded && (
                  <p className="entrance-owned">🎟️ You own {ownedCount} moments</p>
                )}
                {!showcaseId && walletConnected && !ownershipLoaded && (
                  <p className="entrance-owned">
                    <Spinner animation="border" size="sm" variant="warning" /> Checking collection…
                  </p>
                )}
                <button className="entrance-btn" onClick={() => setEntered(true)}>
                  Enter Museum
                </button>
                <div className="entrance-controls">
                  {isMobile ? (
                    <span>Use on-screen controls to navigate</span>
                  ) : (
                    <>
                      <span><kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> Move</span>
                      <span><kbd>Mouse</kbd> Look Around</span>
                      <span><kbd>M</kbd> Toggle Music</span>
                      <span><kbd>ESC</kbd> Pause</span>
                    </>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    );
  }

  /* ---------------------------------------------------------------- */
  /*  3D Scene                                                         */
  /* ---------------------------------------------------------------- */
  const numCeilingLights = Math.ceil(layout.length / LIGHT_SPACING);

  return (
    <div className="museum-root museum-3d-active">
      <Canvas
        camera={{ fov: 75, near: 0.1, far: 200, position: [0, EYE_Y, 2] }}
        gl={{ antialias: false, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.1 }}
        style={{ background: '#060610' }}
        frameloop="demand"
        onCreated={({ camera }) => camera.lookAt(0, EYE_Y, -10)}
      >
        <fog attach="fog" args={['#060610', 30, 100]} />
        <ambientLight intensity={0.35} color="#c8c0d8" />
        <directionalLight position={[2, CH, 5]} intensity={0.15} color="#ccbbaa" />

        {/* Ceiling light fixtures (visual only – no pointLights here, corridor uses baked/basic materials) */}
        {Array.from({ length: numCeilingLights }, (_, i) => (
          <group key={`cl-${i}`}>
            {/* Visible light fixture on ceiling */}
            <mesh position={[0, CH - 0.05, -i * LIGHT_SPACING - 8]}>
              <boxGeometry args={[1.2, 0.06, 0.4]} />
              <meshBasicMaterial color="#f0f0f0" />
            </mesh>
            {/* Small warm glow marker below fixture */}
            <mesh position={[0, CH - 0.15, -i * LIGHT_SPACING - 8]}>
              <planeGeometry args={[0.6, 0.02]} />
              <meshBasicMaterial color="#ffe8b0" transparent opacity={0.4} />
            </mesh>
          </group>
        ))}

        {/* Two moving pointLights that follow the camera for local illumination */}
        <CameraLights />

        <Corridor length={layout.length} />
        <FloorCarpets length={layout.length} />
        <Movement length={layout.length} isMobile={isMobile} mobileControls={mobileControls} />
        {!isMobile && <PointerLockControls />}
        <RenderLoop />

        <NearbyItems items={layout.items} />
      </Canvas>

      {/* HUD overlay */}
      <div className="hud">
        {!isMobile && locked && <div className="crosshair" />}

        {/* Showcase name banner */}
        {showcaseId && showcaseName && (
          <div className="showcase-name-hud">{showcaseName}</div>
        )}

        {!isMobile && !locked && (
          <div className="pause-overlay" onClick={resumePointerLock}>
            <div className="pause-box">
              <p className="pause-text">Click to look around</p>
              <p className="pause-hint">WASD to move · Mouse to look · M toggle music · ESC to pause</p>
              <button
                className="exit-btn"
                onClick={(e) => { e.stopPropagation(); exitMuseum(); }}
              >
                ← Exit Museum
              </button>
            </div>
          </div>
        )}
        {/* Music toggle button */}
        <button
          className="music-toggle-btn"
          onClick={() => setMuted(prev => !prev)}
          title={muted ? 'Unmute music (M)' : 'Mute music (M)'}
        >
          {muted ? '🔇' : '🔊'}
        </button>

        {isMobile && (
          <>
            <button className="mobile-exit-btn" onClick={exitMuseum}>✕</button>
            <MobileJoystick mobileControls={mobileControls} />
            <MobileLookPad mobileControls={mobileControls} />
          </>
        )}
      </div>
    </div>
  );
}

/* ================================================================== */
/*  CameraLights – two point lights that follow the player             */
/* ================================================================== */
function CameraLights() {
  const lightRef = useRef();
  const { camera } = useThree();

  useFrame(() => {
    if (lightRef.current) {
      lightRef.current.position.set(camera.position.x, CH - 0.3, camera.position.z - 2);
    }
  });

  return (
    <pointLight ref={lightRef} intensity={1.2} distance={22} color="#fff5e0" decay={2} />
  );
}

/* ================================================================== */
/*  RenderLoop – invalidate only when camera is moving or user active  */
/* ================================================================== */
function RenderLoop() {
  const lastPos = useRef(new THREE.Vector3());
  const lastQuat = useRef(new THREE.Quaternion());

  useFrame(({ camera, invalidate }) => {
    // Always invalidate – camera motion is detected by the movement system
    // but we also need continuous render for video textures and smooth look.
    // The real savings come from reduced draw calls, not skipping frames.
    invalidate();
  });
  return null;
}

/* ================================================================== */
/*  NearbyItems – only mounts TVs/banners within MOUNT_RANGE of camera */
/* ================================================================== */
function NearbyItems({ items }) {
  const { camera } = useThree();
  const [visible, setVisible] = useState([]);
  const frameCount = useRef(0);

  useFrame(() => {
    frameCount.current++;
    if (frameCount.current % 20 !== 0) return; // check every ~20 frames
    const camZ = camera.position.z;
    const next = [];
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const itemZ = item.z != null ? item.z : item.pos[2];
      if (Math.abs(camZ - itemZ) < MOUNT_RANGE) next.push(i);
    }
    setVisible(prev => {
      if (prev.length === next.length && prev.every((v, j) => v === next[j])) return prev;
      return next;
    });
  });

  return (
    <>
      {visible.map(i => {
        const item = items[i];
        if (item.type === 'season')
          return <SeasonBanner key={`s-${i}`} season={item.season} count={item.count} z={item.z} />;
        if (item.type === 'seasonInfo')
          return <SeasonInfoPanel key={`si-${i}`} season={item.season} data={item.data} z={item.z} />;
        return <WallTV key={`tv-${i}`} edition={item.edition} pos={item.pos} rot={item.rot} owned={item.owned} />;
      })}
    </>
  );
}

/* ================================================================== */
/*  Corridor – floor, walls, ceiling geometry (meshBasicMaterial = no  */
/*  per-pixel lighting calc → huge GPU savings)                        */
/* ================================================================== */
function Corridor({ length }) {
  /* Wooden floor texture – light natural maple planks */
  const floorTex = useMemo(() => {
    const c = document.createElement('canvas');
    c.width = 512; c.height = 512;
    const ctx = c.getContext('2d');
    // Light honey-maple base
    ctx.fillStyle = '#d4b87a';
    ctx.fillRect(0, 0, 512, 512);
    // Plank gaps (horizontal lines for lengthwise planks)
    const plankH = 64;
    for (let y = 0; y < 512; y += plankH) {
      // Slight color variation per plank
      const shade = (y * 7 % 30) - 15;
      ctx.fillStyle = `rgb(${212 + shade}, ${184 + shade}, ${122 + shade})`;
      ctx.fillRect(0, y + 2, 512, plankH - 2);
      // Plank gap line
      ctx.fillStyle = '#b89860';
      ctx.fillRect(0, y, 512, 2);
      // Subtle wood grain lines within each plank
      ctx.strokeStyle = 'rgba(160,130,70,0.10)';
      ctx.lineWidth = 1;
      for (let g = 0; g < 3; g++) {
        const gy = y + 12 + g * 18 + ((y * 13 + g * 7) % 8);
        ctx.beginPath(); ctx.moveTo(0, gy); ctx.lineTo(512, gy); ctx.stroke();
      }
    }
    const t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(CW / 4, length / 4);
    return t;
  }, [length]);

  /* Wall texture – muted sage/teal-gray gallery walls */
  const wallTex = useMemo(() => {
    const c = document.createElement('canvas');
    c.width = 512; c.height = 512;
    const ctx = c.getContext('2d');
    // Sage green-gray base matching reference gallery
    ctx.fillStyle = '#6b7f7f';
    ctx.fillRect(0, 0, 512, 512);
    // Very subtle vertical texture for matte paint feel
    for (let x = 0; x < 512; x += 2) {
      const v = Math.sin(x * 0.4) * 2 + Math.sin(x * 2.1) * 1;
      ctx.fillStyle = `rgba(${107 + v},${127 + v},${127 + v},0.3)`;
      ctx.fillRect(x, 0, 1, 512);
    }
    // Subtle lighting gradient – lighter toward top
    const grad = ctx.createLinearGradient(0, 0, 0, 512);
    grad.addColorStop(0, 'rgba(180,195,195,0.12)');
    grad.addColorStop(0.3, 'rgba(140,155,155,0.04)');
    grad.addColorStop(0.7, 'rgba(80,95,95,0.02)');
    grad.addColorStop(1, 'rgba(50,65,65,0.10)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 512, 512);
    const t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(length / 6, 1);
    return t;
  }, [length]);

  /* Ceiling texture – clean white with subtle panel grid */
  const ceilTex = useMemo(() => {
    const c = document.createElement('canvas');
    c.width = 256; c.height = 256;
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#e8e8e8';
    ctx.fillRect(0, 0, 256, 256);
    // Subtle recessed panel grid
    ctx.strokeStyle = '#d0d0d0';
    ctx.lineWidth = 1;
    for (let i = 0; i <= 256; i += 64) {
      ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, 256); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(256, i); ctx.stroke();
    }
    const t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(CW / 4, length / 4);
    return t;
  }, [length]);

  const midZ = -length / 2;

  return (
    <group>
      {/* Floor – polished hardwood */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, midZ]}>
        <planeGeometry args={[CW, length]} />
        <meshStandardMaterial map={floorTex} roughness={0.35} metalness={0.15} color="#c8a870" />
      </mesh>

      {/* Ceiling */}
      <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, CH, midZ]}>
        <planeGeometry args={[CW, length]} />
        <meshBasicMaterial map={ceilTex} />
      </mesh>

      {/* Left wall */}
      <mesh rotation={[0, Math.PI / 2, 0]} position={[-CW / 2, CH / 2, midZ]}>
        <planeGeometry args={[length, CH]} />
        <meshBasicMaterial map={wallTex} />
      </mesh>
      {/* Right wall */}
      <mesh rotation={[0, -Math.PI / 2, 0]} position={[CW / 2, CH / 2, midZ]}>
        <planeGeometry args={[length, CH]} />
        <meshBasicMaterial map={wallTex} />
      </mesh>

      {/* Baseboard – left (wood tone) */}
      <mesh position={[-CW / 2 + 0.06, 0.12, midZ]} rotation={[0, Math.PI / 2, 0]}>
        <planeGeometry args={[length, 0.24]} />
        <meshBasicMaterial color="#b89860" />
      </mesh>
      {/* Baseboard – right (wood tone) */}
      <mesh position={[CW / 2 - 0.06, 0.12, midZ]} rotation={[0, -Math.PI / 2, 0]}>
        <planeGeometry args={[length, 0.24]} />
        <meshBasicMaterial color="#b89860" />
      </mesh>

      {/* Crown molding – left */}
      <mesh position={[-CW / 2 + 0.06, CH - 0.06, midZ]} rotation={[0, Math.PI / 2, 0]}>
        <planeGeometry args={[length, 0.12]} />
        <meshBasicMaterial color="#d0d0d0" />
      </mesh>
      {/* Crown molding – right */}
      <mesh position={[CW / 2 - 0.06, CH - 0.06, midZ]} rotation={[0, -Math.PI / 2, 0]}>
        <planeGeometry args={[length, 0.12]} />
        <meshBasicMaterial color="#d0d0d0" />
      </mesh>

      {/* ── Wainscoting ── */}
      {/* Chair rail – left */}
      <mesh position={[-CW / 2 + 0.07, 1.1, midZ]} rotation={[0, Math.PI / 2, 0]}>
        <planeGeometry args={[length, 0.08]} />
        <meshBasicMaterial color="#b89860" />
      </mesh>
      {/* Chair rail – right */}
      <mesh position={[CW / 2 - 0.07, 1.1, midZ]} rotation={[0, -Math.PI / 2, 0]}>
        <planeGeometry args={[length, 0.08]} />
        <meshBasicMaterial color="#b89860" />
      </mesh>
      {/* Darker lower wall panel – left */}
      <mesh position={[-CW / 2 + 0.07, 0.65, midZ]} rotation={[0, Math.PI / 2, 0]}>
        <planeGeometry args={[length, 0.82]} />
        <meshBasicMaterial color="#4a5c5c" transparent opacity={0.45} depthWrite={false} />
      </mesh>
      {/* Darker lower wall panel – right */}
      <mesh position={[CW / 2 - 0.07, 0.65, midZ]} rotation={[0, -Math.PI / 2, 0]}>
        <planeGeometry args={[length, 0.82]} />
        <meshBasicMaterial color="#4a5c5c" transparent opacity={0.45} depthWrite={false} />
      </mesh>

      {/* Back wall */}
      <mesh position={[0, CH / 2, -length]}>
        <planeGeometry args={[CW, CH]} />
        <meshBasicMaterial color="#5a6e6e" />
      </mesh>
      {/* Entrance wall */}
      <mesh rotation={[0, Math.PI, 0]} position={[0, CH / 2, 5]}>
        <planeGeometry args={[CW, CH]} />
        <meshBasicMaterial color="#5a6e6e" />
      </mesh>

      {/* ── Logo medallions on end walls ── */}
      <EndWallMedallion z={-length + 0.01} flipY={false} />
      <EndWallMedallion z={4.99} flipY={true} />
    </group>
  );
}

/* ================================================================== */
/*  EndWallMedallion – logo emblem centred on an end wall               */
/* ================================================================== */
const _medallionGeo = new THREE.CircleGeometry(1.6, 64);

function EndWallMedallion({ z, flipY }) {
  const logoTex = useLoader(THREE.TextureLoader, '/images/Logo.jpg');
  return (
    <mesh
      geometry={_medallionGeo}
      position={[0, CH / 2, z]}
      rotation={flipY ? [0, Math.PI, 0] : [0, 0, 0]}
    >
      <meshBasicMaterial map={logoTex} transparent opacity={0.6} depthWrite={false} />
    </mesh>
  );
}

/* ================================================================== */
/*  FloorCarpets – circular logo carpets along the corridor centre     */
/* ================================================================== */
const _carpetGeo = new THREE.CircleGeometry(CARPET_RADIUS, 48);

function FloorCarpets({ length }) {
  const logoTex = useLoader(THREE.TextureLoader, '/images/Logo.jpg');

  const count = Math.floor(length / CARPET_SPACING);

  return (
    <group>
      {Array.from({ length: count }, (_, i) => {
        const z = -(i * CARPET_SPACING + 14);   // offset so first carpet is past entrance
        return (
          <mesh
            key={`carpet-${i}`}
            geometry={_carpetGeo}
            rotation={[-Math.PI / 2, 0, 0]}
            position={[0, 0.005, z]}
          >
            <meshBasicMaterial
              map={logoTex}
              transparent
              opacity={0.35}
              depthWrite={false}
            />
          </mesh>
        );
      })}
    </group>
  );
}

/* ================================================================== */
/*  WASD Movement                                                      */
/* ================================================================== */
/* ================================================================== */
/*  MobileJoystick – nipplejs-based analog stick (bottom-left)         */
/* ================================================================== */
function MobileJoystick({ mobileControls }) {
  const containerRef = useRef(null);

  useEffect(() => {
    if (!containerRef.current) return;
    const mgr = nipplejs.create({
      zone: containerRef.current,
      mode: 'static',
      position: { left: '80px', bottom: '80px' },
      size: 120,
      color: 'rgba(253, 185, 39, 0.5)',
      restOpacity: 0.6,
    });

    mgr.on('move', (_, data) => {
      if (!data.vector) return;
      mobileControls.current.moveX = data.vector.x;  // -1 left … +1 right
      mobileControls.current.moveY = data.vector.y;  // -1 back … +1 forward
    });
    mgr.on('end', () => {
      mobileControls.current.moveX = 0;
      mobileControls.current.moveY = 0;
    });

    return () => mgr.destroy();
  }, [mobileControls]);

  return <div ref={containerRef} className="mobile-joystick-zone" />;
}

/* ================================================================== */
/*  MobileLookPad – right-side touch drag to rotate camera             */
/* ================================================================== */
function MobileLookPad({ mobileControls }) {
  const onTouch = useCallback((e) => {
    e.preventDefault();
    const touch = e.touches[0];
    const startX = touch.clientX;
    const startY = touch.clientY;
    let lastX = startX;
    let lastY = startY;

    const onMove = (ev) => {
      const t = ev.touches[0];
      mobileControls.current.lookDX = (t.clientX - lastX) * 0.004;
      mobileControls.current.lookDY = (t.clientY - lastY) * 0.004;
      lastX = t.clientX;
      lastY = t.clientY;
    };
    const onEnd = () => {
      mobileControls.current.lookDX = 0;
      mobileControls.current.lookDY = 0;
      window.removeEventListener('touchmove', onMove);
      window.removeEventListener('touchend', onEnd);
      window.removeEventListener('touchcancel', onEnd);
    };
    window.addEventListener('touchmove', onMove, { passive: false });
    window.addEventListener('touchend', onEnd);
    window.addEventListener('touchcancel', onEnd);
  }, [mobileControls]);

  return (
    <div
      className="mobile-look-zone"
      onTouchStart={onTouch}
    />
  );
}

/* ================================================================== */
/*  Movement – keyboard (desktop) + joystick/look (mobile)             */
/* ================================================================== */
function Movement({ length, isMobile, mobileControls }) {
  const { camera } = useThree();
  const keys = useRef({});

  useEffect(() => {
    const dn = (e) => { keys.current[e.code] = true; };
    const up = (e) => { keys.current[e.code] = false; };
    window.addEventListener('keydown', dn);
    window.addEventListener('keyup', up);
    return () => { window.removeEventListener('keydown', dn); window.removeEventListener('keyup', up); };
  }, []);

  const dir = useMemo(() => new THREE.Vector3(), []);
  const right = useMemo(() => new THREE.Vector3(), []);
  const euler = useMemo(() => new THREE.Euler(0, 0, 0, 'YXZ'), []);

  useFrame((_, delta) => {
    // Desktop requires pointer lock; mobile is always active
    if (!isMobile && !document.pointerLockElement) return;
    const dt = Math.min(delta, 0.1);
    const spd = SPEED * dt;

    // Mobile: apply look deltas from touch-drag
    if (isMobile && mobileControls?.current) {
      const { lookDX, lookDY } = mobileControls.current;
      if (lookDX || lookDY) {
        euler.setFromQuaternion(camera.quaternion);
        euler.y -= lookDX;
        euler.x -= lookDY;
        euler.x = THREE.MathUtils.clamp(euler.x, -Math.PI / 3, Math.PI / 3);
        camera.quaternion.setFromEuler(euler);
        // Consume the delta so it doesn't accumulate
        mobileControls.current.lookDX = 0;
        mobileControls.current.lookDY = 0;
      }
    }

    camera.getWorldDirection(dir);
    dir.y = 0; dir.normalize();
    right.crossVectors(dir, camera.up).normalize();

    // Keyboard controls (desktop)
    if (keys.current.KeyW || keys.current.ArrowUp) camera.position.addScaledVector(dir, spd);
    if (keys.current.KeyS || keys.current.ArrowDown) camera.position.addScaledVector(dir, -spd);
    if (keys.current.KeyA || keys.current.ArrowLeft) camera.position.addScaledVector(right, -spd);
    if (keys.current.KeyD || keys.current.ArrowRight) camera.position.addScaledVector(right, spd);

    // Mobile: analog joystick movement
    if (isMobile && mobileControls?.current) {
      const { moveX, moveY } = mobileControls.current;
      if (moveY) camera.position.addScaledVector(dir, spd * moveY);
      if (moveX) camera.position.addScaledVector(right, spd * moveX);
    }

    // Keep inside corridor
    camera.position.x = THREE.MathUtils.clamp(camera.position.x, -CW / 2 + 0.6, CW / 2 - 0.6);
    camera.position.z = THREE.MathUtils.clamp(camera.position.z, -length + 1, 4);
    camera.position.y = EYE_Y;
  });

  return null;
}

/* ================================================================== */
/*  Season Banner – arch between seasons                               */
/* ================================================================== */
function SeasonBanner({ season, count, z }) {
  return (
    <group position={[0, 0, z]}>
      {/* Archway top beam */}
      <mesh position={[0, CH - 0.65, 0]} geometry={_bannerBeamGeo} material={_bannerBeamMat} />
      {/* Gold accent strip */}
      <mesh position={[0, CH - 0.08, 0.16]} geometry={_bannerStripGeo} material={_bannerGoldMat} />
      {/* Season label */}
      <Html
        transform
        center
        position={[0, CH - 0.65, 0.2]}
        distanceFactor={8}
        className="season-banner-html"
        zIndexRange={[100, 0]}
      >
        <div className="season-banner-inner">
          <span className="sb-year">{season}</span>
          <span className="sb-count">{count} moment{count !== 1 ? 's' : ''}</span>
        </div>
      </Html>
    </group>
  );
}

/* ================================================================== */
/*  SeasonInfoPanel – centered walk-through panel showing Jokić        */
/*  season & playoff data (only in default museum, always visible)     */
/* ================================================================== */
const ROUND_LABELS = { R1: 'First Round', R2: 'Second Round', WCF: 'West Finals', ECF: 'East Finals', Finals: 'NBA Finals' };

function SeasonInfoPanel({ season, data, z }) {
  const { seasonAvg, teamRecord, seed, conference, awards, playoffs } = data;
  const hasPlayoffs = playoffs && playoffs.length > 0;

  return (
    <group position={[0, 0, z]}>
      {/* Left-of-centre panel – Season Overview */}
      <Html
        transform
        center
        position={[hasPlayoffs ? -3 : 0, CH / 2 - 0.4, 0]}
        distanceFactor={6}
        className="season-info-html"
        zIndexRange={[100, 0]}
      >
        <div className="season-info-panel">
          <div className="sip-header">
            <span className="sip-season">{season}</span>
            {awards.length > 0 && (
              <div className="sip-awards">
                {awards.map((a, i) => (
                  <span key={i} className={`sip-award ${a === 'NBA Champion' ? 'sip-award-champ' : a === 'Finals MVP' ? 'sip-award-fmvp' : 'sip-award-mvp'}`}>
                    {a === 'NBA Champion' ? '🏆 ' : a === 'Finals MVP' ? '🏆 ' : '⭐ '}{a}
                  </span>
                ))}
              </div>
            )}
          </div>

          <div className="sip-section">
            <div className="sip-section-title">Nuggets Record</div>
            <div className="sip-record">
              <span className="sip-record-val">{teamRecord.wins}-{teamRecord.losses}</span>
              <span className="sip-seed">#{seed} Seed ({conference})</span>
            </div>
          </div>

          <div className="sip-section">
            <div className="sip-section-title">Jokić Season Averages</div>
            <div className="sip-avg-grid">
              <div className="sip-avg"><span className="sip-avg-val">{seasonAvg.ppg}</span><span className="sip-avg-lbl">PPG</span></div>
              <div className="sip-avg"><span className="sip-avg-val">{seasonAvg.rpg}</span><span className="sip-avg-lbl">RPG</span></div>
              <div className="sip-avg"><span className="sip-avg-val">{seasonAvg.apg}</span><span className="sip-avg-lbl">APG</span></div>
              <div className="sip-avg"><span className="sip-avg-val">{seasonAvg.spg}</span><span className="sip-avg-lbl">SPG</span></div>
              <div className="sip-avg"><span className="sip-avg-val">{seasonAvg.bpg}</span><span className="sip-avg-lbl">BPG</span></div>
            </div>
            <div className="sip-pct-row">
              <span>{seasonAvg.fgPct}% FG</span>
              <span>{seasonAvg.threePct}% 3P</span>
              <span>{seasonAvg.ftPct}% FT</span>
            </div>
          </div>
        </div>
      </Html>

      {/* Right-of-centre panel – Playoff Results (grid layout) */}
      {hasPlayoffs && (
        <Html
          transform
          center
          position={[3.2, CH / 2 - 0.4, 0]}
          distanceFactor={6}
          className="season-info-html"
          zIndexRange={[100, 0]}
        >
          <div className="sip-playoffs-grid-wrap">
            <div className="sip-playoffs-title">PLAYOFFS</div>
            <div className={`sip-playoffs-grid ${playoffs.length <= 2 ? 'sip-grid-single' : ''}`}>
              {playoffs.map((series, si) => {
                const isWin = series.result === 'W';
                return (
                  <div key={si} className={`sip-series-card ${isWin ? 'sip-series-win' : 'sip-series-loss'}`}>
                    <div className="sip-series-header">
                      <span className="sip-round">{ROUND_LABELS[series.round] || series.round}</span>
                      <span className={`sip-series-result ${isWin ? 'sip-win' : 'sip-loss'}`}>
                        {isWin ? 'W' : 'L'} {series.seriesScore}
                      </span>
                    </div>
                    <div className="sip-opponent">
                      vs ({series.opponentSeed}) {series.opponent}
                    </div>
                    {series.note && <div className="sip-series-note">{series.note}</div>}

                    <table className="sip-game-table">
                      <thead>
                        <tr>
                          <th>G</th><th></th><th>Score</th><th>PTS</th><th>REB</th><th>AST</th>
                        </tr>
                      </thead>
                      <tbody>
                        {series.games.map((g, gi) => (
                          <tr key={gi} className={g.result === 'W' ? 'sip-game-w' : 'sip-game-l'}>
                            <td>{g.game}</td>
                            <td className={g.result === 'W' ? 'sip-gw' : 'sip-gl'}>{g.result}</td>
                            <td>{g.denScore}-{g.oppScore}{g.ot === true ? ' OT' : g.ot ? ` ${g.ot}` : ''}</td>
                            <td className="sip-pts">{g.pts}</td>
                            <td>{g.reb}</td>
                            <td>{g.ast}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                );
              })}
            </div>
          </div>
        </Html>
      )}
    </group>
  );
}

/* ================================================================== */
/*  Wall TV – screen + plaque with proximity-based loading             */
/* ================================================================== */
let activeVideoCount = 0; // global counter for concurrent video elements

const WallTV = React.memo(function WallTV({ edition, pos, rot, owned }) {
  const { camera } = useThree();
  const [imgTex, setImgTex] = useState(null);
  const [vidTex, setVidTex] = useState(null);
  const videoRef = useRef(null);
  const loadingImg = useRef(false);
  const frameIdx = useRef(Math.floor(Math.random() * 30)); // stagger checks
  const [showPlaque, setShowPlaque] = useState(false);

  const posVec = useMemo(() => new THREE.Vector3(...pos), [pos]);
  const tierColor = TIER_COLORS[edition.tier] || '#adb5bd';

  useFrame(() => {
    frameIdx.current++;
    if (frameIdx.current % 30 !== 0) return; // check every ~30 frames

    const dist = camera.position.distanceTo(posVec);

    // Image texture
    if (dist < TEX_RANGE && !imgTex && !loadingImg.current && edition.imageUrl) {
      loadingImg.current = true;
      new THREE.TextureLoader().load(
        edition.imageUrl,
        (t) => { t.colorSpace = THREE.SRGBColorSpace; setImgTex(t); },
        undefined,
        () => { loadingImg.current = false; }
      );
    }

    // Video – respect global cap
    if (dist < VID_RANGE && !videoRef.current && edition.videoUrl && activeVideoCount < MAX_VIDEOS) {
      activeVideoCount++;
      const v = document.createElement('video');
      v.crossOrigin = 'anonymous';
      v.loop = true;
      v.muted = true;
      v.playsInline = true;
      v.autoplay = true;
      v.preload = 'auto';
      v.addEventListener('canplay', () => { v.play().catch(() => {}); }, { once: true });
      v.addEventListener('error', () => {
        // Video failed to load – release the slot so images still show
        if (videoRef.current === v) {
          videoRef.current = null;
          activeVideoCount = Math.max(0, activeVideoCount - 1);
        }
      }, { once: true });
      v.src = edition.videoUrl;
      videoRef.current = v;
      const vt = new THREE.VideoTexture(v);
      vt.colorSpace = THREE.SRGBColorSpace;
      setVidTex(vt);
    } else if (dist >= VID_RANGE + 5 && videoRef.current) {
      videoRef.current.pause();
      videoRef.current.removeAttribute('src');
      videoRef.current.load();
      videoRef.current = null;
      activeVideoCount = Math.max(0, activeVideoCount - 1);
      if (vidTex) vidTex.dispose();
      setVidTex(null);
    }

    // Plaque
    const near = dist < PLAQUE_RANGE;
    if (near !== showPlaque) setShowPlaque(near);
  });

  // Cleanup
  useEffect(() => () => {
    if (videoRef.current) {
      videoRef.current.pause();
      videoRef.current.removeAttribute('src');
      videoRef.current.load();
      videoRef.current = null;
      activeVideoCount = Math.max(0, activeVideoCount - 1);
    }
  }, []);

  const activeTex = vidTex || imgTex;

  const dateStr = edition.dateOfMoment
    ? new Date(edition.dateOfMoment).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    : '';
  const stats = edition.gameStats || {};
  const hasStats = stats.points != null || stats.rebounds != null || stats.assists != null;
  const badges = useMemo(() => resolveBadges(edition.tags), [edition.tags]);

  return (
    <group position={pos} rotation={rot}>
      {/* ── Moment badge GIFs above the TV ── */}
      {badges.length > 0 && showPlaque && (
        <Html
          transform
          position={[0, TV_SZ / 2 + 0.75, 0.02]}
          center
          distanceFactor={5}
          className="badge-row-html"
          zIndexRange={[100, 0]}
        >
          <div className="badge-row">
            {badges.map((b, i) => (
              <img key={i} src={b.url} alt={b.label} title={b.label} className="badge-gif" />
            ))}
          </div>
        </Html>
      )}

      {/* ── Picture frame accent light ── */}
      <mesh position={[0, TV_SZ / 2 + 0.38, -0.06]} geometry={_tvFixtureGeo} material={_tvFixtureMat} />
      {/* Warm glow strip below the fixture */}
      <mesh position={[0, TV_SZ / 2 + 0.30, 0.01]} geometry={_tvGlowStripGeo} material={_tvGlowStripMat} />
      {/* Glow cone – soft warm triangle of light on the frame */}
      <mesh position={[0, TV_SZ / 2 + 0.15, 0.005]} geometry={_tvGlowConeGeo} material={_tvGlowConeMat} />

      {/* TV outer frame */}
      <mesh position={[0, 0, -0.04]} geometry={_tvFrameGeo} material={_tvFrameMat} />

      {/* Tier-color bezel */}
      <mesh position={[0, 0, -0.015]} geometry={_tvBezelGeo}>
        <meshBasicMaterial color={tierColor} />
      </mesh>

      {/* Screen */}
      <mesh position={[0, 0, 0.005]} geometry={_tvScreenGeo}>
        {activeTex ? (
          <meshBasicMaterial key="tex" map={activeTex} toneMapped={false} />
        ) : (
          <meshBasicMaterial key="empty" color="#181830" />
        )}
      </mesh>

      {/* Static noise overlay when no image loaded yet */}
      {!activeTex && (
        <mesh position={[0, TV_SZ / 2 - 0.3, 0.01]} geometry={_tvNoiseGeo} material={_tvNoiseMat} />
      )}

      {/* Owned badge */}
      {owned && (
        <Html
          transform
          position={[TV_SZ / 2 - 0.35, TV_SZ / 2 - 0.25, 0.02]}
          distanceFactor={4}
          className="owned-badge-html"
          zIndexRange={[100, 0]}
        >
          <span className="owned-badge-inner">✓ OWNED</span>
        </Html>
      )}

      {/* Plaque below TV – title, stats, ownership */}
      {showPlaque && (
        <Html
          transform
          position={[0, -(TV_SZ / 2 + 0.9), 0.06]}
          center
          distanceFactor={5}
          className="plaque-html"
          zIndexRange={[100, 0]}
        >
          <div className="plaque-3d" style={{ '--tier-color': tierColor }}>
            <div className="p3d-header">
              <span className="p3d-tier" style={{ color: tierColor }}>{edition.tier}</span>
              {edition.playCategory && <span className="p3d-cat">{edition.playCategory}</span>}
            </div>
            <div className="p3d-name">{edition.setName}</div>
            {edition.shortDescription && <div className="p3d-desc">{edition.shortDescription}</div>}
            {dateStr && <div className="p3d-date">{dateStr}{edition.teamAtMoment ? ` • ${edition.teamAtMoment}` : ''}</div>}
            {hasStats && (
              <div className="p3d-stats">
                {stats.points != null && (
                  <div className="p3d-stat"><span className="p3d-val">{stats.points}</span><span className="p3d-lbl">PTS</span></div>
                )}
                {stats.rebounds != null && (
                  <div className="p3d-stat"><span className="p3d-val">{stats.rebounds}</span><span className="p3d-lbl">REB</span></div>
                )}
                {stats.assists != null && (
                  <div className="p3d-stat"><span className="p3d-val">{stats.assists}</span><span className="p3d-lbl">AST</span></div>
                )}
                {stats.steals != null && stats.steals > 0 && (
                  <div className="p3d-stat"><span className="p3d-val">{stats.steals}</span><span className="p3d-lbl">STL</span></div>
                )}
                {stats.blocks != null && stats.blocks > 0 && (
                  <div className="p3d-stat"><span className="p3d-val">{stats.blocks}</span><span className="p3d-lbl">BLK</span></div>
                )}
              </div>
            )}
            {/* Serial + Low Ask – prominent row */}
            {(edition.flowSerialNumber || (edition.lowAsk != null && edition.lowAsk > 0)) && (() => {
              const sn = parseInt(edition.flowSerialNumber, 10);
              const jn = parseInt(edition.jerseyNumber, 10);
              const cc = edition.circulationCount;
              const isFirst = sn === 1;
              const isJersey = !isFirst && jn > 0 && sn === jn;
              const isPerfect = !isFirst && cc > 0 && sn === cc;
              const specialClass = isFirst ? 'serial-first' : isJersey ? 'serial-jersey' : isPerfect ? 'serial-perfect' : '';
              return (
                <div className={`p3d-serial-row ${specialClass}`}>
                  {edition.flowSerialNumber && (
                    <span className="p3d-serial-num">
                      {isFirst && <span className="serial-icon" title="First Serial">👑</span>}
                      {isJersey && <span className="serial-icon" title="Jersey Serial">🎽</span>}
                      {isPerfect && <span className="serial-icon" title="Perfect Serial">🎯</span>}
                      Serial <strong>#{edition.flowSerialNumber}</strong>
                      {isFirst && <span className="serial-tag">FIRST</span>}
                      {isJersey && <span className="serial-tag">JERSEY</span>}
                      {isPerfect && <span className="serial-tag">PERFECT</span>}
                    </span>
                  )}
                  {edition.lowAsk != null && edition.lowAsk > 0 && (
                    <span className="p3d-lowask">Low Ask <strong>${edition.lowAsk}</strong></span>
                  )}
                </div>
              );
            })()}
            {/* Mint / Ownership */}
            {(owned || edition.circulationCount) && (
              <div className="p3d-ownership">
                {owned && <span className="p3d-own-yes">✓ You own {edition.userOwnedCount || 1}</span>}
                {edition.circulationCount && (
                  <span className="p3d-circulation">/{edition.circulationCount} minted</span>
                )}
              </div>
            )}
            {edition.parallels && (
              <div className="p3d-parallels">
                {edition.parallels.map((p, i) => (
                  <span
                    key={i}
                    className={`p3d-badge ${p.owned ? 'p3d-badge-owned' : ''}`}
                    style={{ borderColor: TIER_COLORS[p.tier] || '#adb5bd', color: TIER_COLORS[p.tier] || '#adb5bd' }}
                  >
                    {p.tier}{p.owned ? ' ✓' : ''}
                  </span>
                ))}
              </div>
            )}
          </div>
        </Html>
      )}

      {/* Description plaque – beside the TV (offset to the right in local space) */}
      {showPlaque && (edition.description || edition.shortDescription) && (
        <Html
          transform
          position={[TV_SZ / 2 + 2.2, 0, 0.06]}
          center
          distanceFactor={5}
          className="plaque-html"
        >
          <div className="desc-plaque">
            <div className="dp-label">About this Moment</div>
            <div className="dp-text">{edition.description || edition.shortDescription}</div>
          </div>
        </Html>
      )}
    </group>
  );
});
