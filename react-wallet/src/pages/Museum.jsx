import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { PointerLockControls, Html } from '@react-three/drei';
import * as THREE from 'three';
import { Spinner } from 'react-bootstrap';
import * as fcl from '@onflow/fcl';
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
const MOUNT_RANGE = 50;    // only mount WallTV components within this distance
const MAX_VIDEOS = 4;      // max simultaneous video elements

/* ================================================================== */
/*  Museum – top-level data + routing between entrance & 3D scene      */
/* ================================================================== */
export default function Museum() {
  const [editions, setEditions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [user, setUser] = useState({ loggedIn: null });
  const [ownershipLoaded, setOwnershipLoaded] = useState(false);
  const [entered, setEntered] = useState(false);
  const [locked, setLocked] = useState(false);

  useEffect(() => { fcl.currentUser().subscribe(setUser); }, []);

  /* Fetch editions */
  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const r = await fetch('/api/museum');
        const j = await r.json();
        if (!r.ok) { setError(j.error || 'Load failed'); return; }
        setEditions(j.editions || []);
      } catch (e) { setError(e.message); }
      finally { setLoading(false); }
    })();
  }, []);

  /* Re-fetch with wallet for ownership */
  useEffect(() => {
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
  }, [user?.addr]);

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
            <h1 className="entrance-title">THE JOKIĆ MUSEUM</h1>
            <p className="entrance-sub">A first-person walk through every Nikola Jokić NBA TopShot moment</p>

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
                {walletConnected && ownershipLoaded && (
                  <p className="entrance-owned">🎟️ You own {ownedCount} moments</p>
                )}
                {walletConnected && !ownershipLoaded && (
                  <p className="entrance-owned">
                    <Spinner animation="border" size="sm" variant="warning" /> Checking collection…
                  </p>
                )}
                <button className="entrance-btn" onClick={() => setEntered(true)}>
                  Enter Museum
                </button>
                <div className="entrance-controls">
                  <span><kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> Move</span>
                  <span><kbd>Mouse</kbd> Look Around</span>
                  <span><kbd>ESC</kbd> Pause</span>
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
      >
        <fog attach="fog" args={['#080812', 12, 65]} />
        <ambientLight intensity={0.6} color="#aaaacc" />
        <directionalLight position={[2, CH, 5]} intensity={0.3} color="#ccbbaa" />

        {/* Ceiling light fixtures (visual only – no pointLights here, corridor uses baked/basic materials) */}
        {Array.from({ length: numCeilingLights }, (_, i) => (
          <group key={`cl-${i}`}>
            {/* Visible light fixture on ceiling */}
            <mesh position={[0, CH - 0.05, -i * LIGHT_SPACING - 8]}>
              <boxGeometry args={[1.2, 0.06, 0.4]} />
              <meshBasicMaterial color="#eecc88" />
            </mesh>
            {/* Small warm glow marker below fixture */}
            <mesh position={[0, CH - 0.15, -i * LIGHT_SPACING - 8]}>
              <planeGeometry args={[0.6, 0.02]} />
              <meshBasicMaterial color="#FDB927" transparent opacity={0.3} />
            </mesh>
          </group>
        ))}

        {/* Two moving pointLights that follow the camera for local illumination */}
        <CameraLights />

        <Corridor length={layout.length} />
        <Movement length={layout.length} />
        <PointerLockControls />
        <RenderLoop />

        <NearbyItems items={layout.items} />
      </Canvas>

      {/* HUD overlay */}
      <div className="hud">
        {locked && <div className="crosshair" />}
        {!locked && (
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
      <pointLight ref={frontRef} intensity={1.0} distance={20} color="#eecc88" decay={2} />
      <pointLight ref={backRef} intensity={0.6} distance={15} color="#ddbbaa" decay={2} />
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
  /* Wooden floor texture – light yellow planks */
  const floorTex = useMemo(() => {
    const c = document.createElement('canvas');
    c.width = 512; c.height = 512;
    const ctx = c.getContext('2d');
    // Light yellow wood base
    ctx.fillStyle = '#c4a86a';
    ctx.fillRect(0, 0, 512, 512);
    // Plank gaps (horizontal lines for lengthwise planks)
    const plankH = 64;
    for (let y = 0; y < 512; y += plankH) {
      // Slight color variation per plank
      const shade = (y * 7 % 30) - 15;
      ctx.fillStyle = `rgb(${196 + shade}, ${168 + shade}, ${106 + shade})`;
      ctx.fillRect(0, y + 2, 512, plankH - 2);
      // Plank gap line
      ctx.fillStyle = '#9e8550';
      ctx.fillRect(0, y, 512, 2);
      // Subtle wood grain lines within each plank
      ctx.strokeStyle = 'rgba(140,110,60,0.12)';
      ctx.lineWidth = 1;
      for (let g = 0; g < 3; g++) {
        const gy = y + 12 + g * 18 + ((y * 13 + g * 7) % 8);
        ctx.beginPath(); ctx.moveTo(0, gy); ctx.lineTo(512, gy); ctx.stroke();
      }
    }
    // Gold center runner (subtle)
    ctx.fillStyle = '#FDB92715';
    ctx.fillRect(224, 0, 64, 512);
    const t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(CW / 4, length / 4);
    return t;
  }, [length]);

  /* Wall texture – paneled look with baked highlights */
  const wallTex = useMemo(() => {
    const c = document.createElement('canvas');
    c.width = 512; c.height = 512;
    const ctx = c.getContext('2d');
    // Lighter navy base
    ctx.fillStyle = '#252a48';
    ctx.fillRect(0, 0, 512, 512);
    // Upper portion lighter (simulates overhead light)
    const grad = ctx.createLinearGradient(0, 0, 0, 512);
    grad.addColorStop(0, 'rgba(80,80,130,0.2)');
    grad.addColorStop(0.3, 'rgba(50,50,90,0.1)');
    grad.addColorStop(1, 'rgba(10,10,30,0.15)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 512, 512);
    // Vertical panel lines
    ctx.strokeStyle = '#353a5a';
    ctx.lineWidth = 1;
    for (let i = 0; i <= 512; i += 128) {
      ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, 512); ctx.stroke();
    }
    // Wainscoting line at lower third
    ctx.strokeStyle = '#404570';
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(0, 340); ctx.lineTo(512, 340); ctx.stroke();
    // Crown molding glow
    ctx.fillStyle = 'rgba(100,100,160,0.15)';
    ctx.fillRect(0, 0, 512, 8);
    const t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(length / 6, 1);
    return t;
  }, [length]);

  /* Ceiling texture – subtle grid */
  const ceilTex = useMemo(() => {
    const c = document.createElement('canvas');
    c.width = 256; c.height = 256;
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#1a1a32';
    ctx.fillRect(0, 0, 256, 256);
    ctx.strokeStyle = '#222244';
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

  /* Deterministic ornament positions – generated once */
  const ornaments = useMemo(() => {
    const items = [];
    const seed = (n) => ((n * 9301 + 49297) % 233280) / 233280;
    const numOrnaments = Math.floor(length / 6);
    for (let i = 0; i < numOrnaments; i++) {
      const z = -(seed(i * 7 + 1) * (length - 20) + 10);
      const side = seed(i * 13 + 3) > 0.5 ? 1 : -1;
      const type = seed(i * 17 + 5) > 0.5 ? 'frame' : 'sconce';
      const y = type === 'sconce' ? 2.0 + seed(i * 23) * 0.8 : 2.6 + seed(i * 29) * 0.6;
      items.push({ z, side, type, y, idx: i });
    }
    return items;
  }, [length]);

  const midZ = -length / 2;

  return (
    <group>
      {/* Floor – warm brown tiles */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, midZ]}>
        <planeGeometry args={[CW, length]} />
        <meshStandardMaterial map={floorTex} roughness={0.4} metalness={0.3} />
      </mesh>

      {/* Ceiling */}
      <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, CH, midZ]}>
        <planeGeometry args={[CW, length]} />
        <meshBasicMaterial map={ceilTex} />
      </mesh>

      {/* Left wall */}
      <mesh rotation={[0, Math.PI / 2, 0]} position={[-CW / 2, CH / 2, midZ]}>
        <planeGeometry args={[length, CH]} />
        <meshStandardMaterial map={wallTex} roughness={0.7} metalness={0.1} />
      </mesh>
      {/* Right wall */}
      <mesh rotation={[0, -Math.PI / 2, 0]} position={[CW / 2, CH / 2, midZ]}>
        <planeGeometry args={[length, CH]} />
        <meshStandardMaterial map={wallTex} roughness={0.7} metalness={0.1} />
      </mesh>

      {/* Baseboard – left */}
      <mesh position={[-CW / 2 + 0.06, 0.12, midZ]} rotation={[0, Math.PI / 2, 0]}>
        <planeGeometry args={[length, 0.24]} />
        <meshBasicMaterial color="#1a1a35" />
      </mesh>
      {/* Baseboard – right */}
      <mesh position={[CW / 2 - 0.06, 0.12, midZ]} rotation={[0, -Math.PI / 2, 0]}>
        <planeGeometry args={[length, 0.24]} />
        <meshBasicMaterial color="#1a1a35" />
      </mesh>

      {/* Crown molding – left */}
      <mesh position={[-CW / 2 + 0.06, CH - 0.06, midZ]} rotation={[0, Math.PI / 2, 0]}>
        <planeGeometry args={[length, 0.12]} />
        <meshBasicMaterial color="#333360" />
      </mesh>
      {/* Crown molding – right */}
      <mesh position={[CW / 2 - 0.06, CH - 0.06, midZ]} rotation={[0, -Math.PI / 2, 0]}>
        <planeGeometry args={[length, 0.12]} />
        <meshBasicMaterial color="#333360" />
      </mesh>

      {/* Back wall */}
      <mesh position={[0, CH / 2, -length]}>
        <planeGeometry args={[CW, CH]} />
        <meshBasicMaterial color="#141432" />
      </mesh>
      {/* Entrance wall */}
      <mesh rotation={[0, Math.PI, 0]} position={[0, CH / 2, 5]}>
        <planeGeometry args={[CW, CH]} />
        <meshBasicMaterial color="#141432" />
      </mesh>

      {/* Wall ornaments */}
      {ornaments.map(o => (
        <WallOrnament key={`orn-${o.idx}`} z={o.z} side={o.side} y={o.y} type={o.type} />
      ))}
    </group>
  );
}

