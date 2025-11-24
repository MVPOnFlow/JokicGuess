import { Container, Row, Col, Card, Table, Badge, Alert } from 'react-bootstrap';
import './TDWatch.css';

function TDWatch() {
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

  // Hardcoded prize packs (manually update when inventory changes)
  const packPool = [
    {
      name: "Fast Break - 25-26' Classic Run 2 - 4 Wins Pack",
      rarity: "Common",
      sealed: 1,
      opened: 0
    },
    {
      name: "Rookie Debut: Chance Hit",
      rarity: "Common",
      sealed: 4,
      opened: 0
    },
    {
      name: "Top Shot Debut Chance Hit Pack",
      rarity: "Common",
      sealed: 1,
      opened: 2
    }
  ];

  // Hardcoded Nuggets schedule (manually update after games)
  const schedule = [
    // Completed games with triple-doubles
    { date: '2024-10-28', opponent: 'Timberwolves', isHome: false, location: 'Target Center', played: true, tripleDouble: true, stats: { points: 27, rebounds: 19, assists: 10 } },
    { date: '2024-10-30', opponent: 'Pelicans', isHome: true, location: 'Ball Arena', played: true, tripleDouble: true, stats: { points: 21, rebounds: 12, assists: 10 } },
    { date: '2024-11-06', opponent: 'Heat', isHome: true, location: 'Ball Arena', played: true, tripleDouble: true, stats: { points: 33, rebounds: 15, assists: 16 } },
    { date: '2024-11-09', opponent: 'Pacers', isHome: true, location: 'Ball Arena', played: true, tripleDouble: true, stats: { points: 32, rebounds: 14, assists: 14 } },
    { date: '2024-11-18', opponent: 'Bulls', isHome: true, location: 'Ball Arena', played: true, tripleDouble: true, stats: { points: 36, rebounds: 18, assists: 13 } },
    // Other completed games
    { date: '2024-10-24', opponent: 'Warriors', isHome: false, location: 'Chase Center', played: true, tripleDouble: false, stats: { points: null, rebounds: 13, assists: null } },
    { date: '2024-10-26', opponent: 'Suns', isHome: true, location: 'Ball Arena', played: true, tripleDouble: false, stats: { points: null, rebounds: 14, assists: 15 } },
    { date: '2024-11-01', opponent: 'Trail Blazers', isHome: false, location: 'Moda Center', played: true, tripleDouble: false, stats: { points: null, rebounds: 14, assists: 9 } },
    { date: '2024-11-04', opponent: 'Kings', isHome: true, location: 'Ball Arena', played: true, tripleDouble: false, stats: { points: 34, rebounds: 7, assists: 14 } },
    { date: '2024-11-08', opponent: 'Warriors', isHome: true, location: 'Ball Arena', played: true, tripleDouble: false, stats: { points: 26, rebounds: 9, assists: 9 } },
    { date: '2024-11-12', opponent: 'Kings', isHome: false, location: 'Golden 1 Center', played: true, tripleDouble: false, stats: { points: 35, rebounds: 15, assists: null } },
    { date: '2024-11-13', opponent: 'Clippers', isHome: false, location: 'Intuit Dome', played: true, tripleDouble: false, stats: { points: 55, rebounds: 12, assists: 6 } },
    { date: '2024-11-16', opponent: 'Timberwolves', isHome: false, location: 'Target Center', played: true, tripleDouble: false, stats: { points: 27, rebounds: 12, assists: null } },
    { date: '2024-11-20', opponent: 'Pelicans', isHome: false, location: 'Smoothie King Center', played: true, tripleDouble: false, stats: { points: null, rebounds: null, assists: 12 } },
    { date: '2024-11-22', opponent: 'Rockets', isHome: false, location: 'Toyota Center', played: true, tripleDouble: false, stats: { points: 34, rebounds: 10, assists: null } },
    { date: '2024-11-23', opponent: 'Kings', isHome: true, location: 'Ball Arena', played: true, tripleDouble: false, stats: { points: 44, rebounds: 13, assists: null } },
    // Upcoming games
    { date: '2024-11-25', opponent: 'Grizzlies', isHome: false, location: 'FedExForum', played: false, tripleDouble: false, stats: null },
    { date: '2024-11-29', opponent: 'Spurs', isHome: true, location: 'Ball Arena', played: false, tripleDouble: false, stats: null },
    { date: '2024-11-30', opponent: 'Suns', isHome: false, location: 'Footprint Center', played: false, tripleDouble: false, stats: null },
    { date: '2024-12-02', opponent: 'Mavericks', isHome: true, location: 'Ball Arena', played: false, tripleDouble: false, stats: null },
    { date: '2024-12-04', opponent: 'Pacers', isHome: false, location: 'Gainbridge Fieldhouse', played: false, tripleDouble: false, stats: null },
    { date: '2024-12-06', opponent: 'Hawks', isHome: false, location: 'State Farm Arena', played: false, tripleDouble: false, stats: null },
    { date: '2024-12-08', opponent: 'Hornets', isHome: false, location: 'Spectrum Center', played: false, tripleDouble: false, stats: null },
    { date: '2024-12-10', opponent: 'Wizards', isHome: true, location: 'Ball Arena', played: false, tripleDouble: false, stats: null },
    { date: '2024-12-12', opponent: 'Suns', isHome: true, location: 'Ball Arena', played: false, tripleDouble: false, stats: null },
    { date: '2024-12-14', opponent: 'Warriors', isHome: false, location: 'Chase Center', played: false, tripleDouble: false, stats: null },
    { date: '2024-12-16', opponent: 'Clippers', isHome: true, location: 'Ball Arena', played: false, tripleDouble: false, stats: null },
    { date: '2024-12-19', opponent: 'Magic', isHome: true, location: 'Ball Arena', played: false, tripleDouble: false, stats: null },
    { date: '2024-12-20', opponent: 'Rockets', isHome: true, location: 'Ball Arena', played: false, tripleDouble: false, stats: null },
    { date: '2024-12-23', opponent: 'Jazz', isHome: true, location: 'Ball Arena', played: false, tripleDouble: false, stats: null },
    { date: '2024-12-24', opponent: 'Mavericks', isHome: false, location: 'American Airlines Center', played: false, tripleDouble: false, stats: null },
    { date: '2024-12-26', opponent: 'Timberwolves', isHome: true, location: 'Ball Arena', played: false, tripleDouble: false, stats: null },
    { date: '2024-12-28', opponent: 'Magic', isHome: false, location: 'Kia Center', played: false, tripleDouble: false, stats: null },
    { date: '2024-12-30', opponent: 'Heat', isHome: false, location: 'Kaseya Center', played: false, tripleDouble: false, stats: null },
    { date: '2025-01-01', opponent: 'Raptors', isHome: false, location: 'Scotiabank Arena', played: false, tripleDouble: false, stats: null },
    { date: '2025-01-03', opponent: 'Cavaliers', isHome: false, location: 'Rocket Mortgage FieldHouse', played: false, tripleDouble: false, stats: null },
    { date: '2025-01-04', opponent: 'Nets', isHome: false, location: 'Barclays Center', played: false, tripleDouble: false, stats: null },
    { date: '2025-01-06', opponent: '76ers', isHome: false, location: 'Wells Fargo Center', played: false, tripleDouble: false, stats: null },
    { date: '2025-01-08', opponent: 'Celtics', isHome: false, location: 'TD Garden', played: false, tripleDouble: false, stats: null },
    { date: '2025-01-10', opponent: 'Hawks', isHome: true, location: 'Ball Arena', played: false, tripleDouble: false, stats: null },
    { date: '2025-01-12', opponent: 'Bucks', isHome: true, location: 'Ball Arena', played: false, tripleDouble: false, stats: null },
    { date: '2025-01-14', opponent: 'Pelicans', isHome: false, location: 'Smoothie King Center', played: false, tripleDouble: false, stats: null },
    { date: '2025-01-15', opponent: 'Mavericks', isHome: false, location: 'American Airlines Center', played: false, tripleDouble: false, stats: null },
    { date: '2025-01-18', opponent: 'Wizards', isHome: true, location: 'Ball Arena', played: false, tripleDouble: false, stats: null },
    { date: '2025-01-19', opponent: 'Hornets', isHome: true, location: 'Ball Arena', played: false, tripleDouble: false, stats: null },
    { date: '2025-01-21', opponent: 'Lakers', isHome: true, location: 'Ball Arena', played: false, tripleDouble: false, stats: null },
    { date: '2025-01-23', opponent: 'Wizards', isHome: false, location: 'Capital One Arena', played: false, tripleDouble: false, stats: null },
    { date: '2025-01-24', opponent: 'Bucks', isHome: false, location: 'Fiserv Forum', played: false, tripleDouble: false, stats: null },
    { date: '2025-01-25', opponent: 'Grizzlies', isHome: false, location: 'FedExForum', played: false, tripleDouble: false, stats: null },
    { date: '2025-01-28', opponent: 'Pistons', isHome: true, location: 'Ball Arena', played: false, tripleDouble: false, stats: null },
    { date: '2025-01-30', opponent: 'Nets', isHome: true, location: 'Ball Arena', played: false, tripleDouble: false, stats: null },
    { date: '2025-01-31', opponent: 'Clippers', isHome: true, location: 'Ball Arena', played: false, tripleDouble: false, stats: null },
    { date: '2025-02-02', opponent: 'Thunder', isHome: true, location: 'Ball Arena', played: false, tripleDouble: false, stats: null },
    { date: '2025-02-04', opponent: 'Pistons', isHome: false, location: 'Little Caesars Arena', played: false, tripleDouble: false, stats: null },
    { date: '2025-02-05', opponent: 'Knicks', isHome: false, location: 'Madison Square Garden', played: false, tripleDouble: false, stats: null },
    { date: '2025-02-08', opponent: 'Bulls', isHome: false, location: 'United Center', played: false, tripleDouble: false, stats: null },
    { date: '2025-02-10', opponent: 'Cavaliers', isHome: true, location: 'Ball Arena', played: false, tripleDouble: false, stats: null },
    { date: '2025-02-12', opponent: 'Grizzlies', isHome: true, location: 'Ball Arena', played: false, tripleDouble: false, stats: null },
    { date: '2025-02-20', opponent: 'Clippers', isHome: false, location: 'Intuit Dome', played: false, tripleDouble: false, stats: null },
    { date: '2025-02-21', opponent: 'Trail Blazers', isHome: false, location: 'Moda Center', played: false, tripleDouble: false, stats: null },
    { date: '2025-02-22', opponent: 'Warriors', isHome: false, location: 'Chase Center', played: false, tripleDouble: false, stats: null },
    { date: '2025-02-26', opponent: 'Celtics', isHome: true, location: 'Ball Arena', played: false, tripleDouble: false, stats: null },
    { date: '2025-02-28', opponent: 'Thunder', isHome: false, location: 'Paycom Center', played: false, tripleDouble: false, stats: null },
    { date: '2025-03-01', opponent: 'Timberwolves', isHome: true, location: 'Ball Arena', played: false, tripleDouble: false, stats: null },
    { date: '2025-03-03', opponent: 'Jazz', isHome: false, location: 'Delta Center', played: false, tripleDouble: false, stats: null },
    { date: '2025-03-06', opponent: 'Lakers', isHome: true, location: 'Ball Arena', played: false, tripleDouble: false, stats: null },
    { date: '2025-03-07', opponent: 'Knicks', isHome: true, location: 'Ball Arena', played: false, tripleDouble: false, stats: null },
    { date: '2025-03-10', opponent: 'Thunder', isHome: false, location: 'Paycom Center', played: false, tripleDouble: false, stats: null },
    { date: '2025-03-12', opponent: 'Rockets', isHome: true, location: 'Ball Arena', played: false, tripleDouble: false, stats: null },
    { date: '2025-03-13', opponent: 'Spurs', isHome: false, location: 'Frost Bank Center', played: false, tripleDouble: false, stats: null },
    { date: '2025-03-15', opponent: 'Lakers', isHome: false, location: 'Crypto.com Arena', played: false, tripleDouble: false, stats: null },
    { date: '2025-03-18', opponent: '76ers', isHome: true, location: 'Ball Arena', played: false, tripleDouble: false, stats: null },
    { date: '2025-03-21', opponent: 'Raptors', isHome: true, location: 'Ball Arena', played: false, tripleDouble: false, stats: null },
    { date: '2025-03-22', opponent: 'Trail Blazers', isHome: true, location: 'Ball Arena', played: false, tripleDouble: false, stats: null },
    { date: '2025-03-25', opponent: 'Suns', isHome: false, location: 'Footprint Center', played: false, tripleDouble: false, stats: null },
    { date: '2025-03-26', opponent: 'Mavericks', isHome: true, location: 'Ball Arena', played: false, tripleDouble: false, stats: null },
    { date: '2025-03-28', opponent: 'Jazz', isHome: true, location: 'Ball Arena', played: false, tripleDouble: false, stats: null },
    { date: '2025-03-30', opponent: 'Warriors', isHome: true, location: 'Ball Arena', played: false, tripleDouble: false, stats: null },
    { date: '2025-04-02', opponent: 'Jazz', isHome: false, location: 'Delta Center', played: false, tripleDouble: false, stats: null },
    { date: '2025-04-04', opponent: 'Spurs', isHome: true, location: 'Ball Arena', played: false, tripleDouble: false, stats: null },
    { date: '2025-04-07', opponent: 'Trail Blazers', isHome: true, location: 'Ball Arena', played: false, tripleDouble: false, stats: null },
    { date: '2025-04-09', opponent: 'Grizzlies', isHome: true, location: 'Ball Arena', played: false, tripleDouble: false, stats: null },
    { date: '2025-04-11', opponent: 'Thunder', isHome: true, location: 'Ball Arena', played: false, tripleDouble: false, stats: null },
    { date: '2025-04-13', opponent: 'Spurs', isHome: false, location: 'Frost Bank Center', played: false, tripleDouble: false, stats: null }
  ];

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
              {schedule.length === 0 ? (
                <Alert variant="info" className="m-3">No games scheduled</Alert>
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
              <Row>
                {packPool.map((pack, idx) => (
                  <Col md={6} lg={4} key={idx} className="mb-3">
                    <Card className="h-100 pack-card">
                      <Card.Body>
                        <div className="d-flex justify-content-between align-items-start mb-2">
                          <h5 className="card-title mb-0">{pack.name}</h5>
                          <Badge bg="secondary" className="ms-2">{pack.rarity}</Badge>
                        </div>
                        <div className="mt-3">
                          {pack.sealed > 0 && (
                            <div className="mb-1">
                              <Badge bg="success" className="me-2">Sealed</Badge>
                              <span className="text-light">{pack.sealed} {pack.sealed === 1 ? 'pack' : 'packs'}</span>
                            </div>
                          )}
                          {pack.opened > 0 && (
                            <div>
                              <Badge bg="info" className="me-2">Opened</Badge>
                              <span className="text-light">{pack.opened} {pack.opened === 1 ? 'pack' : 'packs'}</span>
                            </div>
                          )}
                        </div>
                      </Card.Body>
                    </Card>
                  </Col>
                ))}
              </Row>
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
