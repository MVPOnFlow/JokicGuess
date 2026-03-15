import { useState } from 'react';
import { Container, Row, Col, Card, Table, Badge, Alert } from 'react-bootstrap';
import { Link } from 'react-router-dom';
import './TDWatch.css';

function TDWatch() {
  // Top 3 all-time triple-double leaders
  const tdLeaders = [
    { rank: 1, name: 'Russell Westbrook', count: 209, active: true },
    { rank: 2, name: 'Nikola Jokić', count: 191, active: true, isJokic: true },
    { rank: 3, name: 'Oscar Robertson', count: 181, active: false }
  ];

  // Hardcoded Nuggets schedule (manually update after games)
  // Timestamps are Unix timestamps (seconds since epoch) in UTC
  const allGames = [
    // October 2025
    { timestamp: 1761343200, opponent: 'Warriors', isHome: false, played: true, tripleDouble: true, stats: { points: 21, rebounds: 13, assists: 10 } },
    { timestamp: 1761516000, opponent: 'Suns', isHome: true, played: true, tripleDouble: true, stats: { points: 14, rebounds: 14, assists: 15 } },
    { timestamp: 1761688800, opponent: 'Timberwolves', isHome: false, played: true, tripleDouble: true, stats: { points: 25, rebounds: 19, assists: 10 } },
    { timestamp: 1761861600, opponent: 'Pelicans', isHome: true, played: true, tripleDouble: true, stats: { points: 21, rebounds: 12, assists: 10 } },
    
    // November 2025
    { timestamp: 1762056000, opponent: 'Trail Blazers', isHome: false, played: true, tripleDouble: false, stats: { points: 21, rebounds: 14, assists: 9 } },
    { timestamp: 1762315200, opponent: 'Kings', isHome: true, played: true, tripleDouble: false, stats: { points: 34, rebounds: 7, assists: 14 } },
    { timestamp: 1762488000, opponent: 'Heat', isHome: true, played: true, tripleDouble: true, stats: { points: 33, rebounds: 15, assists: 16 } },
    { timestamp: 1762660800, opponent: 'Warriors', isHome: true, played: true, tripleDouble: false, stats: { points: 26, rebounds: 9, assists: 9 } },
    { timestamp: 1762747200, opponent: 'Pacers', isHome: true, played: true, tripleDouble: true, stats: { points: 32, rebounds: 14, assists: 14 } },
    { timestamp: 1763006400, opponent: 'Kings', isHome: false, played: true, tripleDouble: false, stats: { points: 35, rebounds: 15, assists: 7 } },
    { timestamp: 1763092800, opponent: 'Clippers', isHome: false, played: true, tripleDouble: false, stats: { points: 55, rebounds: 12, assists: 6 } },
    { timestamp: 1763352000, opponent: 'Timberwolves', isHome: false, played: true, tripleDouble: true, stats: { points: 27, rebounds: 12, assists: 11 } },
    { timestamp: 1763524800, opponent: 'Bulls', isHome: true, played: true, tripleDouble: true, stats: { points: 36, rebounds: 18, assists: 13 } },
    { timestamp: 1763697600, opponent: 'Pelicans', isHome: false, played: true, tripleDouble: true, stats: { points: 28, rebounds: 11, assists: 12 } },
    { timestamp: 1763870400, opponent: 'Rockets', isHome: false, played: true, tripleDouble: false, stats: { points: 34, rebounds: 10, assists: 9 } },
    { timestamp: 1763956800, opponent: 'Kings', isHome: true, played: true, tripleDouble: false, stats: { points: 44, rebounds: 13, assists: 7 } },
    { timestamp: 1764129600, opponent: 'Grizzlies', isHome: false, played: true, tripleDouble: true, stats: { points: 17, rebounds: 10, assists: 16 } },
    { timestamp: 1764475200, opponent: 'Spurs', isHome: true, played: true, tripleDouble: false, stats: { points: 21, rebounds: 9, assists: 10 } },
    { timestamp: 1764561600, opponent: 'Suns', isHome: false, played: true, tripleDouble: false, stats: { points: 26, rebounds: 9, assists: 10 } },
    
    // December 2025
    { timestamp: 1764734400, opponent: 'Mavericks', isHome: true, played: true, tripleDouble: true, stats: { points: 29, rebounds: 20, assists: 13 } },
    { timestamp: 1764907200, opponent: 'Pacers', isHome: false, played: true, tripleDouble: false, stats: { points: 24, rebounds: 8, assists: 13 } },
    { timestamp: 1765080000, opponent: 'Hawks', isHome: false, played: true, tripleDouble: false, stats: { points: 40, rebounds: 9, assists: 8 } },
    { timestamp: 1765252800, opponent: 'Hornets', isHome: false, played: true, tripleDouble: false, stats: { points: 28, rebounds: 9, assists: 11 } },
    { timestamp: 1765598400, opponent: 'Kings', isHome: false, played: true, tripleDouble: false, stats: { points: 36, rebounds: 12, assists: 8 } },
    { timestamp: 1765857600, opponent: 'Rockets', isHome: true, played: true, tripleDouble: true, stats: { points: 39, rebounds: 15, assists: 10 } },
    { timestamp: 1766203200, opponent: 'Magic', isHome: true, played: true, tripleDouble: true, stats: { points: 23, rebounds: 11, assists: 13 } },
    { timestamp: 1766289600, opponent: 'Rockets', isHome: true, played: true, tripleDouble: false, stats: { points: 20, rebounds: 6, assists: 7 } },
    { timestamp: 1766548800, opponent: 'Jazz', isHome: true, played: true, tripleDouble: true, stats: { points: 14, rebounds: 13, assists: 13 } },
    { timestamp: 1766635200, opponent: 'Mavericks', isHome: false, played: true, tripleDouble: false, stats: { points: 29, rebounds: 7, assists: 14 } },
    { timestamp: 1766808000, opponent: 'Timberwolves', isHome: true, played: true, tripleDouble: true, stats: { points: 56, rebounds: 16, assists: 15 } },
    { timestamp: 1766980800, opponent: 'Magic', isHome: false, played: true, tripleDouble: true, stats: { points: 34, rebounds: 21, assists: 12 } },
    { timestamp: 1767153600, opponent: 'Heat', isHome: false, played: true, tripleDouble: false, stats: null },
    
    // January 2026
    { timestamp: 1767326400, opponent: 'Raptors', isHome: false, played: true, tripleDouble: false, stats: null },
    { timestamp: 1767499200, opponent: 'Cavaliers', isHome: false, played: true, tripleDouble: false, stats: null },
    { timestamp: 1767585600, opponent: 'Nets', isHome: false, played: true, tripleDouble: false, stats: null },
    { timestamp: 1767758400, opponent: '76ers', isHome: false, played: true, tripleDouble: false, stats: null },
    { timestamp: 1767931200, opponent: 'Celtics', isHome: false, played: true, tripleDouble: false, stats: null },
    { timestamp: 1768104000, opponent: 'Hawks', isHome: true, played: true, tripleDouble: false, stats: null },
    { timestamp: 1768276800, opponent: 'Bucks', isHome: true, played: true, tripleDouble: false, stats: null },
    { timestamp: 1768449600, opponent: 'Pelicans', isHome: false, played: true, tripleDouble: false, stats: null },
    { timestamp: 1768536000, opponent: 'Mavericks', isHome: false, played: true, tripleDouble: false, stats: null },
    { timestamp: 1768795200, opponent: 'Wizards', isHome: true, played: true, tripleDouble: false, stats: null },
    { timestamp: 1768881600, opponent: 'Hornets', isHome: true, played: true, tripleDouble: false, stats: null },
    { timestamp: 1769054400, opponent: 'Lakers', isHome: true, played: true, tripleDouble: false, stats: null },
    { timestamp: 1769227200, opponent: 'Wizards', isHome: false, played: true, tripleDouble: false, stats: null },
    { timestamp: 1769313600, opponent: 'Bucks', isHome: false, played: true, tripleDouble: false, stats: null },
    { timestamp: 1769400000, opponent: 'Grizzlies', isHome: false, played: false, tripleDouble: false, stats: null },
    { timestamp: 1769659200, opponent: 'Pistons', isHome: true, played: true, tripleDouble: false, stats: null },
    { timestamp: 1769832000, opponent: 'Nets', isHome: true, played: true, tripleDouble: false, stats: null },
    { timestamp: 1769918400, opponent: 'Clippers', isHome: true, played: true, tripleDouble: false, stats: { points: 31, rebounds: 12, assists: 5 } },
    
    // February 2026
    { timestamp: 1770091200, opponent: 'Thunder', isHome: true, played: true, tripleDouble: false, stats: { points: 17, rebounds: 8, assists: 7 } },
    { timestamp: 1770264000, opponent: 'Pistons', isHome: false, played: true, tripleDouble: false, stats: { points: 24, rebounds: 15, assists: 4 } },
    { timestamp: 1770350400, opponent: 'Knicks', isHome: false, played: true, tripleDouble: true, stats: { points: 30, rebounds: 14, assists: 10 } },
    { timestamp: 1770609600, opponent: 'Bulls', isHome: false, played: true, tripleDouble: true, stats: { points: 22, rebounds: 14, assists: 17 } },
    { timestamp: 1770782400, opponent: 'Cavaliers', isHome: true, played: true, tripleDouble: true, stats: { points: 22, rebounds: 14, assists: 11 } },
    { timestamp: 1770955200, opponent: 'Grizzlies', isHome: true, played: true, tripleDouble: true, stats: { points: 26, rebounds: 15, assists: 11 } },
    { timestamp: 1771646400, opponent: 'Clippers', isHome: false, played: true, tripleDouble: false, stats: { points: 22, rebounds: 17, assists: 6 } },
    { timestamp: 1771732800, opponent: 'Trail Blazers', isHome: false, played: true, tripleDouble: false, stats: { points: 32, rebounds: 9, assists: 7 } },
    { timestamp: 1771819200, opponent: 'Warriors', isHome: false, played: true, tripleDouble: true, stats: { points: 35, rebounds: 20, assists: 12 } },
    { timestamp: 1772164800, opponent: 'Celtics', isHome: true, played: true, tripleDouble: true, stats: { points: 32, rebounds: 14, assists: 10 } },
    { timestamp: 1772337600, opponent: 'Thunder', isHome: false, played: true, tripleDouble: true, stats: { points: 23, rebounds: 17, assists: 15 } },
    
    // March 2026
    { timestamp: 1772424000, opponent: 'Timberwolves', isHome: true, played: true, tripleDouble: false, stats: { points: 35, rebounds: 13, assists: 9 } },
    { timestamp: 1772596800, opponent: 'Jazz', isHome: false, played: true, tripleDouble: false, stats: { points: 22, rebounds: 12, assists: 5 } },
    { timestamp: 1772856000, opponent: 'Lakers', isHome: true, played: true, tripleDouble: true, stats: { points: 28, rebounds: 12, assists: 13 } },
    { timestamp: 1772942400, opponent: 'Knicks', isHome: true, played: true, tripleDouble: false, stats: { points: 38, rebounds: 8, assists: 5 } },
    { timestamp: 1773201600, opponent: 'Thunder', isHome: false, played: true, tripleDouble: true, stats: { points: 32, rebounds: 14, assists: 13 } },
    { timestamp: 1773374400, opponent: 'Rockets', isHome: true, played: true, tripleDouble: true, stats: { points: 16, rebounds: 12, assists: 13 } },
    { timestamp: 1773460800, opponent: 'Spurs', isHome: false, played: true, tripleDouble: true, stats: { points: 31, rebounds: 20, assists: 12 } },
    { timestamp: 1773720000, opponent: 'Lakers', isHome: false, played: true, tripleDouble: true, stats: { points: 24, rebounds: 16, assists: 14 } },
    { timestamp: 1773799200, opponent: '76ers', isHome: true, played: false, tripleDouble: false, stats: null },
    { timestamp: 1773880200, opponent: 'Grizzlies', isHome: false, played: false, tripleDouble: false, stats: null },
    { timestamp: 1774054800, opponent: 'Raptors', isHome: true, played: false, tripleDouble: false, stats: null },
    { timestamp: 1774213200, opponent: 'Trail Blazers', isHome: true, played: false, tripleDouble: false, stats: null },
    { timestamp: 1774407600, opponent: 'Suns', isHome: false, played: false, tripleDouble: false, stats: null },
    { timestamp: 1774490400, opponent: 'Mavericks', isHome: true, played: false, tripleDouble: false, stats: null },
    { timestamp: 1774659600, opponent: 'Jazz', isHome: true, played: false, tripleDouble: false, stats: null },
    { timestamp: 1774836000, opponent: 'Warriors', isHome: true, played: false, tripleDouble: false, stats: null },
    
    // April 2026
    { timestamp: 1775091600, opponent: 'Jazz', isHome: false, played: false, tripleDouble: false, stats: null },
    { timestamp: 1775329200, opponent: 'Spurs', isHome: true, played: false, tripleDouble: false, stats: null },
    { timestamp: 1775523600, opponent: 'Trail Blazers', isHome: true, played: false, tripleDouble: false, stats: null },
    { timestamp: 1775696400, opponent: 'Grizzlies', isHome: true, played: false, tripleDouble: false, stats: null },
    { timestamp: 1775869200, opponent: 'Thunder', isHome: true, played: false, tripleDouble: false, stats: null },
    { timestamp: 1776040200, opponent: 'Spurs', isHome: false, played: false, tripleDouble: false, stats: null }
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

  const [expandedMonths, setExpandedMonths] = useState({ [currentMonthKey]: true });
  const toggleMonth = (key) => setExpandedMonths(prev => ({ ...prev, [key]: !prev[key] }));

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
        <h1 className="display-4 fw-bold mb-2" style={{color: '#FDB927'}}>
          🏀 Triple-Double Watch 🏀
        </h1>
        <p className="lead mb-3">
          Following Nikola Jokić's Historic Chase to #1 All-Time
        </p>
      </div>

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
              {Object.entries(gamesByMonth).map(([monthKey, { name, games }]) => {
                const isOpen = !!expandedMonths[monthKey];
                const tds = games.filter(g => g.tripleDouble).length;
                const played = games.filter(g => g.played).length;
                return (
                  <div key={monthKey}>
                    <button
                      type="button"
                      className={`td-month-toggle${isOpen ? ' open' : ''}`}
                      onClick={() => toggleMonth(monthKey)}
                    >
                      <span className="td-month-arrow">{isOpen ? '▾' : '▸'}</span>
                      <span className="td-month-name">{name}</span>
                      <span className="td-month-summary">
                        {played} game{played !== 1 ? 's' : ''}{tds > 0 && <>{' · '}<Badge bg="success" pill className="td-month-badge">{tds} TD</Badge></>}
                      </span>
                    </button>
                    {isOpen && (
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
                          {games.map((game, idx) => (
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
                    )}
                  </div>
                );
              })}
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
