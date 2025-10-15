import { useState, useEffect } from "react";
import * as fcl from "@onflow/fcl";
import {
  Card,
  Button,
  Form,
  Row,
  Col,
  Spinner,
  Modal,
  OverlayTrigger,
  Tooltip,
  Badge,
} from "react-bootstrap";
import { useNavigate } from "react-router-dom";
import {
  TX_CREATE_AND_START,
  SCRIPT_GET_USERS_JUKEBOXES,
} from "../flow/cadence";

export default function JukeboxHome() {
  const [user, setUser] = useState({ loggedIn: null });
  const [jukeboxes, setJukeboxes] = useState([]);
  const [loading, setLoading] = useState(false);

  const [hours, setHours] = useState(2);
  const [name, setName] = useState("");

  const [showModal, setShowModal] = useState(false);
  const [modalKind, setModalKind] = useState("progress");
  const [modalTitle, setModalTitle] = useState("");
  const [modalMsg, setModalMsg] = useState("");

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

  const mintCostFlow = Number.isFinite(hours) ? hours * 10 : 0;

  function openModal(kind, title, msg) {
    setModalKind(kind);
    setModalTitle(title);
    setModalMsg(msg);
    setShowModal(true);
  }
  function closeModal() {
    setShowModal(false);
  }

  async function handleCreate() {
    if (!user.loggedIn)
      return openModal("error", "Wallet Required", "Connect your wallet first.");
    if (!name.trim())
      return openModal("error", "Missing Name", "Enter a name for your jukebox.");
    if (!Number.isInteger(hours) || hours <= 0)
      return openModal("error", "Invalid Duration", "Enter a valid integer number of hours.");

    try {
      setLoading(true);
      openModal(
        "progress",
        "Minting Jukebox",
        `Creating "${name}" for ${hours}h (${mintCostFlow} $FLOW est.)`
      );

      const queueIdentifier = name.trim().toUpperCase();
      const seconds = hours * 3600;

      const txId = await fcl.mutate({
        cadence: TX_CREATE_AND_START,
        args: (arg, t) => [
          arg(queueIdentifier, t.String),
          arg(toUFix64(seconds), t.UFix64),
        ],
        proposer: fcl.authz,
        payer: fcl.authz,
        authorizations: [fcl.authz],
        limit: 9999,
      });

      await fcl.tx(txId).onceSealed();

      const boxes = await fcl.query({
        cadence: SCRIPT_GET_USERS_JUKEBOXES,
        args: (arg, t) => [arg(user.addr, t.Address)],
      });

      const created = (boxes || []).find(
        (b) => b.queueIdentifier === queueIdentifier
      );

      openModal(
        "success",
        "Jukebox Created",
        "Your jukebox has been created and autoplay started!"
      );

      setName("");
      fetchJukeboxes();

      if (created?.id) {
        setTimeout(() => {
          closeModal();
          navigate(`/jukebox/${created.id}`);
        }, 1000);
      }
    } catch (err) {
      console.error("Create error:", err);
      openModal("error", "Mint Failed", "Something went wrong creating your jukebox.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="container">
      <div className="hero mb-4">
        <h1>🎶 Flow Jukebox</h1>
        <p>
          Create a <strong>jukebox NFT</strong> that lets anyone queue songs by
          paying <strong>$FLOW</strong>.
        </p>
        <p>
          Songs with more backing play sooner. When the jukebox ends, you earn{" "}
          <strong>80%</strong> of all <strong>$FLOW</strong> contributed.
        </p>
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
              <Row className="g-3 align-items-end">
                <Col md={5}>
                  <Form.Label>Jukebox Name</Form.Label>
                  <Form.Control
                    placeholder="e.g. FRIDAY PARTY"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                </Col>
                <Col md={3}>
                  <Form.Label>Duration (hours)</Form.Label>
                  <Form.Control
                    type="number"
                    min={1}
                    step={1}
                    value={hours}
                    onChange={(e) =>
                      setHours(parseInt(e.target.value || "0", 10))
                    }
                  />
                </Col>
                <Col md={2}>
                  <Form.Label>Est. Cost</Form.Label>
                  <OverlayTrigger
                    overlay={
                      <Tooltip>
                        Preview only. Contract determines cost on-chain.
                      </Tooltip>
                    }
                    placement="top"
                  >
                    <div className="form-control text-green fw-semibold text-center bg-transparent">
                      {formatInt(mintCostFlow)} $FLOW
                    </div>
                  </OverlayTrigger>
                </Col>
                <Col md={2}>
                  <Button
                    variant="primary"
                    type="submit"
                    className="w-100"
                    disabled={loading}
                  >
                    {loading ? (
                      <Spinner animation="border" size="sm" />
                    ) : (
                      "Create Jukebox"
                    )}
                  </Button>
                </Col>
              </Row>
            </Form>
          </Card.Body>
        </Card>
      )}

      {loading && (
        <div className="text-center mb-3">
          <Spinner animation="border" />
        </div>
      )}

      <h4 className="text-green mb-3">My Jukeboxes</h4>
      {jukeboxes.length ? (
        <Row>
          {jukeboxes.map((j) => (
            <Col key={j.id} md={4} className="mb-3">
              <Card
                className="jukebox-card h-100"
                onClick={() => navigate(`/jukebox/${j.id}`)}
              >
                <Card.Body>
                  <h5 className="text-green mb-1">{j.queueIdentifier}</h5>
                  <p className="text-muted mb-2">
                    Now playing: {j.nowPlaying?.displayName ?? "—"}
                  </p>
                  <div className="d-flex justify-content-between align-items-center">
                    <Badge bg="dark-green">
                      {formatInt(j.totalBacking)} $FLOW
                    </Badge>
                    <Badge bg="dark-gray">
                      {formatTimeLeft(j.queueDuration)}
                    </Badge>
                  </div>
                </Card.Body>
              </Card>
            </Col>
          ))}
        </Row>
      ) : (
        <p className="text-muted">No jukeboxes found.</p>
      )}

      {/* Modal */}
      <Modal
        show={showModal}
        onHide={modalKind === "progress" ? undefined : closeModal}
        centered
      >
        <Modal.Header className={`modal-header-${modalKind}`}>
          <Modal.Title>{modalTitle}</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {modalKind === "progress" ? (
            <div className="d-flex align-items-center gap-3">
              <Spinner animation="border" />
              <div>
                <div className="fw-semibold text-green">
                  Awaiting wallet approval
                </div>
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

/* ---------- helpers ---------- */
function toUFix64(n) {
  const i = Math.max(0, Math.floor(Number(n) || 0));
  return `${i}.0`;
}
function formatInt(x) {
  const n = Number(x);
  if (!Number.isFinite(n)) return "0";
  return Math.round(n).toString();
}
function formatTimeLeft(queueDuration) {
  const dur = Number(queueDuration) || 0;
  if (dur <= 0) return "Expired";
  const h = Math.floor(dur / 3600);
  const m = Math.floor((dur % 3600) / 60);
  return `${h}h ${m}m left`;
}
