import { Container, Row, Col, Card, Table, Badge, Alert } from 'react-bootstrap';
import { Link } from 'react-router-dom';
import './TDWatch.css';

function TDWatch() {
  // Top 3 all-time triple-double leaders
  const tdLeaders = [
    { rank: 1, name: 'Russell Westbrook', count: 207, active: true },
    { rank: 2, name: 'Nikola Jokić', count: 184, active: true, isJokic: true },
    { rank: 3, name: 'Oscar Robertson', count: 181, active: false }
  ];

  // Hardcoded reward pool (manually update when inventory changes)
  const rewardPool = [
    { name: "Collector Series: Grail Chase", amount: 2 },
    { name: "RARE Run It Back Origins August Pack", amount: 1 },
    { name: "Rookie Debut: Chance Hit", amount: 3 },
    { name: "Rookie Debut Standard Pack", amount: 1 },
    { name: "$MVP Swap Boost NFT", amount: 1 },
    { name: "Pet Your Horse 10 Times", amount: 2 },
    { name: "Jolly Joker NFT", amount: 1 },
    { name: "FastBreak 25-26 Classic Run 2 - 4 Win Pack", amount: 1 },
    { name: "NBA Stars: National Exclusive Chase Pack", amount: 3 },
    { name: "Holo Icon: Chance Hit", amount: 1 }
  ];

  // Hardcoded Nuggets schedule (manually update after games)
  // Timestamps are Unix timestamps (seconds since epoch) in UTC
  const allGames = [
    // October 2024
    { timestamp: 1729807200, opponent: 'Warriors', isHome: false, played: true, tripleDouble: true, stats: { points: 21, rebounds: 13, assists: 10 } },
    { timestamp: 1729980000, opponent: 'Suns', isHome: true, played: true, tripleDouble: true, stats: { points: 14, rebounds: 14, assists: 15 } },
    { timestamp: 1730152800, opponent: 'Timberwolves', isHome: false, played: true, tripleDouble: true, stats: { points: 25, rebounds: 19, assists: 10 } },
    { timestamp: 1730325600, opponent: 'Pelicans', isHome: true, played: true, tripleDouble: true, stats: { points: 21, rebounds: 12, assists: 10 } },
    
    // November 2024
    { timestamp: 1730520000, opponent: 'Trail Blazers', isHome: false, played: true, tripleDouble: false, stats: { points: 21, rebounds: 14, assists: 9 } },
    { timestamp: 1730779200, opponent: 'Kings', isHome: true, played: true, tripleDouble: false, stats: { points: 34, rebounds: 7, assists: 14 } },
    { timestamp: 1730952000, opponent: 'Heat', isHome: true, played: true, tripleDouble: true, stats: { points: 33, rebounds: 15, assists: 16 } },
    { timestamp: 1731124800, opponent: 'Warriors', isHome: true, played: true, tripleDouble: false, stats: { points: 26, rebounds: 9, assists: 9 } },
    { timestamp: 1731211200, opponent: 'Pacers', isHome: true, played: true, tripleDouble: true, stats: { points: 32, rebounds: 14, assists: 14 } },
    { timestamp: 1731470400, opponent: 'Kings', isHome: false, played: true, tripleDouble: false, stats: { points: 35, rebounds: 15, assists: 7 } },
    { timestamp: 1731556800, opponent: 'Clippers', isHome: false, played: true, tripleDouble: false, stats: { points: 55, rebounds: 12, assists: 6 } },
    { timestamp: 1731816000, opponent: 'Timberwolves', isHome: false, played: true, tripleDouble: true, stats: { points: 27, rebounds: 12, assists: 11 } },
    { timestamp: 1731988800, opponent: 'Bulls', isHome: true, played: true, tripleDouble: true, stats: { points: 36, rebounds: 18, assists: 13 } },
    { timestamp: 1732161600, opponent: 'Pelicans', isHome: false, played: true, tripleDouble: true, stats: { points: 28, rebounds: 11, assists: 12 } },
    { timestamp: 1732334400, opponent: 'Rockets', isHome: false, played: true, tripleDouble: false, stats: { points: 34, rebounds: 10, assists: 9 } },
    { timestamp: 1732420800, opponent: 'Kings', isHome: true, played: true, tripleDouble: false, stats: { points: 44, rebounds: 13, assists: 7 } },
    { timestamp: 1732593600, opponent: 'Grizzlies', isHome: false, played: true, tripleDouble: true, stats: { points: 17, rebounds: 10, assists: 16 } },
    { timestamp: 1732939200, opponent: 'Spurs', isHome: true, played: true, tripleDouble: false, stats: { points: 21, rebounds: 9, assists: 10 } },
    { timestamp: 1733025600, opponent: 'Suns', isHome: false, played: true, tripleDouble: false, stats: { points: 26, rebounds: 9, assists: 10 } },
    
    // December 2024
    { timestamp: 1733198400, opponent: 'Mavericks', isHome: true, played: true, tripleDouble: true, stats: { points: 29, rebounds: 20, assists: 13 } },
    { timestamp: 1733371200, opponent: 'Pacers', isHome: false, played: true, tripleDouble: false, stats: { points: 24, rebounds: 8, assists: 13 } },
    { timestamp: 1733544000, opponent: 'Hawks', isHome: false, played: true, tripleDouble: false, stats: { points: 40, rebounds: 9, assists: 8 } },
    { timestamp: 1733716800, opponent: 'Hornets', isHome: false, played: true, tripleDouble: false, stats: { points: 28, rebounds: 9, assists: 11 } },
    { timestamp: 1734062400, opponent: 'Kings', isHome: false, played: true, tripleDouble: false, stats: { points: 36, rebounds: 12, assists: 8 } },
    { timestamp: 1734321600, opponent: 'Rockets', isHome: true, played: true, tripleDouble: true, stats: { points: 39, rebounds: 15, assists: 10 } },
    { timestamp: 1734667200, opponent: 'Magic', isHome: true, played: true, tripleDouble: true, stats: { points: 23, rebounds: 11, assists: 13 } },
    { timestamp: 1734753600, opponent: 'Rockets', isHome: true, played: true, tripleDouble: false, stats: { points: 20, rebounds: 6, assists: 7 } },
    { timestamp: 1735012800, opponent: 'Jazz', isHome: true,played: true, tripleDouble: true, stats: { points: 14, rebounds: 13, assists: 13 } },
    { timestamp: 1735099200, opponent: 'Mavericks', isHome: false, played: true, tripleDouble: false, stats: { points: 29, rebounds: 7, assists: 14 } },
    { timestamp: 1735272000, opponent: 'Timberwolves', isHome: true, played: true, tripleDouble: true, stats: { points: 56, rebounds: 16, assists: 15 } },
    { timestamp: 1735444800, opponent: 'Magic', isHome: false, played: true, tripleDouble: true, stats: { points: 34, rebounds: 21, assists: 12 }  },
    { timestamp: 1735617600, opponent: 'Heat', isHome: false, played: true, tripleDouble: false, stats: null },
    
    // January 2025
    { timestamp: 1735790400, opponent: 'Raptors', isHome: false, played: true, tripleDouble: false, stats: null },
    { timestamp: 1735963200, opponent: 'Cavaliers', isHome: false, played: true, tripleDouble: false, stats: null },
    { timestamp: 1736049600, opponent: 'Nets', isHome: false, played: true, tripleDouble: false, stats: null },
    { timestamp: 1736222400, opponent: '76ers', isHome: false, played: true, tripleDouble: false, stats: null },
    { timestamp: 1736395200, opponent: 'Celtics', isHome: false, played: true, tripleDouble: false, stats: null },
    { timestamp: 1736568000, opponent: 'Hawks', isHome: true, played: true, tripleDouble: false, stats: null },
    { timestamp: 1736740800, opponent: 'Bucks', isHome: true, played: true, tripleDouble: false, stats: null },
    { timestamp: 1736913600, opponent: 'Pelicans', isHome: false, played: true, tripleDouble: false, stats: null },
    { timestamp: 1737000000, opponent: 'Mavericks', isHome: false, played: true, tripleDouble: false, stats: null },
    { timestamp: 1737259200, opponent: 'Wizards', isHome: true, played: true, tripleDouble: false, stats: null },
    { timestamp: 1737345600, opponent: 'Hornets', isHome: true, played: true, tripleDouble: false, stats: null },
    { timestamp: 1737518400, opponent: 'Lakers', isHome: true, played: true, tripleDouble: false, stats: null },
    { timestamp: 1737691200, opponent: 'Wizards', isHome: false, played: true, tripleDouble: false, stats: null },
    { timestamp: 1737777600, opponent: 'Bucks', isHome: false, played: true, tripleDouble: false, stats: null },
    { timestamp: 1737864000, opponent: 'Grizzlies', isHome: false, played: false, tripleDouble: false, stats: null },
    { timestamp: 1738123200, opponent: 'Pistons', isHome: true, played: true, tripleDouble: false, stats: null },
    { timestamp: 1738296000, opponent: 'Nets', isHome: true, played: true, tripleDouble: false, stats: null },
    { timestamp: 1738382400, opponent: 'Clippers', isHome: true, played: true, tripleDouble: false, stats: { points: 31, rebounds: 12, assists: 5 } },
    
    // February 2025
    { timestamp: 1738555200, opponent: 'Thunder', isHome: true, played: true, tripleDouble: false, stats: { points: 17, rebounds: 8, assists: 7 } },
    { timestamp: 1738728000, opponent: 'Pistons', isHome: false, played: true, tripleDouble: false, stats: { points: 24, rebounds: 15, assists: 4 } },
    { timestamp: 1738814400, opponent: 'Knicks', isHome: false, played: true, tripleDouble: true, stats: { points: 30, rebounds: 14, assists: 10 } },
    { timestamp: 1739073600, opponent: 'Bulls', isHome: false, played: true, tripleDouble: true, stats: { points: 22, rebounds: 14, assists: 17 } },
    { timestamp: 1739246400, opponent: 'Cavaliers', isHome: true, played: true, tripleDouble: true, stats: { points: 22, rebounds: 14, assists: 11 } },
    { timestamp: 1739419200, opponent: 'Grizzlies', isHome: true, played: true, tripleDouble: true, stats: { points: 26, rebounds: 15, assists: 11 } },
    { timestamp: 1740110400, opponent: 'Clippers', isHome: false, played: true, tripleDouble: false, stats: { points: 22, rebounds: 17, assists: 6 } },
    { timestamp: 1740196800, opponent: 'Trail Blazers', isHome: false, played: true, tripleDouble: false, stats: { points: 32, rebounds: 9, assists: 7 } },
    { timestamp: 1740283200, opponent: 'Warriors', isHome: false, played: false, tripleDouble: false, stats: null },
    { timestamp: 1740628800, opponent: 'Celtics', isHome: true, played: false, tripleDouble: false, stats: null },
    { timestamp: 1740801600, opponent: 'Thunder', isHome: false, played: false, tripleDouble: false, stats: null },
    
    // March 2025
    { timestamp: 1740888000, opponent: 'Timberwolves', isHome: true, played: false, tripleDouble: false, stats: null },
    { timestamp: 1741060800, opponent: 'Jazz', isHome: false, played: false, tripleDouble: false, stats: null },
    { timestamp: 1741320000, opponent: 'Lakers', isHome: true, played: false, tripleDouble: false, stats: null },
    { timestamp: 1741406400, opponent: 'Knicks', isHome: true, played: false, tripleDouble: false, stats: null },
    { timestamp: 1741665600, opponent: 'Thunder', isHome: false, played: false, tripleDouble: false, stats: null },
    { timestamp: 1741838400, opponent: 'Rockets', isHome: true, played: false, tripleDouble: false, stats: null },
    { timestamp: 1741924800, opponent: 'Spurs', isHome: false, played: false, tripleDouble: false, stats: null },
    { timestamp: 1742184000, opponent: 'Lakers', isHome: false, played: false, tripleDouble: false, stats: null },
    { timestamp: 1742443200, opponent: '76ers', isHome: true, played: false, tripleDouble: false, stats: null },
    { timestamp: 1742702400, opponent: 'Raptors', isHome: true, played: false, tripleDouble: false, stats: null },
    { timestamp: 1742788800, opponent: 'Trail Blazers', isHome: true, played: false, tripleDouble: false, stats: null },
    { timestamp: 1743048000, opponent: 'Suns', isHome: false, played: false, tripleDouble: false, stats: null },
    { timestamp: 1743134400, opponent: 'Mavericks', isHome: true, played: false, tripleDouble: false, stats: null },
    { timestamp: 1743307200, opponent: 'Jazz', isHome: true, played: false, tripleDouble: false, stats: null },
    { timestamp: 1743480000, opponent: 'Warriors', isHome: true, played: false, tripleDouble: false, stats: null },
    
    // April 2025
    { timestamp: 1743739200, opponent: 'Jazz', isHome: false, played: false, tripleDouble: false, stats: null },
    { timestamp: 1743912000, opponent: 'Spurs', isHome: true, played: false, tripleDouble: false, stats: null },
    { timestamp: 1744171200, opponent: 'Trail Blazers', isHome: true, played: false, tripleDouble: false, stats: null },
    { timestamp: 1744344000, opponent: 'Grizzlies', isHome: true, played: false, tripleDouble: false, stats: null },
    { timestamp: 1744516800, opponent: 'Thunder', isHome: true, played: false, tripleDouble: false, stats: null },
    { timestamp: 1744689600, opponent: 'Spurs', isHome: false, played: false, tripleDouble: false, stats: null }
  ];

  // Group games by month
  const gamesByMonth = allGames.reduce((acc, game) => {
    const date = new Date(game.timestamp * 1000);
    const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    const monthName = date.toLocaleDateString('en-US', { year: 'numeric', month: 'long' });
    
    if (!acc[monthKey]) {
      acc[monthKey] = {
        name: monthName,
        games: []
      };
    }
    acc[monthKey].games.push(game);
    return acc;
  }, {});

  // Get current month key for default open accordion
  const currentDate = new Date();
  const currentMonthKey = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}`;

  const formatGameDate = (timestamp) => {
    const date = new Date(timestamp * 1000);
    return date.toLocaleDateString('en-US', { 
      weekday: 'short', 
      month: 'short', 
      day: 'numeric',
      timeZone: 'America/Denver'
    });
  };

  // Calculate team triple-double tracker
  const teamTDTracker = allGames.reduce((acc, game) => {
    const team = game.opponent;
    if (!acc[team]) {
      acc[team] = {
        name: team,
        tripleDoubles: 0,
        totalGames: 0,
        remainingGames: 0,
        playedGames: 0,
        nextGameTimestamp: null
      };
    }
    
    acc[team].totalGames++;
    if (game.played) {
      acc[team].playedGames++;
      if (game.tripleDouble) {
        acc[team].tripleDoubles++;
      }
    } else {
      acc[team].remainingGames++;
      if (!acc[team].nextGameTimestamp || game.timestamp < acc[team].nextGameTimestamp) {
        acc[team].nextGameTimestamp = game.timestamp;
      }
    }
    
    return acc;
  }, {});

  // Convert to sorted array
  const teamTDArray = Object.values(teamTDTracker).sort((a, b) => {
    // Sort by triple-doubles (descending), then remaining games (ascending), then next game date (ascending)
    if (b.tripleDoubles !== a.tripleDoubles) {
      return b.tripleDoubles - a.tripleDoubles;
    }
    
    if (a.remainingGames !== b.remainingGames) {
      return a.remainingGames - b.remainingGames;
    }
    
    // Sort by next game date (earlier dates first)
    if (a.nextGameTimestamp && b.nextGameTimestamp) {
      return a.nextGameTimestamp - b.nextGameTimestamp;
    }
    if (a.nextGameTimestamp) return -1;
    if (b.nextGameTimestamp) return 1;
    
    return a.name.localeCompare(b.name);
  });

  const formatNextGameDate = (timestamp) => {
    if (!timestamp) return '';
    const date = new Date(timestamp * 1000);
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric',
      timeZone: 'America/Denver'
    });
  };

  return (
    <Container className="td-watch-container py-4">
      {/* Hero Section */}
      <div className="td-hero text-center mb-3">
        <h1 className="display-4 fw-bold mb-2">
          🏀 Triple-Double Watch 🏀
        </h1>
        <p className="lead mb-3">
          Following Nikola Jokić's Historic Chase to #1 All-Time
        </p>
        <div className="raffle-info-hero mt-3 pt-3 border-top border-light">
          <h6 className="mb-2">🎁 Triple-Double Raffle</h6>
          <p className="mb-2 small">
            After every Jokić triple-double, we raffle <strong>TWO prizes</strong>:
          </p>
          <div className="d-flex justify-content-center gap-3 flex-wrap small">
            <div><strong>Prize #1:</strong> <Link to="/swapfest" className="text-decoration-none" style={{color: '#FDB927'}}>Swapfest leaderboard</Link> (weighted)</div>
            <div><strong>Prize #2:</strong> Random <Link to="/fastbreak" className="text-decoration-none" style={{color: '#FDB927'}}>FastBreak</Link> entry</div>
          </div>
        </div>
      </div>

      {/* Reward Pool */}
      <Row className="mb-4">
        <Col lg={10} className="mx-auto">
          <Card className="shadow border-0">
            <Card.Header className="py-2" style={{backgroundColor: '#418FDE'}}>
              <h6 className="mb-0 text-white">Available Rewards</h6>
            </Card.Header>
            <Card.Body className="p-0">
              <Table striped hover size="sm" className="mb-0 td-leaders-table">
                <thead>
                  <tr>
                    <th className="ps-3">Reward Name</th>
                    <th className="text-center">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {rewardPool.map((reward, idx) => (
                    <tr key={idx}>
                      <td className="small ps-3">{reward.name}</td>
                      <td className="text-center fw-semibold">{reward.amount}</td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </Card.Body>
          </Card>
        </Col>
      </Row>

      {/* All-Time Leaders Section */}
      <Row className="mb-4">
        <Col lg={6} className="mx-auto">
          <Card className="shadow border-0">
            <Card.Header className="py-2" style={{backgroundColor: '#418FDE'}}>
              <h6 className="mb-0 text-white">All-Time Triple-Double Leaders</h6>
            </Card.Header>
            <Card.Body className="p-0">
              <Table striped hover size="sm" className="mb-0 td-leaders-table">
                <thead>
                  <tr>
                    <th className="text-center" style={{width: '60px'}}>Rank</th>
                    <th>Player</th>
                    <th className="text-center" style={{width: '80px'}}>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {tdLeaders.map((leader) => (
                    <tr key={leader.rank} className={leader.isJokic ? 'jokic-highlight' : ''}>
                      <td className="text-center">#{leader.rank}</td>
                      <td>
                        {leader.name}
                      </td>
                      <td className="text-center fw-bold">{leader.count}</td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </Card.Body>
          </Card>
        </Col>
      </Row>

      {/* Schedule Calendar */}
      <Row className="mb-4">
        <Col lg={10} className="mx-auto">
          <Card className="shadow border-0">
            <Card.Header className="py-2" style={{backgroundColor: '#0E2240'}}>
              <h5 className="mb-0 text-white">Nuggets Schedule & TD Tracker</h5>
            </Card.Header>
            <Card.Body className="p-0">
              <Table responsive hover className="mb-0 td-schedule-table">
                <thead>
                  <tr>
                    <th>Date (MT)</th>
                    <th>Opponent</th>
                    <th className="text-center">Triple-Double?</th>
                    <th className="text-center">Stats</th>
                  </tr>
                </thead>
                <tbody>
                  {allGames.map((game, idx) => (
                    <tr key={idx} className={game.tripleDouble ? 'table-success' : ''}>
                      <td className="small fw-semibold">
                        {formatGameDate(game.timestamp)}
                      </td>
                      <td className="small">
                        {game.isHome ? 'vs' : '@'} {game.opponent}
                      </td>
                      <td className="text-center">
                        {game.played ? (
                          game.tripleDouble ? (
                            <Badge bg="success" pill>✓ TD</Badge>
                          ) : (
                            <Badge bg="secondary" pill>-</Badge>
                          )
                        ) : (
                          <Badge bg="light" text="dark" pill>-</Badge>
                        )}
                      </td>
                      <td className="text-center small text-muted">
                        {game.stats ? (
                          <>{game.stats.points}p / {game.stats.rebounds}r / {game.stats.assists}a</>
                        ) : (
                          '-'
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </Card.Body>
          </Card>
        </Col>
      </Row>

      {/* Team Triple-Double Tracker */}
      <Row className="mb-4">
        <Col lg={10} className="mx-auto">
          <Card className="shadow border-0">
            <Card.Header className="py-2" style={{backgroundColor: '#418FDE'}}>
              <h6 className="mb-0 text-white">Triple-Doubles by Opponent (2025-26 Season)</h6>
            </Card.Header>
            <Card.Body className="p-0">
              <Table striped hover size="sm" className="mb-0 td-leaders-table">
                <thead>
                  <tr>
                    <th className="ps-3">Team</th>
                    <th className="text-center">Triple-Doubles</th>
                    <th className="text-center">Games Remaining</th>
                    <th className="text-center">Next Game</th>
                  </tr>
                </thead>
                <tbody>
                  {teamTDArray.map((team, idx) => (
                    <tr key={idx}>
                      <td className="small ps-3">{team.name}</td>
                      <td className="text-center">
                        {team.tripleDoubles > 0 ? (
                          <Badge bg="success" pill>{team.tripleDoubles}</Badge>
                        ) : (
                          <span className="text-muted">-</span>
                        )}
                      </td>
                      <td className="text-center small">
                        {team.remainingGames > 0 ? team.remainingGames : <span className="text-muted">-</span>}
                      </td>
                      <td className="text-center small text-muted">
                        {team.nextGameTimestamp ? formatNextGameDate(team.nextGameTimestamp) : <span className="text-muted">-</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </Table>
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