/* ================================================================== */
/*  WallOrnament – decorative frames and sconces on walls              */
/* ================================================================== */
function WallOrnament({ z, side, y, type }) {
  const x = side * (CW / 2 - 0.02);
  const rotY = side === -1 ? Math.PI / 2 : -Math.PI / 2;

  if (type === 'sconce') {
    return (
      <group position={[x, y, z]} rotation={[0, rotY, 0]}>
        {/* Sconce bracket */}
        <mesh position={[0, 0, 0.04]}>
          <boxGeometry args={[0.12, 0.25, 0.08]} />
          <meshBasicMaterial color="#3a3a5a" />
        </mesh>
        {/* Sconce bulb glow */}
        <mesh position={[0, 0.18, 0.08]}>
          <sphereGeometry args={[0.06, 8, 8]} />
          <meshBasicMaterial color="#FDB927" transparent opacity={0.6} />
        </mesh>
      </group>
    );
  }

  // Decorative empty picture frame
  const fw = 0.6 + ((z * 7 + side * 13) % 5) * 0.1;
  const fh = 0.5 + ((z * 11 + side * 7) % 4) * 0.08;
  return (
    <group position={[x, y, z]} rotation={[0, rotY, 0]}>
      {/* Frame border */}
      <mesh position={[0, 0, 0.02]}>
        <boxGeometry args={[fw + 0.08, fh + 0.08, 0.03]} />
        <meshBasicMaterial color="#2a2845" />
      </mesh>
      {/* Frame inner (dark) */}
      <mesh position={[0, 0, 0.04]}>
        <planeGeometry args={[fw, fh]} />
        <meshBasicMaterial color="#161630" />
      </mesh>
    </group>
  );
}

