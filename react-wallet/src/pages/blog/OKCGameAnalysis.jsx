import { Container, Row, Col, Card, Badge, Table } from 'react-bootstrap';
import { Link } from 'react-router-dom';
import { getRelatedArticles } from './articleData';
import './Blog.css';

function OKCGameAnalysis() {
  const gameStats = {
    date: 'February 1, 2026',
    opponent: 'Oklahoma City Thunder',
    result: 'Loss, 111-121',
    jokicStats: {
      points: 16,
      rebounds: 11,
      assists: 8,
      tripleDouble: false,
      fieldGoals: '6-9',
      threePointers: '1-2',
      freeThrows: '3-4'
    }
  };

  const relatedArticles = getRelatedArticles('okc-game-analysis');

  return (
    <div className="blog-article">
      <Container className="py-5">
        <Link to="/blog" className="mb-4 d-inline-block">← Back to Blog</Link>
        
        <Row>
          <Col lg={8}>
            <div className="article-header">
              <Badge bg="primary" className="mb-3">Game Analysis</Badge>
              <h1 className="mb-3">Thunder Silence Nuggets Behind SGA's 34 Points</h1>
              <p className="lead">
                Oklahoma City cruises to 121-111 victory as Shai Gilgeous-Alexander and Cason Wallace dominate from three-point range. Jokic returns from injury but Nuggets fall short in battle of West contenders.
              </p>
              <div className="article-meta">
                <span>By $MVP Team</span> | <span>{gameStats.date}</span> | <span>6 min read</span>
              </div>
            </div>

            <div className="article-content">
              {/* Game Summary */}
              <Card className="mb-4 game-summary-card">
                <Card.Header>
                  <h5 className="mb-0">Game Summary</h5>
                </Card.Header>
                <Card.Body>
                  <Row className="text-center mb-4">
                    <Col md={4}>
                      <h6 className="text-muted small">Final Score</h6>
                      <h4 className="fw-bold text-danger">Denver 111</h4>
                      <p className="text-success mb-0">OKC 121</p>
                    </Col>
                    <Col md={4}>
                      <h6 className="text-muted small">Venue</h6>
                      <p className="fw-bold mb-0">Ball Arena</p>
                      <p className="small text-muted mb-0">Denver, CO</p>
                    </Col>
                    <Col md={4}>
                      <h6 className="text-muted small">Attendance</h6>
                      <p className="fw-bold mb-0">19,900</p>
                      <p className="small text-muted mb-0">Sellout</p>
                    </Col>
                  </Row>
                  <hr />
                  <p className="mb-0">
                    Shai Gilgeous-Alexander scored 34 points and Cason Wallace added a career-best 27, including seven 3-pointers, as the Oklahoma City Thunder beat the Denver Nuggets 121-111 on Sunday night. The Thunder never trailed in this matchup of the top two teams in the Western Conference.
                  </p>
                </Card.Body>
              </Card>

              {/* Jokic Stats */}
              <Row className="mb-4">
                <Col md={3} className="mb-3">
                  <div className="stat-box">
                    <h2>{gameStats.jokicStats.points}</h2>
                    <p className="text-muted mb-0">Points</p>
                  </div>
                </Col>
                <Col md={3} className="mb-3">
                  <div className="stat-box">
                    <h2>{gameStats.jokicStats.rebounds}</h2>
                    <p className="text-muted mb-0">Rebounds</p>
                  </div>
                </Col>
                <Col md={3} className="mb-3">
                  <div className="stat-box">
                    <h2>{gameStats.jokicStats.assists}</h2>
                    <p className="text-muted mb-0">Assists</p>
                  </div>
                </Col>
                <Col md={3} className="mb-3">
                  <div className="stat-box">
                    <Badge bg="warning" className="p-2">6-9 FG</Badge>
                    <p className="text-muted mb-0 mt-2"><small>66.7% shooting</small></p>
                  </div>
                </Col>
              </Row>

              <h3>Thunder's Three-Point Barrage</h3>
              <p>
                The Thunder dominated from beyond the arc, sinking 19 three-pointers on the night. The third quarter proved decisive, as Oklahoma City went 8-for-13 from long range to expand a seven-point halftime lead to 16 points.
              </p>
              <p>
                Cason Wallace's career-best 27 points came primarily from downtown, as he knocked down seven three-pointers. Combined with Shai Gilgeous-Alexander's 34 points and 13 assists, the Thunder's offensive firepower proved too much for a shorthanded Nuggets squad.
              </p>

              <h3>Jokic's Quiet Return from Injury</h3>
              <p>
                Playing in just his second game back from a knee injury that sidelined him for 16 games, Nikola Jokic scored 16 points on just nine shot attempts. The MVP was efficient (6-for-9 shooting) but uncharacteristically passive in a game where Denver needed more offensive production from their star.
              </p>
              <p>
                The Nuggets' pair of All-Stars had a rather quiet night. Jamal Murray, fresh off earning his first All-Star berth earlier in the day, struggled mightily, scoring just 12 points on 4-of-16 shooting, including 1-for-8 from three-point range.
              </p>

              <h3>The Turning Point: Third Quarter Explosion</h3>
              <p>
                The game shifted dramatically in the third quarter. After Denver cut the deficit to 74-70, the Thunder unleashed a devastating 12-0 run—all from three-point range. Chet Holmgren, also named an All-Star reserve Sunday, hit a three-pointer and Wallace sank his sixth and seventh triples. After a Denver timeout, SGA swished a three and so did Aaron Wiggins to cap the decisive run.
              </p>
              <p>
                This sequence exemplified Oklahoma City's offensive efficiency and Denver's defensive struggles without key rotation players.
              </p>

              <h3>Injury Context</h3>
              <p>
                Both teams were significantly undermanned. The Nuggets are still missing Christian Braun (left ankle), Cameron Johnson (right knee), and won't have Aaron Gordon (right hamstring) back until mid-March. For Oklahoma City, Jalen Williams (hamstring), Ajay Mitchell (abdomen), and Alex Caruso (right adductor strain) were all ruled out.
              </p>
              <p>
                Peyton Watson led Denver with 29 points in expanded minutes, but it wasn't enough to overcome the Thunder's balanced attack and superior three-point shooting.
              </p>

              <h3>Championship Rematch Context</h3>
              <p>
                This was their first meeting since the Thunder beat Denver in Game 7 of the Western Conference semifinals last May on their way to winning the city's first NBA championship. That playoff series victory propelled Oklahoma City to their historic championship run, adding extra significance to this regular season matchup.
              </p>
              <p>
                With the Thunder now holding a 39-11 record compared to Denver's 33-17, the gap between the two Western Conference powers has widened from last season.
              </p>

              <h3>Key Takeaways</h3>
              <ul>
                <li>Thunder's 19 three-pointers (including 8-of-13 in Q3) were the difference-maker</li>
                <li>Cason Wallace's career-high 27 points (7 threes) provided crucial secondary scoring</li>
                <li>Jokic looked rusty in second game back, taking only 9 shots</li>
                <li>Jamal Murray's 1-for-8 from three severely limited Denver's offense</li>
                <li>Denver never led, with OKC controlling wire-to-wire</li>
                <li>Injuries continue to hamper both squads heading into All-Star break</li>
              </ul>

              <div className="mt-5 p-4 rounded" style={{
                background: '#1e293b',
                border: '1px solid #334155'
              }}>
                <h4 style={{ color: '#FDB927' }}>Looking Ahead</h4>
                <p className="mb-0" style={{ color: '#E5E7EB' }}>
                  The Nuggets (33-17) visit the Detroit Pistons on Tuesday as they look to bounce back from this loss. With Aaron Gordon still weeks away from returning, Denver will need more offensive output from Jokić and Murray as they push toward the playoffs. Track every game on our <Link to="/tdwatch" style={{ color: '#FDB927', fontWeight: 'bold' }}>TD Watch page</Link> and join the $MVP community on Discord!
                </p>
              </div>
            </div>
          </Col>

          <Col lg={4}>
            <div className="sticky-sidebar">
              <Card className="mb-4 sidebar-card">
                <Card.Header>
                  <h6>Game Details</h6>
                </Card.Header>
                <Card.Body>
                  <p><strong>Date:</strong> {gameStats.date}</p>
                  <p><strong>Result:</strong> {gameStats.result}</p>
                  <p><strong>Jokic Stats:</strong> 16/11/8</p>
                  <p><strong>FG:</strong> {gameStats.jokicStats.fieldGoals}</p>
                  <p><strong>3PT:</strong> {gameStats.jokicStats.threePointers}</p>
                  <p className="mb-0"><strong>FT:</strong> {gameStats.jokicStats.freeThrows}</p>
                  <hr />
                  <p className="mb-0"><small><strong>Thunder Leaders:</strong><br/>SGA: 34 pts, 13 ast<br/>Wallace: 27 pts, 7 3PM</small></p>
                </Card.Body>
              </Card>

              <Card className="sidebar-card">
                <Card.Header>
                  <h6>Related Articles</h6>
                </Card.Header>
                <Card.Body>
                  {relatedArticles.map((article) => (
                    <Link key={article.id} to={`/blog/${article.id}`}>
                      {article.title}
                    </Link>
                  ))}
                </Card.Body>
              </Card>
            </div>
          </Col>
        </Row>
      </Container>
    </div>
  );
}

export default OKCGameAnalysis;
