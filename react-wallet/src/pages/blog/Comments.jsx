import { useState, useEffect } from 'react';
import { Card, Form, Button, Alert } from 'react-bootstrap';

function Comments({ articleId }) {
  const [comments, setComments] = useState([]);
  const [authorName, setAuthorName] = useState('');
  const [commentText, setCommentText] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    fetchComments();
  }, [articleId]);

  const fetchComments = async () => {
    try {
      const response = await fetch(`/api/blog/comments/${articleId}`);
      if (response.ok) {
        const data = await response.json();
        setComments(data);
      }
    } catch (err) {
      console.error('Error fetching comments:', err);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess(false);
    setLoading(true);

    if (!commentText.trim()) {
      setError('Please enter a comment');
      setLoading(false);
      return;
    }

    try {
      const response = await fetch('/api/blog/comments', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          article_id: articleId,
          author_name: authorName.trim() || 'Anonymous',
          comment_text: commentText.trim(),
          parent_id: null
        }),
      });

      if (response.ok) {
        setSuccess(true);
        setCommentText('');
        fetchComments();
      } else {
        const data = await response.json();
        setError(data.error || 'Failed to post comment');
      }
    } catch (err) {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const formatTimestamp = (timestamp) => {
    const date = new Date(timestamp * 1000);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <Card className="mt-5 sidebar-card">
      <Card.Header>
        <h5 className="mb-0" style={{ color: '#FDB927' }}>Discussion ({comments.length})</h5>
      </Card.Header>
      <Card.Body>
        {/* Comment Form */}
        <Form onSubmit={handleSubmit} className="mb-4">
          <Form.Group className="mb-3">
            <Form.Label style={{ color: '#E5E7EB' }}>Name (optional)</Form.Label>
            <Form.Control
              type="text"
              placeholder="Your name"
              value={authorName}
              onChange={(e) => setAuthorName(e.target.value)}
              maxLength={50}
              style={{
                backgroundColor: '#0f172a',
                border: '1px solid #334155',
                color: '#E5E7EB'
              }}
            />
          </Form.Group>
          <Form.Group className="mb-3">
            <Form.Label style={{ color: '#E5E7EB' }}>Comment</Form.Label>
            <Form.Control
              as="textarea"
              rows={3}
              placeholder="Share your thoughts..."
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              maxLength={2000}
              required
              style={{
                backgroundColor: '#0f172a',
                border: '1px solid #334155',
                color: '#E5E7EB'
              }}
            />
            <Form.Text style={{ color: '#94a3b8' }}>
              {commentText.length}/2000 characters
            </Form.Text>
          </Form.Group>
          {error && <Alert variant="danger">{error}</Alert>}
          {success && <Alert variant="success">Comment posted successfully!</Alert>}
          <Button 
            type="submit" 
            disabled={loading}
            style={{
              backgroundColor: '#FDB927',
              border: 'none',
              color: '#0E2240',
              fontWeight: 'bold'
            }}
          >
            {loading ? 'Posting...' : 'Post Comment'}
          </Button>
        </Form>

        {/* Comments List */}
        <div>
          {comments.length === 0 ? (
            <p style={{ color: '#94a3b8', textAlign: 'center', padding: '2rem 0' }}>
              No comments yet. Be the first to share your thoughts!
            </p>
          ) : (
            comments.map((comment) => (
              <div 
                key={comment.id} 
                style={{
                  backgroundColor: '#0f172a',
                  padding: '1rem',
                  marginBottom: '1rem',
                  borderRadius: '8px',
                  border: '1px solid #334155'
                }}
              >
                <div style={{ 
                  display: 'flex', 
                  justifyContent: 'space-between',
                  marginBottom: '0.5rem'
                }}>
                  <strong style={{ color: '#FDB927' }}>{comment.author_name}</strong>
                  <span style={{ color: '#94a3b8', fontSize: '0.875rem' }}>
                    {formatTimestamp(comment.timestamp)}
                  </span>
                </div>
                <p style={{ color: '#E5E7EB', margin: 0, whiteSpace: 'pre-wrap' }}>
                  {comment.comment_text}
                </p>
              </div>
            ))
          )}
        </div>
      </Card.Body>
    </Card>
  );
}

export default Comments;
