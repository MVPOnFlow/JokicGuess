import { useState, useEffect } from 'react';
import { Container, Row, Col, Card, Table, Badge, Spinner, Alert } from 'react-bootstrap';
import './TDWatch.css';

function TDWatch() {
  const [loading, setLoading] = useState(true);
  const [schedule, setSchedule] = useState([]);
  const [packPool, setPackPool] = useState([]);
  const [error, setError] = useState(null);

  // Top 3 all-time triple-double leaders
  const tdLeaders = [
    { rank: 1, name: 'Russell Westbrook', count: 205, active: true },
    { rank: 2, name: 'Oscar Robertson', count: 181, active: false },
    { rank: 3, name: 'Nikola Jokić', count: 173, active: true, isJokic: true }
  ];

  const jokicProgress = {
    current: 173,
    toSecond: 181 - 173, // 8 more to pass Oscar
    toFirst: 205 - 173   // 32 more to pass Westbrook
  };

  useEffect(() => {
    fetchSchedule();
    fetchPackPool();
  }, []);

  const fetchSchedule = async () => {
    try {
      const response = await fetch('/api/td-watch/schedule');
      if (response.ok) {
        const data = await response.json();
        setSchedule(data);
      }
    } catch (err) {
      console.error('Error fetching schedule:', err);
      setError('Failed to load schedule data');
    } finally {
      setLoading(false);
    }
  };

  const fetchPackPool = async () => {
    try {
      const response = await fetch('/api/td-watch/pack-pool');
      if (response.ok) {
        const data = await response.json();
        setPackPool(data);
      }
    } catch (err) {
      console.error('Error fetching pack pool:', err);
    }
  };

  const progressPercentToSecond = (jokicProgress.current / 181) * 100;
  const progressPercentToFirst = (jokicProgress.current / 205) * 100;

  return (
    <Container className="td-watch-container py-5">
      {/* Hero Section */}
      <div className="td-hero text-center mb-5">
        <h1 className="display-3 fw-bold text-primary mb-3">
          🏀 Triple-Double Watch 🏀
        </h1>
        <p className="lead text-muted mb-4">
          Following Nikola Jokić's Historic Chase to #1 All-Time
        </p>
      </div>

      {/* All-Time Leaders Section */}
      <Row className="mb-5">
        <Col lg={8} className="mx-auto">
          <Card className="shadow-lg border-0">
            <Card.Header className="bg-primary text-white">
              <h3 className="mb-0">All-Time NBA Triple-Double Leaders</h3>
            </Card.Header>
            <Card.Body className="p-4">
              {tdLeaders.map((leader) => (
                <div
                  key={leader.rank}
                  className={`leader-row ${leader.isJokic ? 'jokic-row' : ''} mb-4 p-3 rounded`}
                >
                  <Row className="align-items-center">
                    <Col xs={2} className="text-center">
                      <div className={`rank-badge rank-${leader.rank}`}>
                        #{leader.rank}
                      </div>
                    </Col>
                    <Col xs={6}>
                      <h4 className="mb-0">
                        {leader.name}
                        {!leader.active && <span className="text-muted small"> *</span>}
                        {leader.isJokic && <span className="ms-2">🃏</span>}
                      </h4>
                    </Col>
                    <Col xs={4} className="text-end">
                      <h2 className="mb-0 fw-bold text-primary">{leader.count}</h2>
                    </Col>
                  </Row>
                </div>
              ))}
              <p className="text-muted small mb-0 mt-3">* Hall of Famer</p>
            </Card.Body>
          </Card>
        </Col>
      </Row>

      {/* Progress Tracker */}
      <Row className="mb-5">
        <Col lg={8} className="mx-auto">
          <Card className="shadow border-0">
            <Card.Header className="bg-success text-white">
              <h4 className="mb-0">Jokić's Path to #1</h4>
            </Card.Header>
            <Card.Body className="p-4">
              <div className="mb-4">
                <div className="d-flex justify-content-between mb-2">
                  <span className="fw-bold">To Pass Oscar Robertson (#2)</span>
                  <span className="badge bg-warning text-dark">{jokicProgress.toSecond} TDs needed</span>
                </div>
                <div className="progress" style={{ height: '30px' }}>
                  <div
                    className="progress-bar bg-success"
                    role="progressbar"
                    style={{ width: `${progressPercentToSecond}%` }}
                    aria-valuenow={progressPercentToSecond}
                    aria-valuemin="0"
                    aria-valuemax="100"
                  >
                    {jokicProgress.current} / 181
                  </div>
                </div>
              </div>

              <div>
                <div className="d-flex justify-content-between mb-2">
                  <span className="fw-bold">To Pass Russell Westbrook (#1)</span>
                  <span className="badge bg-danger">{jokicProgress.toFirst} TDs needed</span>
                </div>
                <div className="progress" style={{ height: '30px' }}>
                  <div
                    className="progress-bar bg-success"
                    role="progressbar"
                    style={{ width: `${progressPercentToFirst}%` }}
                    aria-valuenow={progressPercentToFirst}
                    aria-valuemin="0"
                    aria-valuemax="100"
                  >
                    {jokicProgress.current} / 205
                  </div>
                </div>
              </div>
            </Card.Body>
          </Card>
        </Col>
      </Row>

      {/* Raffle Info */}
      <Row className="mb-5">
        <Col lg={8} className="mx-auto">
          <Alert variant="info" className="shadow-sm">
            <Alert.Heading>🎁 Triple-Double Raffle!</Alert.Heading>
            <p className="mb-0">
              After every Nuggets game where Jokić records a triple-double, we raffle <strong>TWO packs</strong>:
            </p>
            <ul className="mb-0 mt-2">
              <li><strong>Pack #1:</strong> Awarded to Swapfest leaderboard (weighted by points)</li>
              <li><strong>Pack #2:</strong> Random FastBreak prediction entry from that day</li>
            </ul>
          </Alert>
        </Col>
      </Row>

      {/* Schedule Calendar */}
      <Row className="mb-5">
        <Col lg={10} className="mx-auto">
          <Card className="shadow border-0">
            <Card.Header className="bg-dark text-white">
              <h4 className="mb-0">Nuggets Schedule & TD Tracker</h4>
            </Card.Header>
            <Card.Body className="p-0">
              {loading ? (
                <div className="text-center p-5">
                  <Spinner animation="border" variant="primary" />
                  <p className="mt-3">Loading schedule...</p>
                </div>
              ) : error ? (
                <Alert variant="warning" className="m-3">{error}</Alert>
              ) : schedule.length === 0 ? (
                <Alert variant="info" className="m-3">No upcoming games scheduled</Alert>
              ) : (
                <Table responsive hover className="mb-0">
                  <thead className="table-light">
                    <tr>
                      <th>Date</th>
                      <th>Opponent</th>
                      <th>Location</th>
                      <th className="text-center">Triple-Double?</th>
                      <th className="text-center">Stats</th>
                    </tr>
                  </thead>
                  <tbody>
                    {schedule.map((game, idx) => (
                      <tr key={idx} className={game.tripleDouble ? 'table-success' : ''}>
                        <td className="fw-bold">{new Date(game.date).toLocaleDateString()}</td>
                        <td>
                          {game.opponent}
                          {game.isHome && <span className="ms-2 badge bg-secondary">HOME</span>}
                        </td>
                        <td>{game.location || '-'}</td>
                        <td className="text-center">
                          {game.played ? (
                            game.tripleDouble ? (
                              <Badge bg="success" className="fs-6">✓ YES</Badge>
                            ) : (
                              <Badge bg="secondary">✗ No</Badge>
                            )
                          ) : (
                            <Badge bg="light" text="dark">TBD</Badge>
                          )}
                        </td>
                        <td className="text-center">
                          {game.stats ? (
                            <small className="text-muted">
                              {game.stats.points}p / {game.stats.rebounds}r / {game.stats.assists}a
                            </small>
                          ) : '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              )}
            </Card.Body>
          </Card>
        </Col>
      </Row>

      {/* Pack Pool */}
      <Row className="mb-5">
        <Col lg={10} className="mx-auto">
          <Card className="shadow border-0">
            <Card.Header className="bg-warning">
              <h4 className="mb-0 text-dark">🎁 Available Prize Packs</h4>
            </Card.Header>
            <Card.Body className="p-4">
              <p className="text-muted mb-4">
                When Jokić records a triple-double, we spin the wheel to randomly select which packs to award!
              </p>
              {packPool.length === 0 ? (
                <Alert variant="info">Pack pool will be updated soon!</Alert>
              ) : (
                <Row>
                  {packPool.map((pack, idx) => (
                    <Col md={6} lg={4} key={idx} className="mb-3">
                      <Card className="h-100 pack-card border-primary">
                        <Card.Body>
                          <h5 className="card-title text-primary">{pack.name}</h5>
                          <p className="card-text small text-muted">{pack.description}</p>
                          <div className="d-flex justify-content-between align-items-center mt-3">
                            <Badge bg="info">{pack.series}</Badge>
                            <span className="text-muted small">Qty: {pack.quantity}</span>
                          </div>
                        </Card.Body>
                      </Card>
                    </Col>
                  ))}
                </Row>
              )}
            </Card.Body>
          </Card>
        </Col>
      </Row>

      {/* Footer Note */}
      <Row>
        <Col className="text-center text-muted">
          <p className="small">
            Data updates after each Nuggets game. Stay tuned for the next triple-double! 🃏
          </p>
        </Col>
      </Row>
    </Container>
  );
}

export default TDWatch;
