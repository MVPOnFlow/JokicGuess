import { Container, Row, Col, Card, Badge, Table } from 'react-bootstrap';
import { Link } from 'react-router-dom';
import { getRelatedArticles } from './articleData';
import './Blog.css';

function FlowSecurityIncident() {
  const relatedArticles = getRelatedArticles('flow-security-incident');

  return (
    <div className="blog-article">
      <Container className="py-5">
        <Link to="/blog" className="mb-4 d-inline-block">← Back to Blog</Link>
        
        <Row>
          <Col lg={8}>
            <div className="article-header">
              <Badge bg="primary" className="mb-3">Flow Blockchain</Badge>
              <h1 className="mb-3">Rising from Adversity: Flow's Masterclass in Crisis Response</h1>
              <p className="lead">
                When a security breach hit Flow blockchain on December 27, 2025, the team's swift action and transparent communication showcased why resilience matters more than perfection in Web3.
              </p>
              <div className="article-meta">
                <span>By $MVP Team</span> | <span>January 30, 2026</span> | <span>8 min read</span>
              </div>
            </div>

            <div className="article-content">
              <h3>The Incident: December 27, 2025</h3>
              <p>
                On December 27, 2025, Flow blockchain experienced a significant security incident that resulted in the creation of 87.4 billion counterfeit $FLOW tokens. For any blockchain ecosystem, such an event represents a critical test of infrastructure, governance, and community trust.
              </p>
              <p>
                The $MVP community, deeply invested in Flow through NBA TopShot moments and other Flow-based assets, watched closely as the situation unfolded. What could have been a catastrophic blow to the ecosystem instead became a demonstration of how a mature blockchain project handles crisis management.
              </p>

              <h3>Immediate Response: Transparency First</h3>
              <p>
                Rather than going silent or downplaying the severity, the Flow Foundation immediately communicated with their community through official channels. The team acknowledged the security breach, explained the scope of counterfeit token creation, and outlined their Network Isolated Recovery Plan.
              </p>
              <p>
                This transparency was crucial. In an industry where projects often obscure problems until forced to reveal them, Flow's upfront communication set a standard for how blockchain teams should respond to security incidents.
              </p>

              <Card className="mb-4 game-summary-card">
                <Card.Header>
                  <h5 className="mb-0">Incident Timeline</h5>
                </Card.Header>
                <Card.Body>
                  <Row className="text-center mb-3">
                    <Col md={4}>
                      <h6 style={{ color: '#94a3b8', fontSize: '0.875rem', fontWeight: '600', marginBottom: '0.5rem' }}>Incident Date</h6>
                      <h4 style={{ color: '#FDB927', fontWeight: 'bold' }}>Dec 27, 2025</h4>
                      <p style={{ color: '#94a3b8', fontSize: '0.875rem', marginBottom: 0 }}>Security breach detected</p>
                    </Col>
                    <Col md={4}>
                      <h6 style={{ color: '#94a3b8', fontSize: '0.875rem', fontWeight: '600', marginBottom: '0.5rem' }}>Counterfeit Tokens</h6>
                      <h4 style={{ color: '#FDB927', fontWeight: 'bold' }}>87.4B</h4>
                      <p style={{ color: '#94a3b8', fontSize: '0.875rem', marginBottom: 0 }}>$FLOW tokens created</p>
                    </Col>
                    <Col md={4}>
                      <h6 style={{ color: '#94a3b8', fontSize: '0.875rem', fontWeight: '600', marginBottom: '0.5rem' }}>Resolution Date</h6>
                      <h4 style={{ color: '#FDB927', fontWeight: 'bold' }}>Jan 30, 2026</h4>
                      <p style={{ color: '#94a3b8', fontSize: '0.875rem', marginBottom: 0 }}>Tokens permanently burned</p>
                    </Col>
                  </Row>
                  <hr style={{ borderColor: '#334155' }} />
                  <p className="mb-0" style={{ color: '#E5E7EB' }}>
                    <strong style={{ color: '#FDB927' }}>Key Achievement:</strong> Flow Foundation confirmed that at no point during the security incident did counterfeit tokens enter circulation or affect legitimate user holdings.
                  </p>
                </Card.Body>
              </Card>

              <h3>The Technical Solution: Network Isolated Recovery</h3>
              <p>
                Flow's response involved implementing a Network Isolated Recovery Plan: a sophisticated approach that allowed the team to reclaim and secure the counterfeit tokens before they could impact the broader ecosystem. The technical execution demonstrated the robustness of Flow's architecture and the team's deep understanding of their own infrastructure.
              </p>
              <p>
                By isolating the compromised tokens and preventing them from entering circulation, Flow protected both retail holders and institutional partners. This was particularly critical for NFT marketplaces like NBA TopShot, where price stability and trust are paramount.
              </p>

              <h3>The Burn: January 30, 2026</h3>
              <p>
                On January 30, 2026, at 11am PT, Flow Foundation permanently destroyed all 87.4 billion counterfeit tokens in a public burn event. This wasn't just a technical necessity; it was a symbolic gesture of accountability and closure.
              </p>
              <p>
                The burn confirmed what the team had communicated throughout: the counterfeit tokens were contained, secured, and now permanently removed from existence. The transparency of making this a public event, announced in advance, reinforced the trust that Flow had maintained with its community throughout the crisis.
              </p>

              <Row className="mb-4">
                <Col md={6} className="mb-3">
                  <div className="stat-box">
                    <h2>34 Days</h2>
                    <p className="text-muted mb-0">From incident to resolution</p>
                  </div>
                </Col>
                <Col md={6} className="mb-3">
                  <div className="stat-box">
                    <h2>100%</h2>
                    <p className="text-muted mb-0">Counterfeit tokens destroyed</p>
                  </div>
                </Col>
              </Row>

              <h3>Why This Matters to the $MVP Community</h3>
              <p>
                For the $MVP community, Flow's resilience directly impacts our ecosystem. Our Swapfest events, NBA TopShot integrations, and token mechanics all rely on Flow's stability and security. When Flow succeeds in protecting its network, our community benefits.
              </p>
              <p>
                More importantly, Flow's response provides a blueprint for how our own community should handle challenges: with transparency, swift action, and clear communication. These values align perfectly with the $MVP community's commitment to building a sustainable, trustworthy platform for basketball fans and collectors.
              </p>

              <h3>Lessons in Crisis Management</h3>
              <p>
                Flow's handling of this security incident offers several key lessons for the broader Web3 space:
              </p>
              <ul>
                <li><strong>Transparency over opacity:</strong> Immediate disclosure builds trust, even when the news is bad</li>
                <li><strong>Technical competence matters:</strong> Having robust recovery mechanisms prevented a worst-case scenario</li>
                <li><strong>Communication is continuous:</strong> Regular updates kept the community informed throughout the 34-day remediation</li>
                <li><strong>Accountability through action:</strong> The public token burn demonstrated follow-through on commitments</li>
                <li><strong>User protection first:</strong> Ensuring legitimate holders weren't affected was the top priority</li>
              </ul>

              <h3>Looking Forward: Stronger Than Before</h3>
              <p>
                Security incidents are inevitable in cutting-edge technology. What separates successful projects from failed ones isn't perfection; it's resilience. Flow demonstrated that they have the technical infrastructure, governance processes, and community trust to weather serious challenges.
              </p>
              <p>
                As Flow continues to power consumer-facing DeFi applications and NFT platforms, this incident will likely be remembered not as a failure, but as a moment when the ecosystem proved its maturity. The lessons learned will strengthen security measures and prepare the network for future challenges.
              </p>

              <Card className="mb-4 stats-card">
                <Card.Header>
                  <h5 className="mb-0">Flow's Recovery Metrics</h5>
                </Card.Header>
                <Card.Body>
                  <Table bordered className="mb-0" style={{ backgroundColor: 'transparent' }}>
                    <thead>
                      <tr>
                        <th style={{ backgroundColor: '#0f172a', color: '#FDB927', fontWeight: '600', borderColor: '#334155', padding: '0.75rem' }}>Metric</th>
                        <th style={{ backgroundColor: '#0f172a', color: '#FDB927', fontWeight: '600', borderColor: '#334155', padding: '0.75rem' }}>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td style={{ color: '#E5E7EB', fontWeight: '500', borderColor: '#334155', backgroundColor: '#1e293b', padding: '0.75rem' }}>Counterfeit Tokens Destroyed</td>
                        <td style={{ borderColor: '#334155', backgroundColor: '#1e293b', padding: '0.75rem' }}><Badge bg="success">100% Complete</Badge></td>
                      </tr>
                      <tr>
                        <td style={{ color: '#E5E7EB', fontWeight: '500', borderColor: '#334155', backgroundColor: '#1e293b', padding: '0.75rem' }}>User Holdings Protected</td>
                        <td style={{ borderColor: '#334155', backgroundColor: '#1e293b', padding: '0.75rem' }}><Badge bg="success">No Impact</Badge></td>
                      </tr>
                      <tr>
                        <td style={{ color: '#E5E7EB', fontWeight: '500', borderColor: '#334155', backgroundColor: '#1e293b', padding: '0.75rem' }}>Network Operations</td>
                        <td style={{ borderColor: '#334155', backgroundColor: '#1e293b', padding: '0.75rem' }}><Badge bg="success">Fully Operational</Badge></td>
                      </tr>
                      <tr>
                        <td style={{ color: '#E5E7EB', fontWeight: '500', borderColor: '#334155', backgroundColor: '#1e293b', padding: '0.75rem' }}>NFT Marketplaces</td>
                        <td style={{ borderColor: '#334155', backgroundColor: '#1e293b', padding: '0.75rem' }}><Badge bg="success">Unaffected</Badge></td>
                      </tr>
                      <tr>
                        <td style={{ color: '#E5E7EB', fontWeight: '500', borderColor: '#334155', backgroundColor: '#1e293b', padding: '0.75rem' }}>Community Trust</td>
                        <td style={{ borderColor: '#334155', backgroundColor: '#1e293b', padding: '0.75rem' }}><Badge bg="success">Maintained</Badge></td>
                      </tr>
                    </tbody>
                  </Table>
                </Card.Body>
              </Card>

              <h3>A Testament to Web3 Maturity</h3>
              <p>
                The December 2025 security incident could have derailed Flow's momentum as a leading consumer blockchain. Instead, it became a case study in crisis management, technical excellence, and community-first values.
              </p>
              <p>
                For the $MVP community and all Flow ecosystem participants, this incident reinforces why we chose to build on Flow. The network's proven ability to handle adversity, protect users, and emerge stronger makes it the ideal home for our basketball-focused Web3 experiences.
              </p>

              <div className="mt-5 p-4 rounded" style={{
                background: '#1e293b',
                border: '1px solid #334155'
              }}>
                <h4 style={{ color: '#FDB927' }}>Join the $MVP Community</h4>
                <p className="mb-0" style={{ color: '#E5E7EB' }}>
                  Experience Flow blockchain through $MVP Swapfest events, trade NBA TopShot moments, and connect with fellow basketball fans in our Discord community. Together, we're building the future of sports collectibles on a blockchain that's proven its resilience.
                </p>
              </div>
            </div>
          </Col>

          <Col lg={4}>
            <div className="sticky-sidebar">
              <Card className="mb-4 sidebar-card">
                <Card.Header>
                  <h6>Key Details</h6>
                </Card.Header>
                <Card.Body>
                  <p><strong>Incident Date:</strong> December 27, 2025</p>
                  <p><strong>Resolution:</strong> January 30, 2026</p>
                  <p><strong>Tokens Burned:</strong> 87.4 billion</p>
                  <p><strong>User Impact:</strong> None</p>
                  <p className="mb-0"><strong>Network Status:</strong> Fully Operational</p>
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

              <Card className="sidebar-card mt-4">
                <Card.Header>
                  <h6>External Resources</h6>
                </Card.Header>
                <Card.Body>
                  <a href="https://x.com/flow_blockchain" target="_blank" rel="noopener noreferrer">
                    Flow Official Updates (X/Twitter)
                  </a>
                </Card.Body>
              </Card>
            </div>
          </Col>
        </Row>
      </Container>
    </div>
  );
}

export default FlowSecurityIncident;
