---
applyTo: react-wallet/src/pages/Museum.jsx,react-wallet/src/pages/Museum.css
---

# Museum Page — Product Spec

## Route
`/museum` (also supports `?showcaseId=<uuid>` for custom showcases)

## Purpose
Immersive 3D virtual gallery of Nikola Jokić TopShot moments. Users walk through a corridor viewing moments as wall-mounted TVs with video playback, organized by season with banners and info panels. Connected users see which editions they own.

## API Endpoints
| Endpoint | Method | Description |
|---|---|---|
| `/api/museum` | GET | Returns all Jokić editions for the gallery. |
| `/api/museum?wallet={addr}` | GET | Same as above, with ownership flags for the connected wallet. |
| `/api/showcase/{binder_id}` | GET | Returns editions for a custom showcase (showcase mode). |

## Key UI Elements
- Entrance screen with controls guide (WASD/arrow keys, mouse look, mobile joystick).
- React Three Fiber `<Canvas>` rendering a 3D corridor scene.
- `PointerLockControls` for desktop, nipplejs mobile joystick for touch.
- `WallTV` components: frame, video texture, plaque (set/description/date), ownership/tier badges.
- `SeasonBanner` dividers between seasons.
- `FloorCarpets` with team logo medallions.
- `CameraLights` following the player.
- Mute/unmute audio toggle.

## State & Data Flow
- Fetches editions from `/api/museum` on mount; re-fetches with `?wallet=` for ownership data when wallet connects.
- Deduplicates editions by `playId`, sorts chronologically, groups by season.
- 3D layout (TV positions, banners, carpets) computed via `useMemo`.
- Season data imported from `jokicSeasonData.js`.
- Showcase mode: triggered by `?showcaseId=<uuid>` query param, fetches from `/api/showcase/{binder_id}` instead.

## Styling
- Uses `Museum.css` for page-specific styling.

## External Data Sources
- NBA TopShot (moment images/videos via URLs in API data).
- Flow blockchain (wallet connection for ownership).

## Technical Stack
- React Three Fiber (`@react-three/fiber`), drei (`@react-three/drei`), raw THREE.js, nipplejs (mobile joystick).

## Scene Constants (top of file)
- `CW` (corridor width 14), `CH` (corridor height 5.5)
- `TV_SZ`, `TV_Y`, `TV_GAP` — TV sizing and spacing
- `EYE_Y`, `SPEED` — camera height and movement speed
- `LIGHT_SPACING`, `CARPET_SPACING`, `CARPET_RADIUS` — environment layout
- `MOUNT_RANGE` (50) — culling distance for mounting components
- `MAX_VIDEOS` (4) — max simultaneous video textures

## Component Hierarchy
`Museum` (data + entrance screen) → Canvas containing `Corridor`, `FloorCarpets`, `CameraLights`, `Movement`, `NearbyItems` → `WallTV` / `SeasonBanner`

## Performance Rules (IMPORTANT — do NOT break these)
- Environment meshes (`Corridor`, `FloorCarpets`, decorative elements) **must** use `meshBasicMaterial` — no per-pixel lighting cost — except for the floor (`meshStandardMaterial` for specular response).
- Emissive fixtures (ceiling lights, WallTV picture lights) use `meshBasicMaterial` — keep them cheap.
- Share geometry instances (e.g. `_carpetGeo`, `_medallionGeo`) created once at module scope.
- `NearbyItems` culls `WallTV`/`SeasonBanner` by camera distance (`MOUNT_RANGE = 50`). Only nearby items are mounted.
- Video textures are capped at `MAX_VIDEOS = 4` simultaneous elements; loaded/disposed by distance.
- Canvas uses `frameloop="demand"` with a `RenderLoop` component calling `invalidate()`.

## Rendering
- **Tone mapping**: ACES Filmic (`THREE.ACESFilmicToneMapping`) for cinematic color response.
- **Lighting**: Ambient light intentionally low (~0.35) with fog pushed back (30–100) for atmospheric depth.
- **Textures**: Floor (512²), wall (512²), and ceiling (256²) textures are procedurally generated via `<canvas>` + `CanvasTexture` inside `useMemo`. No image files needed for base surfaces.

## Related Files
- `react-wallet/src/pages/Museum.jsx`
- `react-wallet/src/pages/Museum.css`
- `react-wallet/src/pages/jokicSeasonData.js` — shared season data
- `routes/api.py` — `/api/museum`, `/api/showcase/{binder_id}` endpoints
- `tests/test_museum.py` — museum endpoint tests
