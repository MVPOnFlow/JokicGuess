import React from 'react';
import { Container, Row, Col, Card, Table, Badge } from 'react-bootstrap';
import { Link } from 'react-router-dom';
import './Blog.css';

const TripleDoubleChase = () => {
  const gameStats = {
    player: "Nikola Jokic",
    date: "February 2026",
    career_tds: 180,
    needed: 1,
    next_record: "Oscar Robertson (181)",
    ultimate_goal: "Russell Westbrook (207)"
  };

  const recentTripleDoubles = [
    { date: "Jan 28, 2026", opp: "vs PHI", stats: "27/13/10", result: "W 144-109" },
    { date: "Jan 26, 2026", opp: "@ GSW", stats: "35/10/11", result: "W 119-115" },
    { date: "Jan 24, 2026", opp: "vs MIA", stats: "24/12/10", result: "W 133-113" },
    { date: "Jan 19, 2026", opp: "@ BOS", stats: "29/16/13", result: "W 124-121" },
    { date: "Jan 15, 2026", opp: "vs LAL", stats: "32/11/14", result: "W 127-120" }
  ];

  const allTimeLeaders = [
    { rank: 1, name: "Russell Westbrook", total: 207, active: true },
    { rank: 2, name: "Oscar Robertson", total: 181, active: false },
    { rank: 3, name: "Nikola Jokić", total: 180, active: true, highlight: true },
    { rank: 4, name: "Magic Johnson", total: 138, active: false },
    { rank: 5, name: "LeBron James", total: 122, active: true },
    { rank: 6, name: "Jason Kidd", total: 107, active: false },
    { rank: 7, name: "Luka Dončić", total: 88, active: true },
    { rank: 8, name: "James Harden", total: 82, active: true },
    { rank: 9, name: "Wilt Chamberlain", total: 78, active: false },
    { rank: 10, name: "Domantas Sabonis", total: 68, active: true }
  ];

  return (
    <div className="blog-article">
      <Container className="py-5">
        <Link to="/blog" className="mb-4 d-inline-block">← Back to Blog</Link>
        
        <Row>
          <Col lg={8}>
            <div className="article-header">
              <Badge bg="primary" className="mb-3">Career Milestone</Badge>
              <h1 className="mb-3">The Triple-Double Chase: Jokic Climbs History</h1>
              <p className="lead">
                Nikola Jokić has surpassed Magic Johnson to claim sole possession of 3rd place on the all-time triple-double list. With 180 career triple-doubles, the Joker is just one behind Oscar Robertson and rewriting NBA history one game at a time.
              </p>
              <div className="article-meta">
                <span>By $MVP Team</span> | <span>Updated February 2026</span>
              </div>
            </div>

            <div className="article-content">
              <h3>Historic Achievement</h3>
              <p>
                In a remarkable display of all-around excellence, Nikola Jokić has surpassed Magic Johnson's legendary mark of 138 career triple-doubles, moving into sole possession of third place on the NBA's all-time list. With 180 career triple-doubles, he stands just one behind Oscar Robertson (181) and continues his pursuit of Russell Westbrook's record of 207.
              </p>

              <Row className="my-4">
                <Col md={6} className="mb-3">
                  <div className="stat-box">
                    <h2>180</h2>
                    <p className="text-muted mb-0">Career Triple-Doubles<br/><small>3rd All-Time</small></p>
                  </div>
                </Col>
                <Col md={6} className="mb-3">
                  <div className="stat-box">
                    <h2>1</h2>
                    <p className="text-muted mb-0">Behind Oscar Robertson<br/><small>For 2nd Place</small></p>
                  </div>
                </Col>
              </Row>

              <h3>The Journey to 3rd Place</h3>
              <p>
                What makes Jokic's achievement even more remarkable is the efficiency with which he's accumulated these triple-doubles. Unlike players who hunt for stats, Jokic's triple-doubles come naturally within the flow of Denver's offensive system. His unique blend of size, court vision, and passing ability allows him to dominate games without appearing to force anything.
              </p>

              <blockquote>
                "Jokic's triple-doubles aren't just about numbers, they're about winning basketball. He makes everyone around him better, and that's what separates the greats from the legends." - NBA Analyst
              </blockquote>

              <h3>Recent Triple-Double Surge</h3>
              <p>
                The 2025-26 season has seen Jokic operating at an unprecedented level. His recent stretch of triple-doubles showcases not just consistency, but dominance:
              </p>

              <Card className="mb-4 game-summary-card">
                <Card.Header>
                  <h6 className="mb-0">Recent Triple-Doubles (Last 5)</h6>
                </Card.Header>
                <Table striped hover responsive className="mb-0">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Opponent</th>
                      <th>Stats (P/R/A)</th>
                      <th>Result</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentTripleDoubles.map((game, idx) => (
                      <tr key={idx}>
                        <td>{game.date}</td>
                        <td>{game.opp}</td>
                        <td><strong>{game.stats}</strong></td>
                        <td><Badge bg={game.result.includes('W') ? 'success' : 'danger'}>{game.result}</Badge></td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              </Card>

              <h3>The All-Time List</h3>
              <p>
                With 180 career triple-doubles, Jokić now finds himself in rarefied air. Here's the complete top 10 all-time leaders (via Basketball Reference):
              </p>

              <Card className="mb-4 stats-card">
                <Card.Header>
                  <h6 className="mb-0">All-Time Triple-Double Leaders</h6>
                </Card.Header>
                <Table hover responsive className="mb-0">
                  <thead>
                    <tr>
                      <th>Rank</th>
                      <th>Player</th>
                      <th>Total</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {allTimeLeaders.map((player) => (
                      <tr key={player.rank} className={player.highlight ? 'table-primary' : ''}>
                        <td><strong>{player.rank}</strong></td>
                        <td><strong>{player.name}</strong></td>
                        <td><strong>{player.total}</strong></td>
                        <td>
                          <Badge bg={player.active ? 'success' : 'secondary'}>
                            {player.active ? 'Active' : 'Retired'}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              </Card>

              <h3>What Makes Jokić's Triple-Doubles Special</h3>
              <p>
                While Russell Westbrook's 207 triple-doubles represent the pinnacle of individual achievement in this category, Jokić's path has been different. His triple-doubles come with:
              </p>
              <ul>
                <li><strong>Elite Efficiency:</strong> Jokic maintains a true shooting percentage well above league average even while posting triple-doubles</li>
                <li><strong>Team Success:</strong> The Nuggets have an exceptional win rate when Jokic records a triple-double</li>
                <li><strong>Natural Flow:</strong> His assists and rebounds come within the natural flow of Denver's offense, not through stat-hunting</li>
                <li><strong>Versatility:</strong> Jokic can dominate games through scoring, passing, or rebounding depending on what the team needs</li>
              </ul>

              <h3>The Path to Oscar Robertson</h3>
              <p>
                Now firmly in third place, the next target for Jokic is Oscar Robertson's 181 career triple-doubles. At his current pace of approximately 30 triple-doubles per season, Jokic could realistically challenge the Big O's record within the next 1-2 seasons. Given Jokic's age (still in his prime at 30) and his consistent excellence, this milestone appears well within reach.
              </p>

              <h3>The Westbrook Record</h3>
              <p>
                Russell Westbrook's record of 207 triple-doubles seemed untouchable when he set it, but Jokić's sustained excellence makes it a legitimate target. At 30 years old and with 180 triple-doubles already, Jokić needs just 28 more to break the all-time record. If he maintains his health and current pace of approximately 30 triple-doubles per season, he could realistically challenge Westbrook's mark within the next 1-2 seasons.
              </p>

              <blockquote>
                "When you watch Jokic play, you're not watching someone chase triple-doubles. You're watching a maestro conduct an orchestra. The triple-doubles are just a byproduct of basketball genius." - Nuggets Coach Michael Malone
              </blockquote>

              <h3>Impact on the $MVP Community</h3>
              <p>
                For $MVP community participants, Jokić's triple-double consistency creates unique opportunities:
              </p>
              <ul>
                <li>Triple-double contests offer enhanced rewards and multipliers</li>
                <li>Historic milestone games trigger special raffle bonuses</li>
                <li>TD Watch tracking helps participants predict and celebrate these achievements</li>
                <li>Community engagement peaks during triple-double chases</li>
              </ul>

              <h3>Looking Ahead</h3>
              <p>
                As the 2025-26 season progresses, every Nuggets game carries the potential for history. Will this be the game Jokić ties Oscar? Will we witness the climb to 190, 200, or even surpassing Westbrook's record? For $MVP community participants and NBA fans worldwide, watching Jokić chase history has become one of the most compelling storylines in basketball.
              </p>

              <p>
                The journey from a second-round pick to one of the greatest all-around players in NBA history has been remarkable. But for Nikola Jokic, this isn't about personal records; it's about winning championships and making his teammates better. The triple-doubles are simply evidence of excellence in pursuit of team success.
              </p>

              <div className="mt-5 p-4 bg-light rounded">
                <h4>Stay Updated</h4>
                <p className="mb-0">
                  Track Jokić's triple-double chase in real-time on our <Link to="/tdwatch">TD Watch page</Link>. Join the $MVP community on Discord and participate in triple-double prediction contests for exclusive rewards!
                </p>
              </div>
            </div>
          </Col>

          <Col lg={4}>
            <div className="sticky-sidebar">
              <Card className="mb-4 sidebar-card">
                <Card.Header>
                  <h6>Quick Stats</h6>
                </Card.Header>
                <Card.Body>
                  <p><strong>Career Triple-Doubles:</strong> 180</p>
                  <p><strong>All-Time Rank:</strong> 3rd</p>
                  <p><strong>Behind Oscar:</strong> 1 TD</p>
                  <p className="mb-0"><strong>Behind Westbrook:</strong> 27 TDs</p>
                </Card.Body>
              </Card>

              <Card className="sidebar-card">
                <Card.Header>
                  <h6>Related Articles</h6>
                </Card.Header>
                <Card.Body>
                  <Link to="/blog/okc-game-analysis">Thunder Silence Nuggets Behind SGA's 34</Link>
                  <Link to="/blog/defensive-impact">Defensive Ratings: Jokic's Hidden Impact</Link>
                  <Link to="/tdwatch">TD Watch - Live Tracker</Link>
                </Card.Body>
              </Card>
            </div>
          </Col>
        </Row>
      </Container>
    </div>
  );
};

export default TripleDoubleChase;
