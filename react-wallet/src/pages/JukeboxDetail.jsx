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
  ListGroup,
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

  // Add Song (search) state
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [selected, setSelected] = useState(null);
  const [amount, setAmount] = useState(5);
  const [duration, setDuration] = useState(30);
  const [boostAmount, setBoostAmount] = useState(5);

  const tickTimerRef = useRef(null);
  const refreshTimerRef = useRef(null);
  const searchDebounceRef = useRef(null);

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
      return openModal("error", "Missing Info", "Select a song first.");

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

  /* ---------------- YouTube API helpers inside component ---------------- */

  function getYouTubeApiKey() {
    if (typeof import.meta !== "undefined" && import.meta.env?.VITE_YOUTUBE_API_KEY)
      return import.meta.env.VITE_YOUTUBE_API_KEY;
    if (typeof process !== "undefined" && process.env?.REACT_APP_YOUTUBE_API_KEY)
      return process.env.REACT_APP_YOUTUBE_API_KEY;
    return null;
  }

  async function fetchYouTubeSearch(query) {
    const apiKey = getYouTubeApiKey();
    if (!apiKey) throw new Error("Missing YouTube API key for search");
    const url = `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&maxResults=5&q=${encodeURIComponent(
      query
    )}&key=${apiKey}`;
    const res = await fetch(url);
    const js = await res.json();
    if (!js.items) {
      setSearchResults([]);
      return;
    }
    const results = js.items.map((item) => ({
      videoId: item.id.videoId,
      title: item.snippet.title,
      thumbnailUrl: item.snippet.thumbnails?.default?.url,
    }));
    setSearchResults(results);
  }

  async function fetchYouTubeVideoDetails(videoId) {
    const apiKey = getYouTubeApiKey();
    if (!apiKey) throw new Error("Missing YouTube API key");
    const url = `https://www.googleapis.com/youtube/v3/videos?id=${videoId}&part=snippet,contentDetails&key=${apiKey}`;
    const res = await fetch(url);
    const js = await res.json();
    const vid = js.items?.[0];
    if (!vid) throw new Error("Video not found");
    const title = vid.snippet?.title || "Untitled";
    const durationISO = vid.contentDetails?.duration || "PT30S";
    const durationSec = parseISODuration(durationISO);
    return { title, duration: durationSec };
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

      {/* Add Song Modal with Search */}
      <Modal show={showAdd} onHide={() => setShowAdd(false)} centered>
        <Modal.Header closeButton className="modal-header-green">
          <Modal.Title>Add a Song</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form>
            <Form.Group className="mb-3">
              <Form.Label>Search YouTube</Form.Label>
              <Form.Control
                placeholder="Type song name or artist"
                value={searchQuery}
                onChange={(e) => {
                  const q = e.target.value;
                  setSearchQuery(q);
                  if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
                  searchDebounceRef.current = setTimeout(() => {
                    if (q.trim().length > 0) fetchYouTubeSearch(q.trim()).catch(console.warn);
                    else setSearchResults([]);
                  }, 300);
                }}
              />
            </Form.Group>

            {searchResults.length > 0 && (
              <ListGroup className="mb-3">
                {searchResults.map((vid) => (
                  <ListGroup.Item
                    key={vid.videoId}
                    action
                    active={selected?.videoId === vid.videoId}
                    onClick={async () => {
                      // keep local flag to ignore async state updates if unmounted
                      let active = true;

                      // set initial selection immediately
                      setSelected(vid);
                      setSearchResults([]); // close dropdown early

                      try {
                        const det = await fetchYouTubeVideoDetails(vid.videoId);
                        if (!active) return; // stop if component unmounted
                        setDuration(clamp(det.duration, 15, 300));
                        setSelected((p) => (p ? { ...p, title: det.title } : { ...vid, title: det.title }));
                      } catch (err) {
                        console.warn("Detail fetch failed", err);
                        if (active) setDuration(30);
                      }

                      // cleanup guard
                      return () => {
                        active = false;
                      };
                    }}
                  >
                    <div className="d-flex align-items-center">
                      <img
                        src={vid.thumbnailUrl}
                        alt="thumb"
                        style={{ width: 60, height: 45, marginRight: 10 }}
                      />
                      <span>{vid.title}</span>
                    </div>
                  </ListGroup.Item>
                ))}
              </ListGroup>
            )}

            {selected && (
              <>
                <div className="text-center mb-3">
                  <img
                    src={selected.thumbnailUrl}
                    alt="Selected Thumbnail"
                    className="rounded shadow-sm"
                    style={{ width: "100%", maxWidth: "300px" }}
                  />
                </div>
                <div className="mb-2">
                  <strong>Title:</strong> {selected.title}
                </div>
                <div className="mb-3">
                  <strong>Duration:</strong> {formatDurationMMSS(duration)}
                </div>
              </>
            )}

            <Form.Group className="mb-3">
              <Form.Label>Backing ($FLOW)</Form.Label>
              <InputGroup>
                <Form.Control
                  type="number"
                  min={5}
                  step={5}
                  value={amount}
                  onChange={(e) => setAmount(asInt(e.target.value))}
                />
                <InputGroup.Text>$FLOW</InputGroup.Text>
              </InputGroup>
            </Form.Group>
          </Form>
        </Modal.Body>
        <Modal.Footer className="modal-footer-green">
          <Button variant="outline-light" onClick={() => setShowAdd(false)}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleAddSongSubmit}>
            Confirm Add
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
function parseISODuration(iso) {
  const match = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  const h = parseInt(match?.[1] || 0, 10);
  const m = parseInt(match?.[2] || 0, 10);
  const s = parseInt(match?.[3] || 0, 10);
  return h * 3600 + m * 60 + s;
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
