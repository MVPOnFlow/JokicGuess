import React from 'react';
import { Container, Row, Col, Card, Table, Badge } from 'react-bootstrap';
import { Link } from 'react-router-dom';
import { getRelatedArticles } from './articleData';
import Comments from './Comments';
import './Blog.css';

const JokicPassesOscar = () => {
  const milestones = [
    { td: 1, date: "Oct 24, 2017", opp: "vs ATL", stats: "14/12/10", note: "First career triple-double in just his 2nd NBA season" },
    { td: 50, date: "Mar 30, 2021", opp: "vs ORL", stats: "25/15/10", note: "Reached 50 during his first MVP season" },
    { td: 100, date: "Mar 6, 2023", opp: "vs LAC", stats: "32/16/10", note: "100th triple-double in championship season" },
    { td: 138, date: "Nov 18, 2025", opp: "vs CHI", stats: "36/18/13", note: "Passed Magic Johnson for 3rd all-time" },
    { td: 181, date: "Feb 4, 2026", opp: "@ NYK", stats: "30/14/10", note: "Tied Oscar Robertson for 2nd all-time" },
    { td: 182, date: "Feb 7, 2026", opp: "@ CHI", stats: "22/14/17", note: "Passed Oscar Robertson — sole possession of 2nd place" },
    { td: 183, date: "Feb 9, 2026", opp: "vs CLE", stats: "22/14/11", note: "Extended lead over Oscar to 2" },
  ];

  const allTimeLeaders = [
    { rank: 1, name: "Russell Westbrook", total: 207, active: true },
    { rank: 2, name: "Nikola Jokić", total: 183, active: true, highlight: true },
    { rank: 3, name: "Oscar Robertson", total: 181, active: false },
    { rank: 4, name: "Magic Johnson", total: 138, active: false },
    { rank: 5, name: "LeBron James", total: 122, active: true },
    { rank: 6, name: "Jason Kidd", total: 107, active: false },
    { rank: 7, name: "Luka Dončić", total: 88, active: true },
    { rank: 8, name: "James Harden", total: 82, active: true },
    { rank: 9, name: "Wilt Chamberlain", total: 78, active: false },
    { rank: 10, name: "Domantas Sabonis", total: 68, active: true }
  ];

  const relatedArticles = getRelatedArticles('jokic-passes-oscar');

  return (
    <div className="blog-article">
      <Container className="py-5">
        <Link to="/blog" className="mb-4 d-inline-block">← Back to Blog</Link>

        <Row>
          <Col lg={8}>
            <div className="article-header">
              <Badge bg="primary" className="mb-3">Career Milestone</Badge>
              <h1 className="mb-3">The Big O Dethroned: Jokić Surpasses Oscar Robertson for 2nd All-Time in Triple-Doubles</h1>
              <p className="lead">
                With his 183rd career triple-double, Nikola Jokić has officially moved past Oscar Robertson into sole possession of second place on the NBA's all-time triple-double list. A look back at the milestones, the legend he passed, and the record still ahead.
              </p>
              <div className="article-meta">
                <span>By $MVP Team</span> | <span>February 12, 2026</span> | <span>10 min read</span>
              </div>
            </div>

            <div className="article-content">
              {/* The Moment */}
              <h3>The Moment</h3>
              <p>
                On February 7, 2026, Nikola Jokić did what he does best: he made it look routine. With 22 points, 14 rebounds, and a stunning 17 assists against the Chicago Bulls, the Joker notched career triple-double number 182 — and in doing so, moved past Oscar Robertson into sole possession of 2nd place on the all-time triple-double list. Three days earlier, he had tied the Big O at 181 with a 30/14/10 line against the New York Knicks. Two days later, he extended his lead with a 22/14/11 performance against the Cleveland Cavaliers for number 183.
              </p>
              <p>
                There was no grand celebration, no confetti cannon. Jokić simply jogged back on defense, perhaps unaware — or more likely, unconcerned — that he had just overtaken a record that stood unchallenged for over half a century. That quiet excellence is the essence of Nikola Jokić.
              </p>

              <Row className="my-4">
                <Col md={4} className="mb-3">
                  <div className="stat-box">
                    <h2>183</h2>
                    <p className="text-muted mb-0">Career Triple-Doubles<br/><small>2nd All-Time</small></p>
                  </div>
                </Col>
                <Col md={4} className="mb-3">
                  <div className="stat-box">
                    <h2>24</h2>
                    <p className="text-muted mb-0">Behind Westbrook<br/><small>For 1st Place</small></p>
                  </div>
                </Col>
                <Col md={4} className="mb-3">
                  <div className="stat-box">
                    <h2>30</h2>
                    <p className="text-muted mb-0">Age at Milestone<br/><small>Still in His Prime</small></p>
                  </div>
                </Col>
              </Row>

              {/* Oscar Robertson Section */}
              <h3>The Legend He Passed: Oscar Robertson</h3>
              <p>
                To truly appreciate what Jokić has accomplished, you have to understand the giant whose shadow he just stepped out of. Oscar Palmer Robertson — "The Big O" — was the original triple-double machine, decades before the term was even coined.
              </p>
              <p>
                Selected first overall in the 1960 NBA Draft by the Cincinnati Royals, Robertson was a 6'5" guard who combined scoring, passing, and rebounding in a way nobody had seen before. In his <strong>second season (1961-62)</strong>, he averaged a <strong>triple-double for the entire year</strong>: 30.8 points, 12.5 rebounds, and 11.4 assists per game over 79 games. That feat went unmatched for 55 years until Russell Westbrook replicated it in 2016-17.
              </p>
              <p>
                Robertson finished his 14-year career with 181 triple-doubles, a 12-time All-Star selection, the 1964 MVP award, and a championship with the Milwaukee Bucks in 1971 alongside Kareem Abdul-Jabbar. Off the court, he was equally transformative — his landmark antitrust lawsuit against the NBA (<em>Robertson v. National Basketball Association</em>) paved the way for free agency and forever changed the economics of professional basketball.
              </p>
              <p>
                For decades, Robertson's 181 triple-doubles seemed like a record from another era, an artifact of a time when pace was frenetic and big guards controlled the ball more. The number sat unchallenged from Robertson's retirement in 1974 until Russell Westbrook finally surpassed it in 2021. Now Jokić — a 7-foot center from Sombor, Serbia — has joined that exclusive club.
              </p>

              <blockquote>
                "Oscar Robertson was the blueprint. He was doing triple-doubles before anyone kept track of them. For Jokić to pass him as a center — not a point guard — tells you everything about how special this kid from Serbia really is." — NBA historian
              </blockquote>

              {/* Milestones Timeline */}
              <h3>The Road to 183: Key Milestones</h3>
              <p>
                Jokić's triple-double journey has been defined by steady acceleration. What started as an occasional feat became a nightly expectation. Here are the defining checkpoints along the way:
              </p>

              <Card className="mb-4 game-summary-card">
                <Card.Header>
                  <h6 className="mb-0">Career Triple-Double Milestones</h6>
                </Card.Header>
                <Table striped hover responsive className="mb-0">
                  <thead>
                    <tr>
                      <th>TD #</th>
                      <th>Date</th>
                      <th>Game</th>
                      <th>Stats (P/R/A)</th>
                      <th>Significance</th>
                    </tr>
                  </thead>
                  <tbody>
                    {milestones.map((m, idx) => (
                      <tr key={idx} className={m.td === 182 ? 'table-primary' : ''}>
                        <td><strong>#{m.td}</strong></td>
                        <td>{m.date}</td>
                        <td>{m.opp}</td>
                        <td><strong>{m.stats}</strong></td>
                        <td><small>{m.note}</small></td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              </Card>

              {/* The Journey */}
              <h3>From 41st Pick to 2nd All-Time</h3>
              <p>
                The arc of Jokić's career reads like fiction. Selected 41st overall in the 2014 NBA Draft — famously while he was eating — Jokić was not projected to be a rotation player, let alone a generational talent. He spent his first NBA season averaging 10 points and 7 rebounds as a curious, doughy rookie center who seemed to be playing a different sport than everyone else on the court.
              </p>
              <p>
                His first triple-double arrived on October 24, 2017, against the Atlanta Hawks in just his third professional season. By the end of 2020-21, he had his first MVP award and 60 career triple-doubles. The acceleration was remarkable: it took him roughly four seasons to reach 50, but only two more to reach 100. By the time he lifted the Larry O'Brien Trophy in June 2023, he was already third all-time.
              </p>
              <p>
                The 2025-26 season has been his most prolific yet for triple-doubles. Playing at age 30 with the poise and vision of a player in perfect command of his craft, Jokić entered the season with roughly 150 career triple-doubles and has been adding to the total at a staggering pace — multiple per month, often in bunches, often in games the Nuggets desperately needed.
              </p>

              <h3>What Makes Jokić's Triple-Doubles Different</h3>
              <p>
                Not all triple-doubles are created equal, and Jokić's carry a distinctive fingerprint:
              </p>
              <ul>
                <li><strong>Position:</strong> He's a 7-foot, 284-pound center. Robertson was a guard. Westbrook is a guard. Magic Johnson was a 6'9" point guard. Jokić is a true center who orchestrates from the post and the elbow — the most unusual triple-double engine in NBA history.</li>
                <li><strong>Efficiency:</strong> Jokić's career true shooting percentage is well above the league average, even in triple-double games. He doesn't sacrifice efficiency for volume.</li>
                <li><strong>Winning:</strong> Denver's win rate when Jokić records a triple-double is elite. These aren't empty stats on losing teams — they're winning performances.</li>
                <li><strong>Organic playmaking:</strong> Where some players are accused of stat-padding (hunting the 10th rebound or assist), Jokić's triple-doubles emerge naturally from Denver's motion offense. He doesn't need the ball in his hands on every possession to accumulate assists; his rebounds come from positioning, not boxing out teammates.</li>
              </ul>

              {/* All-Time Leaders Table */}
              <h3>The New All-Time Leaderboard</h3>
              <p>
                With Jokić's ascent, the all-time triple-double leaderboard now looks like this:
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

              {/* Oscar vs Jokic Comparison */}
              <h3>Two Eras, One Standard</h3>
              <p>
                Comparing players across eras is always fraught, but the parallels between Robertson and Jokić are striking — as are the differences:
              </p>
              <Card className="mb-4 game-summary-card">
                <Card.Header>
                  <h6 className="mb-0">Oscar Robertson vs. Nikola Jokić</h6>
                </Card.Header>
                <Table hover responsive className="mb-0">
                  <thead>
                    <tr>
                      <th></th>
                      <th>Oscar Robertson</th>
                      <th>Nikola Jokić</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr><td><strong>Position</strong></td><td>Guard (6'5")</td><td>Center (6'11")</td></tr>
                    <tr><td><strong>Draft Pick</strong></td><td>1st overall (1960)</td><td>41st overall (2014)</td></tr>
                    <tr><td><strong>Career Triple-Doubles</strong></td><td>181</td><td>183+</td></tr>
                    <tr><td><strong>Seasons to 181 TDs</strong></td><td>14</td><td>~11</td></tr>
                    <tr><td><strong>MVP Awards</strong></td><td>1 (1964)</td><td>3 (2021, 2022, 2024)</td></tr>
                    <tr><td><strong>Championships</strong></td><td>1 (1971)</td><td>1 (2023)</td></tr>
                    <tr><td><strong>Averaged a TD Season</strong></td><td>Yes (1961-62)</td><td>No (but close multiple times)</td></tr>
                    <tr><td><strong>Off-Court Legacy</strong></td><td>Free agency pioneer</td><td>Still writing his story</td></tr>
                  </tbody>
                </Table>
              </Card>
              <p>
                Robertson did most of his damage in an era with a faster pace and fewer teams, but also without the benefit of modern training, nutrition, or analytics. Jokić plays in a league that better tracks and values triple-doubles, but also one where defensive schemes are far more sophisticated. Both men achieved their totals by being the most complete players on the floor every single night.
              </p>

              {/* The Westbrook Chase */}
              <h3>Next Stop: Westbrook's 207</h3>
              <p>
                With Robertson now in the rearview mirror, the only name left above Jokić on the list is Russell Westbrook, whose 207 career triple-doubles set a standard many believed would last for decades. Jokić now needs just 24 more to claim the all-time crown.
              </p>
              <p>
                At his current pace of roughly 30+ triple-doubles per season, Jokic could realistically catch Westbrook before the end of the 2026-27 season. He'll turn 31 in February 2026, meaning he has multiple prime years remaining. Barring injury, the question isn't <em>if</em> Jokić will break the all-time record — it's <em>when</em>.
              </p>
              <p>
                Westbrook himself earned many of his triple-doubles during an extraordinary run with the Oklahoma City Thunder from 2016 to 2021, averaging a triple-double in four different seasons. His relentless motor and attacking style were the perfect vehicle for compiling those numbers. But where Westbrook powered through defenses, Jokić sees through them — different styles, same destination on the leaderboard.
              </p>

              <blockquote>
                "Jokić doesn't chase triple-doubles. Triple-doubles chase him. That's the difference." — Denver Nuggets fan community
              </blockquote>

              {/* Impact on $MVP */}
              <h3>What This Means for the $MVP Community</h3>
              <p>
                For participants in the $MVP ecosystem, Jokić's historic milestones are more than just box-score celebrations:
              </p>
              <ul>
                <li><strong>Triple-Double Bonuses:</strong> TD Watch contests reward participants when Jokic records a triple-double, and milestone games trigger enhanced prize pools</li>
                <li><strong>Engagement Peaks:</strong> Community activity surges during historic games — Discord watch parties, live predictions, and reactions create shared memorable moments</li>
                <li><strong>TopShot Moments:</strong> Historic triple-doubles generate special NBA TopShot moments on the Flow blockchain, adding collectible value for the community</li>
                <li><strong>The Westbrook Chase:</strong> With only 24 triple-doubles separating Jokić from the all-time record, every game for the rest of this season and next carries potential for history</li>
              </ul>

              <h3>A Legacy Still Being Written</h3>
              <p>
                Oscar Robertson's 181 triple-doubles stood as the gold standard for nearly 50 years. It was a monument to an era, a testament to the most versatile guard the NBA had ever seen. That Jokić — a second-round center from a small town in Serbia — is the one who surpassed him is one of basketball's most improbable and beautiful stories.
              </p>
              <p>
                Robertson changed basketball on and off the court. His legal battle for free agency reshaped the entire sports landscape. Jokić is changing basketball in his own way — redefining what a center can be, proving that the most dominant player in the sport doesn't need to be the most athletic, and demonstrating that generational talent can emerge from anywhere on the globe and any spot in the draft.
              </p>
              <p>
                At 30 years old with 183 career triple-doubles, a Finals MVP trophy, and three regular-season MVPs, Nikola Jokić is still ascending. The Westbrook record looms, the Nuggets are contending, and every game brings the possibility of another chapter in one of the greatest careers the NBA has ever seen.
              </p>
              <p>
                The Big O would understand. Excellence, after all, recognizes excellence.
              </p>

              <div className="mt-5 p-4 bg-light rounded">
                <h4>Stay Updated</h4>
                <p className="mb-0">
                  Track Jokić's pursuit of the all-time triple-double record on our <Link to="/tdwatch">TD Watch page</Link>. Join the $MVP community on Discord to participate in triple-double prediction contests and celebrate every milestone together!
                </p>
              </div>
            </div>

            {/* Comments Section */}
            <Comments articleId="jokic-passes-oscar" />
          </Col>

          <Col lg={4}>
            <div className="sticky-sidebar">
              <Card className="mb-4 sidebar-card">
                <Card.Header>
                  <h6>Quick Stats</h6>
                </Card.Header>
                <Card.Body>
                  <p><strong>Career Triple-Doubles:</strong> 183</p>
                  <p><strong>All-Time Rank:</strong> 2nd</p>
                  <p><strong>Passed:</strong> Oscar Robertson (181)</p>
                  <p><strong>Next Target:</strong> Westbrook (207)</p>
                  <p className="mb-0"><strong>Remaining Gap:</strong> 24 TDs</p>
                </Card.Body>
              </Card>

              <Card className="mb-4 sidebar-card">
                <Card.Header>
                  <h6>Oscar Robertson</h6>
                </Card.Header>
                <Card.Body>
                  <p><strong>Career TDs:</strong> 181</p>
                  <p><strong>Active:</strong> 1960–1974</p>
                  <p><strong>Teams:</strong> Royals, Bucks</p>
                  <p><strong>MVP:</strong> 1964</p>
                  <p className="mb-0"><strong>Ring:</strong> 1971 (MIL)</p>
                </Card.Body>
              </Card>

              <Card className="sidebar-card">
                <Card.Header>
                  <h6>Related Articles</h6>
                </Card.Header>
                <Card.Body>
                  {relatedArticles.map((article) => (
                    <Link key={article.id} to={article.route} className="d-block mb-2">
                      {article.title}
                    </Link>
                  ))}
                  <Link to="/tdwatch" className="d-block">TD Watch - Live Tracker</Link>
                </Card.Body>
              </Card>
            </div>
          </Col>
        </Row>
      </Container>
    </div>
  );
};

export default JokicPassesOscar;
