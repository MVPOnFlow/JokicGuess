import { useState, useEffect } from "react";
import * as fcl from "@onflow/fcl";
import { Card, Button, Form, Row, Col, Spinner } from "react-bootstrap";
import { useNavigate } from "react-router-dom";
import {
  TX_CREATE_AND_START,
  SCRIPT_GET_USERS_JUKEBOXES,
} from "../flow/cadence";

export default function JukeboxHome() {
  const [user, setUser] = useState({ loggedIn: null });
  const [jukeboxes, setJukeboxes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [newName, setNewName] = useState("");
  const [duration, setDuration] = useState(7200.0); // 2h default
  const navigate = useNavigate();

  useEffect(() => fcl.currentUser().subscribe(setUser), []);
  useEffect(() => {
    if (user.loggedIn) fetchJukeboxes();
  }, [user]);

  async function fetchJukeboxes() {
    try {
      setLoading(true);
      const res = await fcl.query({
        cadence: SCRIPT_GET_USERS_JUKEBOXES,
        args: (arg, t) => [arg(user.addr, t.Address)],
      });
      setJukeboxes(res || []);
    } catch (e) {
      console.error("Error fetching jukeboxes:", e);
    } finally {
      setLoading(false);
    }
  }

  async function handleCreate() {
    if (!user.loggedIn) return alert("Connect wallet first.");
    if (!newName.trim()) return alert("Enter a name for your jukebox.");
    try {
      setLoading(true);
      const queueIdentifier = newName.trim().toUpperCase();
      const txId = await fcl.mutate({
        cadence: TX_CREATE_AND_START,
        args: (arg, t) => [
          arg(queueIdentifier, t.String),
          arg(duration.toFixed(1), t.UFix64),
        ],
        proposer: fcl.authz,
        payer: fcl.authz,
        authorizations: [fcl.authz],
        limit: 9999,
      });

      console.log("TX sent:", txId);
      await fcl.tx(txId).onceSealed();
      console.log("TX sealed");

      // Refresh and navigate to the new jukebox
      const boxes = await fcl.query({
        cadence: SCRIPT_GET_USERS_JUKEBOXES,
        args: (arg, t) => [arg(user.addr, t.Address)],
      });
      const created = (boxes || []).find(
        (b) => b.queueIdentifier === queueIdentifier
      );
      if (created?.id) {
        navigate(`/jukebox/${created.id}`);
      } else {
        fetchJukeboxes();
      }

      alert("🎶 Jukebox created and autoplay started!");
      setNewName("");
    } catch (err) {
      console.error("Create error:", err);
      alert("❌ Failed to create jukebox.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="container">
      <div className="hero mb-4">
        <h1>🎶 Flow Jukebox</h1>
        <p>Create a jukebox NFT and start playback instantly.</p>
      </div>

      {!user.loggedIn && (
        <p className="text-center text-muted">Connect wallet to continue.</p>
      )}

      {user.loggedIn && (
        <Card className="mb-4">
          <Card.Body>
            <Form
              onSubmit={(e) => {
                e.preventDefault();
                handleCreate();
              }}
            >
              <Row className="align-items-center">
                <Col md={5}>
                  <Form.Control
                    placeholder="Enter new jukebox name"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                  />
                </Col>
                <Col md={4}>
                  <Form.Control
                    type="number"
                    step="1"
                    value={duration}
                    onChange={(e) => setDuration(parseFloat(e.target.value))}
                  />
                  <Form.Text className="text-muted">
                    Duration (seconds)
                  </Form.Text>
                </Col>
                <Col md={3}>
                  <Button
                    variant="primary"
                    type="submit"
                    className="w-100"
                    disabled={loading}
                  >
                    {loading ? (
                      <Spinner animation="border" size="sm" />
                    ) : (
                      "🪩 Create Jukebox"
                    )}
                  </Button>
                </Col>
              </Row>
            </Form>
          </Card.Body>
        </Card>
      )}

      {loading ? (
        <div className="text-center">
          <Spinner animation="border" />
        </div>
      ) : (
        <>
          <h4 className="text-green mb-3">My Jukeboxes</h4>
          {jukeboxes.length ? (
            <Row>
              {jukeboxes.map((j) => (
                <Col key={j.id} md={4} className="mb-3">
                  <Card
                    className="h-100"
                    style={{ cursor: "pointer" }}
                    onClick={() => navigate(`/jukebox/${j.id}`)}
                  >
                    <Card.Body>
                      <h5>{j.queueIdentifier}</h5>
                      <p className="text-muted mb-1">
                        Now playing: {j.nowPlaying?.displayName ?? "N/A"}
                      </p>
                      <p className="small">Total Backing: {j.totalBacking}</p>
                    </Card.Body>
                  </Card>
                </Col>
              ))}
            </Row>
          ) : (
            <p>No jukeboxes found.</p>
          )}
        </>
      )}
    </div>
  );
}
