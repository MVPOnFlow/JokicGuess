import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Canvas, useFrame, useThree, useLoader } from '@react-three/fiber';
import { PointerLockControls, Html } from '@react-three/drei';
import * as THREE from 'three';
import { Spinner } from 'react-bootstrap';
import * as fcl from '@onflow/fcl';
import nipplejs from 'nipplejs';
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

  /* Compute 3D layout: positions for every TV and season banner */
  const layout = useMemo(() => {
    const items = [];
    let z = -10;
    for (const group of seasonGroups) {
      items.push({ type: 'season', season: group.season, count: group.editions.length, z });
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
  }, [seasonGroups, isOwned]);

  /* Pointer lock tracking */
  useEffect(() => {
    const h = () => setLocked(!!document.pointerLockElement);
    document.addEventListener('pointerlockchange', h);
    return () => document.removeEventListener('pointerlockchange', h);
  }, []);

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
        gl={{ antialias: true, toneMapping: THREE.LinearToneMapping, toneMappingExposure: 1.0 }}
        style={{ background: '#080812' }}
        frameloop="demand"
        onCreated={({ camera }) => camera.lookAt(0, EYE_Y, -10)}
      >
        <fog attach="fog" args={['#080812', 12, 65]} />
        <ambientLight intensity={0.7} color="#d4d4d4" />
        <directionalLight position={[2, CH, 5]} intensity={0.3} color="#ccbbaa" />

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
        {!isMobile && !locked && (
          <div className="pause-overlay" onClick={resumePointerLock}>
            <div className="pause-box">
              <p className="pause-text">Click to look around</p>
              <p className="pause-hint">WASD to move · Mouse to look · ESC to pause</p>
              <button
                className="exit-btn"
                onClick={(e) => { e.stopPropagation(); exitMuseum(); }}
              >
                ← Exit Museum
              </button>
            </div>
          </div>
        )}
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
  const frontRef = useRef();
  const backRef = useRef();
  const { camera } = useThree();

  useFrame(() => {
    if (frontRef.current) {
      frontRef.current.position.set(camera.position.x, CH - 0.5, camera.position.z - 4);
    }
    if (backRef.current) {
      backRef.current.position.set(camera.position.x, CH - 0.5, camera.position.z + 4);
    }
  });

  return (
    <>
      <pointLight ref={frontRef} intensity={1.0} distance={20} color="#fff5e0" decay={2} />
      <pointLight ref={backRef} intensity={0.6} distance={15} color="#f0e8d8" decay={2} />
    </>
  );
}

/* ================================================================== */
/*  RenderLoop – forces continuous render (since we use frameloop=demand) */
/* ================================================================== */
function RenderLoop() {
  useFrame(({ invalidate }) => { invalidate(); });
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
      const itemZ = item.type === 'season' ? item.z : item.pos[2];
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
        return item.type === 'season'
          ? <SeasonBanner key={`s-${i}`} season={item.season} count={item.count} z={item.z} />
          : <WallTV key={`tv-${i}`} edition={item.edition} pos={item.pos} rot={item.rot} owned={item.owned} />;
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
      {/* Floor – light maple wood */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, midZ]}>
        <planeGeometry args={[CW, length]} />
        <meshStandardMaterial map={floorTex} roughness={0.5} metalness={0.15} />
      </mesh>

      {/* Ceiling */}
      <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, CH, midZ]}>
        <planeGeometry args={[CW, length]} />
        <meshBasicMaterial map={ceilTex} />
      </mesh>

      {/* Left wall */}
      <mesh rotation={[0, Math.PI / 2, 0]} position={[-CW / 2, CH / 2, midZ]}>
        <planeGeometry args={[length, CH]} />
        <meshStandardMaterial map={wallTex} roughness={0.85} metalness={0.05} />
      </mesh>
      {/* Right wall */}
      <mesh rotation={[0, -Math.PI / 2, 0]} position={[CW / 2, CH / 2, midZ]}>
        <planeGeometry args={[length, CH]} />
        <meshStandardMaterial map={wallTex} roughness={0.85} metalness={0.05} />
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
    </group>
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
      <mesh position={[0, CH - 0.65, 0]}>
        <boxGeometry args={[CW - 0.5, 1.1, 0.3]} />
        <meshStandardMaterial color="#0f1029" roughness={0.5} metalness={0.4} />
      </mesh>
      {/* Gold accent strip */}
      <mesh position={[0, CH - 0.08, 0.16]}>
        <boxGeometry args={[CW - 0.6, 0.08, 0.02]} />
        <meshBasicMaterial color="#FDB927" />
      </mesh>
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
      {/* Warm light at the arch */}
      <pointLight position={[0, CH - 0.8, 0]} intensity={0.4} distance={8} color="#FDB927" decay={2} />
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
      v.src = edition.videoUrl;
      v.loop = true;
      v.muted = true;
      v.playsInline = true;
      v.play().catch(() => {});
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

  return (
    <group position={pos} rotation={rot}>
      {/* TV outer frame */}
      <mesh position={[0, 0, -0.04]}>
        <boxGeometry args={[TV_SZ + 0.4, TV_SZ + 0.4, 0.06]} />
        <meshStandardMaterial color="#111" roughness={0.3} metalness={0.9} />
      </mesh>

      {/* Tier-color bezel */}
      <mesh position={[0, 0, -0.015]}>
        <planeGeometry args={[TV_SZ + 0.15, TV_SZ + 0.15]} />
        <meshBasicMaterial color={tierColor} />
      </mesh>

      {/* Screen */}
      <mesh position={[0, 0, 0.005]}>
        <planeGeometry args={[TV_SZ, TV_SZ]} />
        {activeTex ? (
          <meshBasicMaterial map={activeTex} toneMapped={false} />
        ) : (
          <meshStandardMaterial color="#181830" emissive="#101028" emissiveIntensity={0.8} roughness={0.5} />
        )}
      </mesh>

      {/* Static noise overlay when no image loaded yet */}
      {!activeTex && (
        <mesh position={[0, TV_SZ / 2 - 0.3, 0.01]}>
          <planeGeometry args={[TV_SZ * 0.6, 0.08]} />
          <meshBasicMaterial color="#FDB927" transparent opacity={0.15} />
        </mesh>
      )}

      {/* Single glow light from TV screen – only when texture loaded */}
      {activeTex && (
        <pointLight
          position={[0, 0, 1.0]}
          intensity={0.4}
          distance={4}
          color={tierColor}
          decay={2}
        />
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
            {/* Ownership row – only show when user has wallet connected and owns something */}
            {owned && (
              <div className="p3d-ownership">
                <span className="p3d-own-yes">✓ You own {edition.userOwnedCount || 1}</span>
                {edition.circulationCount && (
                  <span className="p3d-circulation">#{edition.circulationCount} minted</span>
                )}
              </div>
            )}
            {!owned && edition.circulationCount && (
              <div className="p3d-ownership">
                <span className="p3d-circulation">#{edition.circulationCount} minted</span>
              </div>
            )}
            {edition.flowSerialNumber && (
              <div className="p3d-serial">
                Serial #{edition.flowSerialNumber}
                {edition.lowAsk != null && edition.lowAsk > 0 && (
                  <span className="p3d-lowask"> • Low Ask ${edition.lowAsk}</span>
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
