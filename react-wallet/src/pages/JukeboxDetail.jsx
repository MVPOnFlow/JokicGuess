import { useParams } from "react-router-dom";
import { useState, useEffect, useRef, useMemo } from "react";
import * as fcl from "@onflow/fcl";
import {
  Card,
  Button,
  Spinner,
  Modal,
  Form,
  InputGroup,
  Badge,
} from "react-bootstrap";
import YouTube from "react-youtube";
import { TX_ADD_ENTRY, SCRIPT_GET_JUKEBOX_INFO } from "../flow/cadence";

export default function JukeboxDetail() {
  const { code } = useParams();
  const [user, setUser] = useState({ loggedIn: null });
  const [info, setInfo] = useState(null);
  const [loading, setLoading] = useState(false);
  const [remainingSec, setRemainingSec] = useState(null);
  const [timeLeft, setTimeLeft] = useState(null);

  // Modals
  const [showAdd, setShowAdd] = useState(false);
  const [showBoost, setShowBoost] = useState(false);
  const [boostEntry, setBoostEntry] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [modalKind, setModalKind] = useState("progress");
  const [modalTitle, setModalTitle] = useState("");
  const [modalMsg, setModalMsg] = useState("");

  // Add Song (URL mode)
  const [youtubeUrl, setYoutubeUrl] = useState("");
  const [selected, setSelected] = useState(null);
  const [amount, setAmount] = useState(5);
  const [duration, setDuration] = useState(30);
  const [boostAmount, setBoostAmount] = useState(5);
  const [isCheckingEmbed, setIsCheckingEmbed] = useState(false);
  const [isEmbeddable, setIsEmbeddable] = useState(null);

  const tickTimerRef = useRef(null);
  const refreshTimerRef = useRef(null);

  useEffect(() => fcl.currentUser().subscribe(setUser), []);
  useEffect(() => {
    if (code) fetchInfo();
  }, [code]);

  // Refresh periodically
  useEffect(() => {
    if (!code) return;
    const id = setInterval(fetchInfo, 15000);
    return () => clearInterval(id);
  }, [code]);

  async function fetchInfo() {
    try {
      setLoading(true);
      const res = await fcl.query({
        cadence: SCRIPT_GET_JUKEBOX_INFO,
        args: (arg, t) => [arg(code, t.UInt64)],
      });
      setInfo(res);
      if (res?.queueDuration) setTimeLeft(Number(res.queueDuration));
    } catch (e) {
      console.error("Failed to fetch info:", e);
    } finally {
      setLoading(false);
    }
  }

  // Countdown for current song
  useEffect(() => {
    if (tickTimerRef.current) clearInterval(tickTimerRef.current);
    const np = info?.nowPlaying;
    const start = np ? asNumber(np.startTime ?? np?.value?.startTime) : null;
    const dur = np ? asNumber(np.duration ?? np?.value?.duration) : null;

    if (!start || !dur) {
      setRemainingSec(null);
      return;
    }

    const tick = () => {
      const now = Date.now() / 1000;
      const elapsed = now - start;
      const remain = Math.max(dur - elapsed, 0);
      setRemainingSec(remain);
      if (remain <= 0.05) {
        clearInterval(tickTimerRef.current);
        if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
        refreshTimerRef.current = setTimeout(fetchInfo, 800);
      }
    };

    tick();
    tickTimerRef.current = setInterval(tick, 1000);
    return () => clearInterval(tickTimerRef.current);
  }, [info]);

  // Countdown for queue expiration
  useEffect(() => {
    if (!info?.queueDuration) return;
    const interval = setInterval(() => {
      setTimeLeft((prev) => (prev > 1 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(interval);
  }, [info]);

  function openModal(kind, title, msg) {
    setModalKind(kind);
    setModalTitle(title);
    setModalMsg(msg);
    setShowModal(true);
  }
  function closeModal() {
    setShowModal(false);
  }

  async function handleAddSongSubmit() {
    if (!user.loggedIn)
      return openModal("error", "Wallet Required", "Connect your wallet first.");
    if (!selected || !selected.videoId || !selected.title)
      return openModal("error", "Missing Info", "Provide a valid YouTube URL and check it first.");

    try {
      const amt = clampToStep(amount, 5);
      const dur = clamp(duration, 15, 300);
      openModal("progress", "Adding Song", "Please approve in your wallet.");
      const url = `https://www.youtube.com/watch?v=${selected.videoId}`;
      const txId = await fcl.mutate({
        cadence: TX_ADD_ENTRY,
        args: (arg, t) => [
          arg(code, t.UInt64),
          arg(url, t.String),
          arg(selected.title, t.String),
          arg(toUFix64(dur), t.UFix64),
          arg(toUFix64(amt), t.UFix64),
        ],
        proposer: fcl.authz,
        payer: fcl.authz,
        authorizations: [fcl.authz],
        limit: 9999,
      });
      await fcl.tx(txId).onceSealed();
      setShowAdd(false);
      openModal("success", "Song Added", `Your song "${selected.title}" was added successfully.`);
      fetchInfo();
    } catch (e) {
      console.error(e);
      openModal("error", "Add Failed", "Transaction failed. Try again.");
    }
  }

  async function handleBoostSubmit() {
    if (!boostEntry) return;
    const amt = clampToStep(boostAmount, 5);
    try {
      openModal("progress", "Boosting Song", "Please approve in your wallet.");
      const txId = await fcl.mutate({
        cadence: TX_ADD_ENTRY,
        args: (arg, t) => [
          arg(code, t.UInt64),
          arg(boostEntry.value, t.String),
          arg(boostEntry.displayName, t.String),
          arg(toUFix64(asInt(boostEntry.duration)), t.UFix64),
          arg(toUFix64(amt), t.UFix64),
        ],
        proposer: fcl.authz,
        payer: fcl.authz,
        authorizations: [fcl.authz],
        limit: 9999,
      });
      await fcl.tx(txId).onceSealed();
      setShowBoost(false);
      openModal("success", "Boost Added", `Added ${amt} $FLOW to "${boostEntry.displayName}".`);
      fetchInfo();
    } catch (e) {
      console.error(e);
      openModal("error", "Boost Failed", "Transaction failed. Try again.");
    }
  }

  /* ---------------- YouTube oEmbed helpers ---------------- */

  const YT_API_KEY = import.meta.env.VITE_YT_API_KEY; // store key in .env

  async function fetchYouTubeVideoDetails(url) {
    const id = extractYouTubeId(url);
    if (!id) throw new Error("Invalid YouTube URL");

    // --- 1️⃣ Get oEmbed info for title + thumbnail ---
    const oembedUrl = `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${id}&format=json`;
    const res = await fetch(oembedUrl);
    if (!res.ok) throw new Error("Video cannot be embedded or is restricted");

    const meta = await res.json();
    const title = meta.title || "Untitled";
    const thumbnailUrl = meta.thumbnail_url;

    // --- 2️⃣ Try to get exact duration from YouTube Data API ---
    let durationSec = 180; // default 3 min fallback
    if (YT_API_KEY) {
      try {
        const apiUrl = `https://www.googleapis.com/youtube/v3/videos?part=contentDetails&id=${id}&key=${YT_API_KEY}`;
        const apiRes = await fetch(apiUrl);
        if (apiRes.ok) {
          const apiJs = await apiRes.json();
          const iso = apiJs?.items?.[0]?.contentDetails?.duration;
          if (iso) durationSec = parseYouTubeDuration(iso);
        } else {
          console.warn("YouTube Data API request failed:", apiRes.status);
        }
      } catch (err) {
        console.warn("Duration fetch error, using default:", err);
      }
    }

    return { videoId: id, title, thumbnailUrl, duration: durationSec };
  }

  // Helper for ISO 8601 → seconds
  function parseYouTubeDuration(iso) {
    const m = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
    const h = parseInt(m?.[1] || 0, 10);
    const min = parseInt(m?.[2] || 0, 10);
    const sec = parseInt(m?.[3] || 0, 10);
    return h * 3600 + min * 60 + sec;
  }


  /* ---------------- Render UI ---------------- */

  const sortedEntries = (info?.entries || []).slice().sort(
    (a, b) => (b.totalBacking || 0) - (a.totalBacking || 0)
  );

  return (
    <div className="container">
      <div className="hero mb-4">
        <h1>🎧 {info?.queueIdentifier || `Jukebox #${code}`}</h1>
        <p className="text-black mb-1">Created by {info?.sessionOwner}</p>
        <Badge bg="dark-gray">{formatTimeLeft(timeLeft)}</Badge>
      </div>

      {loading && <Spinner animation="border" />}

      {info && (
        <>
          <Card className="mb-4 text-center">
            <Card.Body>
              <h2 className="text-green mb-3">Now Playing</h2>
              <NowPlaying np={info.nowPlaying} remainingSec={remainingSec} />
            </Card.Body>
          </Card>

          <Card>
            <Card.Body>
              <div className="d-flex justify-content-between align-items-center mb-3">
                <h4 className="text-green mb-0">Queue</h4>
                <Button variant="primary" onClick={() => setShowAdd(true)}>
                  ➕ Add a Song
                </Button>
              </div>
              {sortedEntries.length ? (
                <ul className="list-group">
                  {sortedEntries.map((e, i) => (
                    <li
                      key={i}
                      className="list-group-item d-flex justify-content-between align-items-center flex-wrap jukebox-queue-item"
                    >
                      <div>
                        <div className="fw-semibold">{e.displayName}</div>
                        <div className="small text-muted">{e.value}</div>
                      </div>
                      <div className="d-flex gap-3 align-items-center">
                        <Badge bg="dark-green">
                          Backing: {formatInt(e.totalBacking)} $FLOW
                        </Badge>
                        <Badge bg="dark-gray">
                          Playback Duration: {formatDurationMMSS(e.duration)}
                        </Badge>
                        <Button
                          variant="outline-light"
                          onClick={() => {
                            setBoostEntry(e);
                            setBoostAmount(5);
                            setShowBoost(true);
                          }}
                        >
                          Boost
                        </Button>
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <p>No songs queued yet.</p>
              )}
            </Card.Body>
          </Card>
        </>
      )}

      {/* Add Song Modal (Paste URL + oEmbed) */}
      <Modal show={showAdd} onHide={() => setShowAdd(false)} centered>
        <Modal.Header closeButton className="modal-header-green">
          <Modal.Title>Add a Song</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form>
            <Form.Group className="mb-3">
              <Form.Label>YouTube URL</Form.Label>
                <InputGroup>
                  <Form.Control
                    placeholder="Paste a YouTube video URL"
                    value={youtubeUrl}
                    onChange={async (e) => {
                      const url = e.target.value.trim();
                      setYoutubeUrl(url);
                      if (!url) {
                        setSelected(null);
                        setIsEmbeddable(null);
                        return;
                      }
                      setIsCheckingEmbed(true);
                      try {
                        const det = await fetchYouTubeVideoDetails(url);
                        setSelected(det);
                        setDuration(det.duration);
                        setIsEmbeddable(true);
                      } catch (err) {
                        console.warn(err);
                        setSelected(null);
                        setIsEmbeddable(false);
                      } finally {
                        setIsCheckingEmbed(false);
                      }
                    }}
                  />
                </InputGroup>
            </Form.Group>

            {isCheckingEmbed && (
              <div className="text-center my-3">
                <Spinner animation="border" />
              </div>
            )}

            {isEmbeddable === false && (
              <div className="alert alert-danger text-center py-2">
                🚫 This video cannot be embedded. Try another one.
              </div>
            )}

            {selected && isEmbeddable && (
              <>
                <div className="text-center mb-3">
                  <img
                    src={selected.thumbnailUrl}
                    alt="Thumbnail"
                    className="rounded shadow-sm"
                    style={{ width: "100%", maxWidth: "300px" }}
                  />
                </div>
                <div className="mb-2">
                  <strong>Title:</strong> {selected.title}
                </div>
                <div className="mb-3">
                  <Form.Group className="mb-3">
                    <Form.Label>Duration</Form.Label>
                    <div className="d-flex gap-2">
                      <Form.Control
                        type="number"
                        min={0}
                        max={4}
                        value={Math.floor(duration / 60)}
                        onChange={(e) => {
                          const m = Math.min(4, Math.max(0, parseInt(e.target.value || 0)));
                          setDuration(m * 60 + (duration % 60));
                        }}
                        style={{ width: "80px", textAlign: "center" }}
                      />
                      <span className="align-self-center">:</span>
                      <Form.Control
                        type="number"
                        min={0}
                        max={59}
                        value={duration % 60}
                        onChange={(e) => {
                          const s = Math.min(59, Math.max(0, parseInt(e.target.value || 0)));
                          setDuration(Math.floor(duration / 60) * 60 + s);
                        }}
                        style={{ width: "80px", textAlign: "center" }}
                      />
                    </div>
                    <small className="text-muted">Minutes & seconds (max 4:59)</small>
                  </Form.Group>
                </div>
              </>
            )}

            <Form.Group className="mb-3">
             <Form.Group className="mb-3">
              <Form.Label>Backing ($FLOW)</Form.Label>
              <div className="d-flex align-items-center flex-wrap gap-2">
                {/* Decrease */}
                <Button
                  variant="outline-secondary"
                  className="rounded-circle fw-bold"
                  style={{
                    width: "38px",
                    height: "38px",
                    fontSize: "1.2rem",
                    lineHeight: "1rem",
                  }}
                  onClick={() => setAmount((prev) => Math.max(5, prev - 5))}
                  disabled={amount <= 5}
                >
                  –
                </Button>

                {/* Display */}
                <Form.Control
                  type="text"
                  value={amount}
                  readOnly
                  style={{
                    width: "100px",
                    textAlign: "center",
                    fontWeight: 700,
                    fontSize: "1.3rem",
                    background: "var(--jukebox-light-purple)",
                    border: "none",
                    color: "var(--jukebox-dark-purple)",
                    borderRadius: "12px",
                    boxShadow: "inset 0 0 0 1px var(--jukebox-border)",
                  }}
                />

                {/* Increment buttons */}
                <div className="d-flex gap-2">
                  <Button
                    variant="primary"
                    style={{
                      background: "linear-gradient(90deg, #7b61ff, #9c8cff)",
                      border: "none",
                      fontWeight: 600,
                    }}
                    onClick={() => setAmount((prev) => prev + 5)}
                  >
                    +5
                  </Button>

                  <Button
                    variant="primary"
                    style={{
                      background: "linear-gradient(90deg, #7b61ff, #9c8cff)",
                      border: "none",
                      fontWeight: 600,
                    }}
                    onClick={() => setAmount((prev) => prev + 50)}
                  >
                    +50
                  </Button>

                  <Button
                    variant="primary"
                    style={{
                      background: "linear-gradient(90deg, #7b61ff, #9c8cff)",
                      border: "none",
                      fontWeight: 600,
                    }}
                    onClick={() => setAmount((prev) => prev + 500)}
                  >
                    +500
                  </Button>
                </div>

                {/* Unit label */}
                <span
                  style={{
                    fontWeight: 600,
                    color: "var(--jukebox-dark-purple)",
                    marginLeft: "4px",
                  }}
                >
                  $FLOW
                </span>
              </div>
              <small className="text-muted">Must be multiples of 5 $FLOW</small>
            </Form.Group>
            </Form.Group>
          </Form>
        </Modal.Body>
        <Modal.Footer className="modal-footer-green">
          <Button variant="outline-light" onClick={() => setShowAdd(false)}>
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={handleAddSongSubmit}
            disabled={!isEmbeddable || isCheckingEmbed}
          >
            {isCheckingEmbed ? "Checking..." : "Confirm Add"}
          </Button>
        </Modal.Footer>
      </Modal>

      {/* Boost Modal */}
      <Modal show={showBoost} onHide={() => setShowBoost(false)} centered>
        <Modal.Header closeButton className="modal-header-green">
          <Modal.Title>Boost Song</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {boostEntry && (
            <>
              <p className="fw-semibold mb-2">{boostEntry.displayName}</p>
              <Form.Group>
                <Form.Label>Additional Backing ($FLOW)</Form.Label>
                <InputGroup>
                  <Form.Control
                    type="number"
                    min={5}
                    step={5}
                    value={boostAmount}
                    onChange={(e) => setBoostAmount(asInt(e.target.value))}
                  />
                  <InputGroup.Text>$FLOW</InputGroup.Text>
                </InputGroup>
              </Form.Group>
            </>
          )}
        </Modal.Body>
        <Modal.Footer className="modal-footer-green">
          <Button variant="outline-light" onClick={() => setShowBoost(false)}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleBoostSubmit}>
            Confirm Boost
          </Button>
        </Modal.Footer>
      </Modal>

      {/* Status Modal */}
      <Modal show={showModal} onHide={modalKind === "progress" ? undefined : closeModal} centered>
        <Modal.Header className={`modal-header-${modalKind}`}>
          <Modal.Title>{modalTitle}</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {modalKind === "progress" ? (
            <div className="d-flex align-items-center gap-3">
              <Spinner animation="border" />
              <div>
                <div className="fw-semibold text-green">Awaiting wallet approval</div>
                <div className="text-muted">{modalMsg}</div>
              </div>
            </div>
          ) : (
            <p>{modalMsg}</p>
          )}
        </Modal.Body>
        {modalKind !== "progress" && (
          <Modal.Footer className="modal-footer-green">
            <Button variant="outline-light" onClick={closeModal}>
              Close
            </Button>
          </Modal.Footer>
        )}
      </Modal>
    </div>
  );
}

/* ---------- global helpers ---------- */
function asNumber(x) {
  const n = parseFloat(x);
  return Number.isFinite(n) ? n : null;
}
function asInt(x) {
  const n = parseInt(x || 0, 10);
  return Number.isFinite(n) ? n : 0;
}
function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}
function clampToStep(n, s) {
  const r = Math.round(n / s) * s;
  return Math.max(s, r);
}
function toUFix64(n) {
  return `${Math.floor(Number(n) || 0)}.0`;
}
function formatInt(x) {
  return Math.round(Number(x) || 0);
}
function formatDurationMMSS(sec) {
  const total = Math.max(0, Math.round(Number(sec) || 0));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}m ${s}s`;
}
function formatTimeLeft(seconds) {
  const sec = Math.max(0, Math.floor(seconds || 0));
  if (sec <= 0) return "Expired";
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  return `${h}h ${m}m left`;
}
function extractYouTubeId(url) {
  if (!url) return null;
  try {
    const reg = /(?:youtu\.be\/|youtube\.com\/(?:embed\/|watch\?v=|shorts\/))([\w-]{11})/;
    const match = url.match(reg);
    return match ? match[1] : null;
  } catch {
    return null;
  }
}

/* ---------- NowPlaying Component ---------- */
function NowPlaying({ np, remainingSec }) {
  if (!np) return <p>No song currently playing.</p>;

  const display = np.displayName ?? np?.value?.displayName ?? "Unknown";
  const link = np.value ?? np?.value?.value ?? "";
  const dur = asNumber(np.duration ?? np?.value?.duration) ?? 0;
  const start = np.startTime ?? np?.value?.startTime;
  const startedAt = new Date(start * 1000).toLocaleTimeString();
  const now = Date.now() / 1000;
  const elapsed = Math.max(0, now - start);
  const videoId = extractYouTubeId(link);
  const startSeconds = Math.floor(elapsed);
  const nextSongIn = Math.max(0, dur - elapsed);

  const videoBlock = useMemo(() => {
    if (!videoId) return null;
    return (
      <div className="youtube-player mb-3">
        <YouTube
          videoId={videoId}
          opts={{
            width: "100%",
            playerVars: {
              autoplay: 1,
              controls: 0,
              start: startSeconds,
              modestbranding: 1,
              rel: 0,
              disablekb: 1,
            },
          }}
        />
      </div>
    );
  }, [videoId]);

  return (
    <div className="now-playing-container">
      <h3 className="mb-3">{display}</h3>
      {videoBlock || (
        <p>
          <a href={link} target="_blank" rel="noreferrer">
            {link}
          </a>
        </p>
      )}
      <p className="text-muted">
        Started: <strong>{startedAt}</strong> | Playback Duration:{" "}
        {formatDurationMMSS(dur)}
      </p>
      <div className="mt-3 next-song-timer">
        ⏱️ Next song in:{" "}
        <strong>
          {nextSongIn > 1 ? `${Math.floor(nextSongIn)}s` : "Starting soon..."}
        </strong>
      </div>
    </div>
  );
}
