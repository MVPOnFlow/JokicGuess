import { useEffect, useState, useMemo } from "react";
import * as fcl from "@onflow/fcl";
import { GET_MY_HORSES, TX_MINT_WITH_FLOW, TX_PET } from "../flow/cadence";
import "bootstrap/dist/css/bootstrap.min.css";

export default function Stables() {
  const [user, setUser] = useState({ loggedIn: null });
  const [loading, setLoading] = useState(false);
  const [horses, setHorses] = useState([]); // [{id, name, speed, stamina, strength, lastPetTime, cooldownRemaining}]
  const [minting, setMinting] = useState(false);
  const [pettingId, setPettingId] = useState(null);
  const [newHorseName, setNewHorseName] = useState("");

  useEffect(() => {
    fcl.currentUser().subscribe(setUser);
  }, []);

  const isConnected = useMemo(() => !!user?.addr, [user]);

  const refresh = async () => {
    if (!user?.addr) {
      setHorses([]);
      return;
    }
    try {
      setLoading(true);
      const res = await fcl.query({
        cadence: GET_MY_HORSES,
        args: (arg, t) => [arg(user.addr, t.Address)],
      });
      setHorses(res ?? []);
    } catch (e) {
      console.error("Failed to load horses:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.addr]);

  const onMint = async (e) => {
    e.preventDefault();
    if (!isConnected) return fcl.authenticate();
    if (!newHorseName.trim()) return;
    try {
      setMinting(true);
      const txId = await fcl.mutate({
        cadence: TX_MINT_WITH_FLOW,
        args: (arg, t) => [
          arg(newHorseName.trim(), t.String),
          arg(user.addr, t.Address), // mint to self; tx will auto-setup collection if missing
        ],
        proposer: fcl.currentUser().authorization,
        payer: fcl.currentUser().authorization,
        authorizations: [fcl.currentUser().authorization],
        limit: 250,
      });
      await fcl.tx(txId).onceSealed();
      setNewHorseName("");
      await refresh();
    } catch (e) {
      console.error("Mint error:", e);
      alert(e?.message ?? "Mint failed");
    } finally {
      setMinting(false);
    }
  };

  const onPet = async (horseId) => {
    if (!isConnected) return fcl.authenticate();
    try {
      setPettingId(horseId);
      const txId = await fcl.mutate({
        cadence: TX_PET,
        args: (arg, t) => [arg(String(horseId), t.UInt64)],
        proposer: fcl.currentUser().authorization,
        payer: fcl.currentUser().authorization,
        authorizations: [fcl.currentUser().authorization],
        limit: 250,
      });
      await fcl.tx(txId).onceSealed();
      await refresh();
    } catch (e) {
      console.error("Pet error:", e);
      alert(e?.message ?? "Petting failed");
    } finally {
      setPettingId(null);
    }
  };

  const fmtSecs = (s) => {
    const sec = Math.floor(Number(s || 0));
    if (sec <= 0) return "Ready";
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const r = sec % 60;
    return `${h}h ${m}m ${r}s`;
  };

  return (
    <div className="container">
      <div className="d-flex align-items-center justify-content-between mb-4">
        <h2 className="mb-0">Stables</h2>
        <button
          className="btn btn-outline-secondary btn-sm"
          onClick={refresh}
          disabled={loading}
          title="Reload"
        >
          Refresh
        </button>
      </div>

      {/* Mint box */}
      <div className="card shadow-sm mb-4">
        <div className="card-body">
          <h5 className="card-title mb-3">Mint a New Horse</h5>
          <form className="row g-2 align-items-center" onSubmit={onMint}>
            <div className="col-sm-6 col-md-4">
              <input
                className="form-control"
                placeholder="Horse name"
                value={newHorseName}
                onChange={(e) => setNewHorseName(e.target.value)}
                disabled={!isConnected || minting}
              />
            </div>
            <div className="col-auto">
              <button
                className="btn btn-primary"
                type="submit"
                disabled={!isConnected || minting || !newHorseName.trim()}
                title="Costs 50.0 FLOW"
              >
                {minting ? "Minting..." : "Mint (50.0 FLOW)"}
              </button>
            </div>
            <div className="col-auto">
              <a
                href="https://port.onflow.org/"
                target="_blank"
                rel="noreferrer"
                className="text-decoration-none small d-inline-flex align-items-center"
                title="Top up FlowToken"
              >
                Get FLOW
                <i className="bi bi-box-arrow-up-right ms-1" />
              </a>
            </div>
          </form>
        </div>
      </div>

      {/* Horses list */}
      <h5 className="mb-3">My Horses</h5>
      {loading ? (
        <div className="text-muted">Loading…</div>
      ) : !isConnected ? (
        <div className="alert alert-warning">Connect your wallet to see your horses.</div>
      ) : horses.length === 0 ? (
        <div className="text-muted">No horses yet. Mint your first one!</div>
      ) : (
        <div className="row g-3">
          {horses.map((h) => {
            const cooldown = Number(h.cooldownRemaining || 0);
            const canPet = cooldown <= 0;
            const working = pettingId === h.id;
            return (
              <div key={h.id} className="col-sm-6 col-md-4 col-lg-3">
                <div className="card h-100 shadow-sm">
                  <img
                    src="/horse-card.png"
                    alt="Horse"
                    className="card-img-top"
                    style={{ objectFit: "cover", height: 140 }}
                    onError={(e) => (e.currentTarget.style.display = "none")}
                  />
                  <div className="card-body d-flex flex-column">
                    <h6 className="card-title mb-1">
                      {h.name || `Horse #${h.id}`}
                    </h6>
                    <div className="text-muted small mb-2">ID: {h.id}</div>
                    <div className="d-flex justify-content-between small mb-1">
                      <span>Speed</span><strong>{h.speed}</strong>
                    </div>
                    <div className="d-flex justify-content-between small mb-1">
                      <span>Stamina</span><strong>{h.stamina}</strong>
                    </div>
                    <div className="d-flex justify-content-between small mb-3">
                      <span>Strength</span><strong>{h.strength}</strong>
                    </div>
                    <div className="mt-auto">
                      <button
                        className="btn btn-success w-100"
                        disabled={!canPet || working}
                        onClick={() => onPet(h.id)}
                        title={canPet ? "Costs 1.0 FLOW" : `Cooldown: ${fmtSecs(h.cooldownRemaining)}`}
                      >
                        {working ? "Petting…" : canPet ? "Pet (1.0 FLOW)" : `Cooldown: ${fmtSecs(h.cooldownRemaining)}`}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
