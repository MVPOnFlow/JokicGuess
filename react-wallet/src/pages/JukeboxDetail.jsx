import { useParams } from "react-router-dom";
import { useState, useEffect } from "react";
import * as fcl from "@onflow/fcl";
import { Card, Button, Form, Row, Col, Spinner } from "react-bootstrap";
import { TX_ADD_ENTRY, SCRIPT_GET_JUKEBOX_INFO } from "../flow/cadence";

export default function JukeboxDetail() {
  const { code } = useParams(); // numeric NFT id
  const [user, setUser] = useState({ loggedIn: null });
  const [info, setInfo] = useState(null);
  const [loading, setLoading] = useState(false);
  const [song, setSong] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [amount, setAmount] = useState(1.0);
  const [duration, setDuration] = useState(30.0);

  useEffect(() => fcl.currentUser().subscribe(setUser), []);
  useEffect(() => { if (code) fetchInfo(); }, [code]);

  async function fetchInfo() {
    try {
      setLoading(true);
      const res = await fcl.query({
        cadence: SCRIPT_GET_JUKEBOX_INFO,
        args: (arg, t) => [arg(code, t.UInt64)],
      });
      setInfo(res);
    } catch (e) {
      console.error("Failed to fetch jukebox info:", e);
    } finally {
      setLoading(false);
    }
  }

  async function handleAddSong() {
    if (!user.loggedIn) return alert("Connect wallet first.");
    try {
      setLoading(true);
      const txId = await fcl.mutate({
        cadence: TX_ADD_ENTRY,
        args: (arg, t) => [
          arg(code, t.UInt64),
          arg(song, t.String),
          arg(displayName, t.String),
          arg(duration.toFixed(1), t.UFix64),
          arg(amount.toFixed(1), t.UFix64),
        ],
        proposer: fcl.authz,
        payer: fcl.authz,
        authorizations: [fcl.authz],
        limit: 9999,
      });
      await fcl.tx(txId).onceSealed();
      setSong("");
      setDisplayName("");
      fetchInfo();
      alert("✅ Song added to queue!");
    } catch (e) {
      console.error(e);
      alert("❌ Failed to add song.");
    } finally {
      setLoading(false);
    }
  }

  function renderNowPlaying(np) {
    if (!np) return <p>No song currently playing.</p>;
    // Flow sometimes returns nested or object references; handle both cases
    try {
      const song = np.displayName ?? np?.value?.displayName ?? "Unknown";
      const link = np.value ?? np?.value?.value ?? "";
      const duration = np.duration ?? np?.value?.duration ?? 0;
      return (
        <>
          <h3>{song}</h3>
          {link && (
            <p>
              <a href={link} target="_blank" rel="noreferrer">
                {link}
              </a>
            </p>
          )}
          <p className="text-muted">Duration: {duration} sec</p>
        </>
      );
    } catch (e) {
      console.error("Bad nowPlaying structure:", e, np);
      return <p>Unknown nowPlaying format.</p>;
    }
  }

  return (
    <div className="container">
      <div className="hero mb-4">
        <h1>🎧 Jukebox #{code}</h1>
        <p>Now playing and queue overview</p>
      </div>

      {loading && <Spinner animation="border" />}

      {info && (
        <>
          <Card className="mb-4 text-center">
            <Card.Body>
              <h2 className="text-green mb-3">Now Playing</h2>
              {renderNowPlaying(info.nowPlaying)}
            </Card.Body>
          </Card>

          {user.loggedIn && (
            <Card className="mb-4">
              <Card.Body>
                <Form
                  onSubmit={(e) => {
                    e.preventDefault();
                    handleAddSong();
                  }}
                >
                  <Row className="align-items-center">
                    <Col md={4}>
                      <Form.Control
                        placeholder="Song URL"
                        value={song}
                        onChange={(e) => setSong(e.target.value)}
                      />
                    </Col>
                    <Col md={3}>
                      <Form.Control
                        placeholder="Display name"
                        value={displayName}
                        onChange={(e) => setDisplayName(e.target.value)}
                      />
                    </Col>
                    <Col md={2}>
                      <Form.Control
                        type="number"
                        step="0.1"
                        value={amount}
                        onChange={(e) => setAmount(parseFloat(e.target.value))}
                      />
                      <Form.Text className="text-muted">FLOW</Form.Text>
                    </Col>
                    <Col md={2}>
                      <Form.Control
                        type="number"
                        step="1"
                        value={duration}
                        onChange={(e) => setDuration(parseFloat(e.target.value))}
                      />
                      <Form.Text className="text-muted">Sec</Form.Text>
                    </Col>
                    <Col md={1}>
                      <Button
                        variant="primary"
                        type="submit"
                        className="w-100"
                        disabled={loading}
                      >
                        ➕
                      </Button>
                    </Col>
                  </Row>
                </Form>
              </Card.Body>
            </Card>
          )}

          <Card>
            <Card.Body>
              <h4 className="text-green mb-3">Queue</h4>
              {info.entries?.length ? (
                <ul className="list-group">
                  {info.entries.map((e, i) => (
                    <li key={i} className="list-group-item">
                      <strong>{e.displayName}</strong>{" "}
                      <span className="text-muted">
                        ({e.totalBacking} FLOW, {e.duration}s)
                      </span>
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
    </div>
  );
}