/* ================================================================== */
/*  WASD Movement                                                      */
/* ================================================================== */
function Movement({ length }) {
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

  useFrame((_, delta) => {
    if (!document.pointerLockElement) return;
    const spd = SPEED * Math.min(delta, 0.1);

    camera.getWorldDirection(dir);
    dir.y = 0; dir.normalize();
    right.crossVectors(dir, camera.up).normalize();

    if (keys.current.KeyW || keys.current.ArrowUp) camera.position.addScaledVector(dir, spd);
    if (keys.current.KeyS || keys.current.ArrowDown) camera.position.addScaledVector(dir, -spd);
    if (keys.current.KeyA || keys.current.ArrowLeft) camera.position.addScaledVector(right, -spd);
    if (keys.current.KeyD || keys.current.ArrowRight) camera.position.addScaledVector(right, spd);

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
      <mesh position={[0, CH - 0.3, 0]}>
        <boxGeometry args={[CW - 0.5, 0.4, 0.3]} />
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
        position={[0, CH - 0.3, 0.2]}
        distanceFactor={8}
        className="season-banner-html"
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
              </div>
            )}
            {/* Ownership row */}
            <div className="p3d-ownership">
              {owned ? (
                <span className="p3d-own-yes">✓ You own {edition.userOwnedCount || 1}</span>
              ) : (
                <span className="p3d-own-no">✗ Not in your collection</span>
              )}
              {edition.circulationCount && (
                <span className="p3d-circulation">#{edition.circulationCount} minted</span>
              )}
            </div>
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
      {showPlaque && edition.description && (
        <Html
          transform
          position={[TV_SZ / 2 + 1.6, 0, 0.06]}
          center
          distanceFactor={5}
          className="plaque-html"
        >
          <div className="desc-plaque">
            <div className="dp-label">About this Moment</div>
            <div className="dp-text">{edition.description}</div>
            {edition.retired && <div className="dp-retired">RETIRED</div>}
          </div>
        </Html>
      )}
    </group>
  );
});
