import { Container, Row, Col, Card, Button, Badge } from 'react-bootstrap';
import { Link } from 'react-router-dom';
import { articles, getCategoryColor, getFeaturedArticle } from './articleData';
import './Blog.css';

function BlogList() {
  const featuredArticle = getFeaturedArticle();
  const otherArticles = articles.filter(a => !a.featured);

  return (
    <Container className="blog-container py-5">
      {/* Hero Section */}
      <div className="blog-hero text-center mb-5">
        <h1 className="display-4 fw-bold mb-3">Jokic Game Analysis Blog</h1>
        <p className="lead text-muted mb-4">
          Deep-dive breakdowns, game analysis, and statistical insights into Nikola Jokic's performances throughout the 2025-26 season.
        </p>
        <div className="hero-divider"></div>
      </div>

      {/* Featured Article */}
      {featuredArticle && (
        <Row className="mb-5">
          <Col lg={12}>
            <Card className="featured-article shadow-lg border-0 overflow-hidden">
              <Row className="g-0">
                <Col lg={6} className="featured-image">
                  <div className="placeholder-image" style={{ height: '400px', background: 'linear-gradient(135deg, #2c5282 0%, #1a365d 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <span className="text-white text-center px-4">
                      <h5>Featured Article</h5>
                      <p className="mb-0">{featuredArticle.category}</p>
                    </span>
                  </div>
                </Col>
                <Col lg={6} className="d-flex flex-column justify-content-center p-5">
                  <Badge bg={getCategoryColor(featuredArticle.category)} className="mb-3" style={{ width: 'fit-content' }}>
                    {featuredArticle.category}
                  </Badge>
                  <h2 className="mb-3">{featuredArticle.title}</h2>
                  <p className="text-muted mb-3">
                    <small>
                      By <strong>{featuredArticle.author}</strong> • {new Date(featuredArticle.date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
                    </small>
                  </p>
                  <p className="mb-4">{featuredArticle.excerpt}</p>
                  <Link to={`/blog/${featuredArticle.id}`}>
                    <Button variant="primary" size="lg">
                      Read Full Analysis →
                    </Button>
                  </Link>
                </Col>
              </Row>
            </Card>
          </Col>
        </Row>
      )}

      {/* All Articles Grid */}
      <Row className="mb-4">
        <Col>
          <h3 className="mb-4">Latest Articles</h3>
        </Col>
      </Row>
      <Row>
        {otherArticles.map((article) => (
          <Col md={6} lg={4} className="mb-4" key={article.id}>
            <Card className="article-card h-100 shadow-sm border-0 hover-lift">
              <div className="card-image-wrapper" style={{ height: '220px', background: 'linear-gradient(135deg, #2c5282 0%, #1a365d 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <span className="text-white text-center px-3">
                  <p className="mb-0">{article.category}</p>
                </span>
              </div>
              <Card.Body className="d-flex flex-column">
                <Badge bg={getCategoryColor(article.category)} className="mb-2" style={{ width: 'fit-content' }}>
                  {article.category}
                </Badge>
                <Card.Title className="mb-2">{article.title}</Card.Title>
                <Card.Text className="text-muted small mb-3">
                  <small>
                    {new Date(article.date).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}
                  </small>
                </Card.Text>
                <Card.Text className="mb-4 flex-grow-1">{article.excerpt}</Card.Text>
                <Link to={`/blog/${article.id}`} className="mt-auto">
                  <Button variant="outline-primary" size="sm" className="w-100">
                    Read More
                  </Button>
                </Link>
              </Card.Body>
            </Card>
          </Col>
        ))}
      </Row>

      {/* Newsletter Signup */}
      <Row className="mt-5 mb-4">
        <Col lg={8} className="mx-auto">
          <Card className="newsletter-card shadow-sm border-0">
            <Card.Body className="p-5 text-center text-white">
              <h4 className="mb-3">Stay Updated on Jokic's Journey</h4>
              <p className="mb-4">Get notified when new game analysis articles are published.</p>
              <div className="d-flex gap-2">
                <input 
                  type="email" 
                  placeholder="Enter your email" 
                  className="form-control" 
                  style={{ borderRadius: '5px' }}
                />
                <Button variant="light" className="px-4">Subscribe</Button>
              </div>
            </Card.Body>
          </Card>
        </Col>
      </Row>
    </Container>
  );
}

export default BlogList;
