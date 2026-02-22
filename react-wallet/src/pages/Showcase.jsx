import React, { useState, useEffect } from 'react';
import { Container, Row, Col, Card, Badge, Spinner, Form, InputGroup, Button, Alert } from 'react-bootstrap';
import * as fcl from "@onflow/fcl";
import './Showcase.css';

const TIER_COLORS = {
  ULTIMATE: '#e600ff',
  LEGENDARY: '#ffd700',
  RARE: '#00bfff',
  FANDOM: '#40e0d0',
  COMMON: '#adb5bd',
};

const TIER_ORDER = ['ULTIMATE', 'LEGENDARY', 'RARE', 'FANDOM', 'COMMON'];

function tierBadge(tier) {
  const color = TIER_COLORS[tier] || '#adb5bd';
  return (
    <Badge
      className="tier-badge"
      style={{ backgroundColor: color, color: tier === 'LEGENDARY' ? '#1a1a2e' : '#fff' }}
    >
      {tier}
    </Badge>
  );
}

export default function Showcase() {
  const [user, setUser] = useState({ loggedIn: null });
  const [searchUsername, setSearchUsername] = useState('');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [filterTier, setFilterTier] = useState('ALL');
  const [filterCategory, setFilterCategory] = useState('ALL');
  const [resolvedUsername, setResolvedUsername] = useState(null);

  useEffect(() => {
    fcl.currentUser().subscribe(setUser);
  }, []);

  // Auto-fetch when wallet connects
  useEffect(() => {
    if (user.loggedIn && user.addr && !data && !loading) {
      fetchByWallet(user.addr);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user.loggedIn, user.addr]);

  async function fetchByWallet(wallet) {
    setLoading(true);
    setError(null);
    setData(null);
    setResolvedUsername(null);
    try {
      const resp = await fetch(`/api/showcase/${wallet}`);
      const json = await resp.json();
      if (!resp.ok) {
        setError(json.error || 'Failed to load moments');
        return;
      }
      setData(json);
      setResolvedUsername(json.username);
    } catch (e) {
      setError('Network error: ' + e.message);
    } finally {
      setLoading(false);
    }
  }

  async function fetchByUsername(username) {
    if (!username.trim()) return;
    setLoading(true);
    setError(null);
    setData(null);
    setResolvedUsername(null);
    try {
      const resp = await fetch(`/api/showcase/user/${encodeURIComponent(username.trim())}`);
      const json = await resp.json();
      if (!resp.ok) {
        setError(json.error || 'Failed to load moments');
        return;
      }
      setData(json);
      setResolvedUsername(json.username);
    } catch (e) {
      setError('Network error: ' + e.message);
    } finally {
      setLoading(false);
    }
  }

  function handleSearch(e) {
    e.preventDefault();
    fetchByUsername(searchUsername);
  }

  // Filter moments
  const filteredMoments = (data?.moments || []).filter(m => {
    if (filterTier !== 'ALL' && m.tier !== filterTier) return false;
    if (filterCategory !== 'ALL' && m.playCategory !== filterCategory) return false;
    return true;
  });

  // Unique play categories for filter
  const categories = [...new Set((data?.moments || []).map(m => m.playCategory).filter(Boolean))].sort();

  return (
    <Container className="showcase-page py-4">
      {/* Header */}
      <div className="text-center mb-4">
        <h1 className="showcase-title">🏀 Jokić Moment Showcase</h1>
        <p className="text-muted">
          View any collector's Nikola Jokić NBA TopShot moments
        </p>
      </div>

      {/* Search bar */}
      <Card className="shadow mb-4 search-card">
        <Card.Body>
          <Form onSubmit={handleSearch}>
            <InputGroup>
              <Form.Control
                type="text"
                placeholder="Enter TopShot username..."
                value={searchUsername}
                onChange={(e) => setSearchUsername(e.target.value)}
                className="search-input"
              />
              <Button type="submit" variant="warning" disabled={loading || !searchUsername.trim()}>
                {loading ? <Spinner size="sm" animation="border" /> : '🔍 Search'}
              </Button>
            </InputGroup>
          </Form>
          {user.loggedIn && (
            <div className="mt-2 text-center">
              <Button
                variant="outline-light"
                size="sm"
                onClick={() => fetchByWallet(user.addr)}
                disabled={loading}
              >
                Or load my collection ({user.addr?.substring(0, 8)}...)
              </Button>
            </div>
          )}
        </Card.Body>
      </Card>

      {/* Error */}
      {error && <Alert variant="danger" className="text-center">{error}</Alert>}

      {/* Loading */}
      {loading && (
        <div className="text-center py-5">
          <Spinner animation="border" variant="warning" />
          <p className="mt-3 text-muted">Fetching Jokić moments...</p>
        </div>
      )}

      {/* Results */}
      {data && !loading && (
        <>
          {/* Summary card */}
          <Card className="shadow mb-4 summary-card">
            <Card.Body>
              <Row className="text-center align-items-center">
                <Col xs={12} md={4}>
                  <h4 className="mb-1">{resolvedUsername}</h4>
                  <small className="text-muted">TopShot Collector</small>
                </Col>
                <Col xs={12} md={4}>
                  <h2 className="showcase-count mb-0">{data.totalCount || data.moments.length}</h2>
                  <small className="text-muted">Jokić Moments</small>
                </Col>
                <Col xs={12} md={4}>
                  <div className="tier-breakdown">
                    {TIER_ORDER.map(tier => {
                      const count = data.tierBreakdown?.[tier];
                      if (!count) return null;
                      return (
                        <span key={tier} className="tier-chip me-2" style={{ borderColor: TIER_COLORS[tier] }}>
                          <span className="tier-dot" style={{ backgroundColor: TIER_COLORS[tier] }} />
                          {count} {tier.charAt(0) + tier.slice(1).toLowerCase()}
                        </span>
                      );
                    })}
                  </div>
                </Col>
              </Row>
            </Card.Body>
          </Card>

          {/* Filters */}
          {data.moments.length > 0 && (
            <Row className="mb-3 gx-2">
              <Col xs="auto">
                <Form.Select
                  size="sm"
                  value={filterTier}
                  onChange={e => setFilterTier(e.target.value)}
                  className="filter-select"
                >
                  <option value="ALL">All Tiers</option>
                  {TIER_ORDER.map(t => (
                    <option key={t} value={t}>{t.charAt(0) + t.slice(1).toLowerCase()}</option>
                  ))}
                </Form.Select>
              </Col>
              <Col xs="auto">
                <Form.Select
                  size="sm"
                  value={filterCategory}
                  onChange={e => setFilterCategory(e.target.value)}
                  className="filter-select"
                >
                  <option value="ALL">All Play Types</option>
                  {categories.map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </Form.Select>
              </Col>
              <Col xs="auto" className="d-flex align-items-center">
                <small className="text-muted">{filteredMoments.length} moment{filteredMoments.length !== 1 ? 's' : ''}</small>
              </Col>
            </Row>
          )}

          {/* Moment grid */}
          {filteredMoments.length === 0 ? (
            <Alert variant="secondary" className="text-center">
              {data.moments.length === 0
                ? "No Jokić moments found for this collector."
                : "No moments match the current filters."}
            </Alert>
          ) : (
            <Row xs={1} sm={2} md={3} lg={4} className="g-3 moment-grid">
              {filteredMoments.map((moment) => (
                <Col key={moment.id || moment.flowId}>
                  <MomentCard moment={moment} />
                </Col>
              ))}
            </Row>
          )}
        </>
      )}

      {/* Empty state — no wallet, no search */}
      {!data && !loading && !error && (
        <div className="text-center py-5 empty-state">
          <div style={{ fontSize: '4rem' }}>🃏</div>
          <h4 className="mt-3">Search for a collector</h4>
          <p className="text-muted">
            Enter a TopShot username above, or connect your Flow wallet to see your Jokić collection.
          </p>
        </div>
      )}
    </Container>
  );
}

function MomentCard({ moment }) {
  const tierColor = TIER_COLORS[moment.tier] || '#adb5bd';
  const [imgError, setImgError] = useState(false);

  // Format date nicely
  const dateStr = moment.dateOfMoment
    ? new Date(moment.dateOfMoment).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
    : '';

  // Game stats one-liner
  const statsLine = moment.gameStats
    ? [
        moment.gameStats.points != null && `${moment.gameStats.points} PTS`,
        moment.gameStats.rebounds != null && `${moment.gameStats.rebounds} REB`,
        moment.gameStats.assists != null && `${moment.gameStats.assists} AST`,
      ].filter(Boolean).join(' / ')
    : '';

  return (
    <Card className="moment-card h-100 shadow-sm" style={{ borderColor: tierColor }}>
      <div className="moment-image-wrapper" style={{ borderBottomColor: tierColor }}>
        {moment.imageUrl && !imgError ? (
          <img
            src={moment.imageUrl}
            alt={`${moment.setName} - ${moment.playCategory}`}
            className="moment-image"
            onError={() => setImgError(true)}
            loading="lazy"
          />
        ) : (
          <div className="moment-placeholder">
            <span>🏀</span>
          </div>
        )}
        <div className="moment-serial" style={{ backgroundColor: tierColor }}>
          #{moment.serial}
          {moment.circulationCount && <span className="circulation">/{moment.circulationCount}</span>}
        </div>
      </div>

      <Card.Body className="d-flex flex-column p-2">
        <div className="d-flex justify-content-between align-items-start mb-1">
          {tierBadge(moment.tier)}
          {moment.playCategory && (
            <Badge bg="dark" className="play-badge">{moment.playCategory}</Badge>
          )}
        </div>

        <h6 className="moment-set-name mb-1">{moment.setName}</h6>

        {dateStr && <small className="text-muted">{dateStr}</small>}

        {statsLine && (
          <div className="game-stats mt-1">
            <small className="stats-line">{statsLine}</small>
          </div>
        )}

        {moment.forSale && moment.price && (
          <div className="mt-auto pt-1">
            <Badge bg="success" className="price-badge">${parseFloat(moment.price).toFixed(2)}</Badge>
          </div>
        )}
      </Card.Body>
    </Card>
  );
}
