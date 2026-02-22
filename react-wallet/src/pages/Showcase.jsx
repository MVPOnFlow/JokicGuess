import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Container, Row, Col, Card, Badge, Spinner, Form, Alert, Modal } from 'react-bootstrap';
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
      style={{ backgroundColor: color, color: ['LEGENDARY', 'COMMON'].includes(tier) ? '#1a1a2e' : '#fff' }}
    >
      {tier}
    </Badge>
  );
}

function formatPrice(val) {
  if (!val || val === 0 || val === "0.00") return null;
  const n = typeof val === 'string' ? parseFloat(val) : val;
  if (isNaN(n) || n === 0) return null;
  return `$${n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

export default function Showcase() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filterTier, setFilterTier] = useState('ALL');
  const [filterCategory, setFilterCategory] = useState('ALL');
  const [filterSeason, setFilterSeason] = useState('ALL');
  const [sortBy, setSortBy] = useState('DATE_DESC');

  useEffect(() => {
    fetchEditions();
  }, []);

  async function fetchEditions() {
    setLoading(true);
    setError(null);
    try {
      const resp = await fetch('/api/showcase');
      const json = await resp.json();
      if (!resp.ok) {
        setError(json.error || 'Failed to load editions');
        return;
      }
      setData(json);
    } catch (e) {
      setError('Network error: ' + e.message);
    } finally {
      setLoading(false);
    }
  }

  const editions = data?.editions || [];

  // Filter
  const filtered = editions.filter(m => {
    if (filterTier !== 'ALL' && m.tier !== filterTier) return false;
    if (filterCategory !== 'ALL' && m.playCategory !== filterCategory) return false;
    if (filterSeason !== 'ALL' && m.nbaSeason !== filterSeason) return false;
    return true;
  });

  // Sort
  const sorted = [...filtered].sort((a, b) => {
    switch (sortBy) {
      case 'DATE_DESC':
        return (b.dateOfMoment || '').localeCompare(a.dateOfMoment || '');
      case 'DATE_ASC':
        return (a.dateOfMoment || '').localeCompare(b.dateOfMoment || '');
      case 'PRICE_DESC':
        return (b.lowAsk || 0) - (a.lowAsk || 0);
      case 'PRICE_ASC': {
        const aPrice = a.lowAsk || Infinity;
        const bPrice = b.lowAsk || Infinity;
        return aPrice - bPrice;
      }
      case 'TIER': {
        const order = { ULTIMATE: 0, LEGENDARY: 1, RARE: 2, FANDOM: 3, COMMON: 4 };
        return (order[a.tier] ?? 5) - (order[b.tier] ?? 5);
      }
      default:
        return 0;
    }
  });

  // Unique values for filters
  const categories = [...new Set(editions.map(m => m.playCategory).filter(Boolean))].sort();
  const seasons = [...new Set(editions.map(m => m.nbaSeason).filter(Boolean))].sort().reverse();

  // Total market value (sum of lowAsk for all editions)
  const totalMarketValue = editions.reduce((sum, e) => sum + (e.lowAsk || 0), 0);

  return (
    <Container className="showcase-page py-4">
      {/* Header */}
      <div className="text-center mb-4">
        <h1 className="showcase-title">🏀 Jokić Moment Catalog</h1>
        <p className="text-muted">
          Every Nikola Jokić NBA TopShot edition — prices, stats, and market data
        </p>
      </div>

      {/* Loading */}
      {loading && (
        <div className="text-center py-5">
          <Spinner animation="border" variant="warning" />
          <p className="mt-3 text-muted">Loading all Jokić editions...</p>
        </div>
      )}

      {/* Error */}
      {error && <Alert variant="danger" className="text-center">{error}</Alert>}

      {data && !loading && (
        <>
          {/* Summary */}
          <Card className="shadow mb-4 summary-card">
            <Card.Body>
              <Row className="text-center align-items-center">
                <Col xs={6} md={3}>
                  <h2 className="showcase-count mb-0">{data.totalCount}</h2>
                  <small className="text-muted">Total Editions</small>
                </Col>
                <Col xs={6} md={3}>
                  <h2 className="showcase-count mb-0">{formatPrice(totalMarketValue) || '$0'}</h2>
                  <small className="text-muted">Total Market (Low Ask)</small>
                </Col>
                <Col xs={12} md={6} className="mt-3 mt-md-0">
                  <div className="tier-breakdown">
                    {TIER_ORDER.map(tier => {
                      const count = data.tierBreakdown?.[tier];
                      if (!count) return null;
                      return (
                        <span
                          key={tier}
                          className={`tier-chip me-2 ${filterTier === tier ? 'active' : ''}`}
                          style={{ borderColor: TIER_COLORS[tier], cursor: 'pointer' }}
                          onClick={() => setFilterTier(filterTier === tier ? 'ALL' : tier)}
                        >
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
          <Row className="mb-3 gx-2 filter-row">
            <Col xs="auto">
              <Form.Select size="sm" value={filterTier} onChange={e => setFilterTier(e.target.value)} className="filter-select">
                <option value="ALL">All Tiers</option>
                {TIER_ORDER.map(t => (
                  <option key={t} value={t}>{t.charAt(0) + t.slice(1).toLowerCase()}</option>
                ))}
              </Form.Select>
            </Col>
            <Col xs="auto">
              <Form.Select size="sm" value={filterCategory} onChange={e => setFilterCategory(e.target.value)} className="filter-select">
                <option value="ALL">All Play Types</option>
                {categories.map(c => <option key={c} value={c}>{c}</option>)}
              </Form.Select>
            </Col>
            <Col xs="auto">
              <Form.Select size="sm" value={filterSeason} onChange={e => setFilterSeason(e.target.value)} className="filter-select">
                <option value="ALL">All Seasons</option>
                {seasons.map(s => <option key={s} value={s}>{s}</option>)}
              </Form.Select>
            </Col>
            <Col xs="auto">
              <Form.Select size="sm" value={sortBy} onChange={e => setSortBy(e.target.value)} className="filter-select">
                <option value="DATE_DESC">Newest First</option>
                <option value="DATE_ASC">Oldest First</option>
                <option value="PRICE_DESC">Price: High → Low</option>
                <option value="PRICE_ASC">Price: Low → High</option>
                <option value="TIER">By Tier</option>
              </Form.Select>
            </Col>
            <Col xs="auto" className="d-flex align-items-center">
              <small className="text-muted">{sorted.length} edition{sorted.length !== 1 ? 's' : ''}</small>
            </Col>
          </Row>

          {/* Edition grid */}
          {sorted.length === 0 ? (
            <Alert variant="secondary" className="text-center">
              No editions match the current filters.
            </Alert>
          ) : (
            <Row xs={1} sm={2} md={3} lg={4} className="g-3 moment-grid">
              {sorted.map(edition => (
                <Col key={edition.id}>
                  <EditionCard edition={edition} />
                </Col>
              ))}
            </Row>
          )}
        </>
      )}
    </Container>
  );
}

function EditionCard({ edition }) {
  const tierColor = TIER_COLORS[edition.tier] || '#adb5bd';
  const [imgError, setImgError] = useState(false);
  const [hovering, setHovering] = useState(false);
  const videoRef = useRef(null);

  const videoUrl = edition.videoUrl || '';

  const handleMouseEnter = useCallback(() => { if (videoUrl) setHovering(true); }, [videoUrl]);
  const handleMouseLeave = useCallback(() => setHovering(false), []);

  const dateStr = edition.dateOfMoment
    ? new Date(edition.dateOfMoment).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
    : '';

  const statsLine = edition.gameStats
    ? [
        edition.gameStats.points != null && `${edition.gameStats.points} PTS`,
        edition.gameStats.rebounds != null && `${edition.gameStats.rebounds} REB`,
        edition.gameStats.assists != null && `${edition.gameStats.assists} AST`,
      ].filter(Boolean).join(' / ')
    : '';

  const lowAskStr = formatPrice(edition.lowAsk);
  const avgPriceStr = formatPrice(edition.averagePrice);
  const offerStr = formatPrice(edition.highestOffer);

  return (
    <Card className="moment-card h-100 shadow-sm" style={{ borderColor: tierColor }}>
      {/* Image / Video */}
      <div
        className="moment-image-wrapper"
        style={{ borderBottomColor: tierColor }}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        {/* Static image (hidden while hovering) */}
        {edition.imageUrl && !imgError ? (
          <img
            src={edition.imageUrl}
            alt={`${edition.setName} - ${edition.playCategory}`}
            className="moment-image"
            style={{ opacity: hovering && videoUrl ? 0 : 1 }}
            onError={() => setImgError(true)}
            loading="lazy"
          />
        ) : (
          <div className="moment-placeholder">
            <span>🏀</span>
          </div>
        )}
        {/* Video (plays on hover) */}
        {hovering && videoUrl && (
          <video
            ref={videoRef}
            src={videoUrl}
            className="moment-video"
            autoPlay
            loop
            playsInline
            muted
          />
        )}
        {/* Circulation badge */}
        <div className="moment-serial" style={{ backgroundColor: tierColor }}>
          {edition.retired ? '🔒 ' : ''}{edition.circulationCount ? `/${edition.circulationCount}` : ''}
        </div>
      </div>

      <Card.Body className="d-flex flex-column p-2">
        {/* Tier + play category */}
        <div className="d-flex justify-content-between align-items-start mb-1">
          {tierBadge(edition.tier)}
          {edition.playCategory && (
            <Badge bg="dark" className="play-badge">{edition.playCategory}</Badge>
          )}
        </div>

        {/* Set name */}
        <h6 className="moment-set-name mb-1">{edition.setName}</h6>

        {/* Description */}
        {edition.shortDescription && (
          <small className="text-muted moment-description">{edition.shortDescription}</small>
        )}

        {/* Date + Season */}
        <div className="d-flex justify-content-between mt-1">
          {dateStr && <small className="text-muted">{dateStr}</small>}
          {edition.nbaSeason && <small className="season-badge">{edition.nbaSeason}</small>}
        </div>

        {/* Game stats */}
        {statsLine && (
          <div className="game-stats mt-1">
            <small className="stats-line">{statsLine}</small>
          </div>
        )}

        {/* Market data */}
        <div className="market-data mt-auto pt-2">
          {lowAskStr && (
            <div className="d-flex justify-content-between">
              <small className="text-muted">Low Ask</small>
              <small className="price-value">{lowAskStr}</small>
            </div>
          )}
          {offerStr && (
            <div className="d-flex justify-content-between">
              <small className="text-muted">Top Offer</small>
              <small className="offer-value">{offerStr}</small>
            </div>
          )}
          {avgPriceStr && (
            <div className="d-flex justify-content-between">
              <small className="text-muted">Avg Sale</small>
              <small className="avg-value">{avgPriceStr}</small>
            </div>
          )}
        </div>

        {/* Tags */}
        {edition.tags?.length > 0 && (
          <div className="mt-1">
            {edition.tags.map((tag, i) => (
              <Badge key={i} bg="secondary" className="tag-badge me-1">{tag}</Badge>
            ))}
          </div>
        )}
      </Card.Body>
    </Card>
  );
}
