import React from "react";
import { Button, Card, Row, Col } from "react-bootstrap";

export default function Home() {
  return (
    <div className="home-container">
      {/* Hero Section */}
      <section className="hero mb-5">
        <h1>🎵 Flow Jukebox — Music That Lives On-Chain</h1>
        <p>
          Welcome to <strong>Flow Jukebox</strong> — where music meets the blockchain.
          Create your own jukebox NFT, let the community queue songs by paying <strong>$FLOW</strong>,
          and earn rewards as your jukebox plays!
        </p>
        <p>
          Each jukebox runs autonomously on the <strong>Flow blockchain</strong> — songs, payments,
          and rotations all happen on-chain without centralized servers.
        </p>
        <div className="mt-4 d-flex justify-content-center gap-3 flex-wrap">
          <Button variant="primary" size="lg" href="/jukebox" className="px-4 py-2">
            🎧 Create a Jukebox
          </Button>
        </div>
      </section>

      {/* How It Works */}
      <section className="mb-5">
        <h2 className="text-center text-green mb-4">How It Works</h2>
        <Row className="g-4">
          <Col md={4}>
            <Card className="jukebox-card h-100 text-center p-3">
              <Card.Body>
                <h4 className="text-green mb-3">1️⃣ Create Your Jukebox</h4>
                <p>
                  Mint a jukebox NFT with a fixed duration — 1 hour, 3 hours, 24 hours.
                  You set the stage; Flow keeps the beat going.
                </p>
              </Card.Body>
            </Card>
          </Col>
          <Col md={4}>
            <Card className="jukebox-card h-100 text-center p-3">
              <Card.Body>
                <h4 className="text-green mb-3">2️⃣ Listeners Queue Songs</h4>
                <p>
                  Anyone can pay <strong>$FLOW</strong> to queue their favorite track.
                  Songs with higher total backing play sooner — the crowd shapes the vibe.
                </p>
              </Card.Body>
            </Card>
          </Col>
          <Col md={4}>
            <Card className="jukebox-card h-100 text-center p-3">
              <Card.Body>
                <h4 className="text-green mb-3">3️⃣ Earn and Enjoy</h4>
                <p>
                  When your jukebox ends, you automatically receive <strong>80 %</strong> of all Flow collected.
                  The rest fuels the ecosystem — decentralized, transparent, unstoppable music.
                </p>
              </Card.Body>
            </Card>
          </Col>
        </Row>
      </section>

      {/* Value Props by Use Case */}
      <section className="mb-5">
        <h2 className="text-center text-green mb-4">Who Is Flow Jukebox For?</h2>
        <Row className="g-4">
          <Col md={6} lg={4}>
            <Card className="jukebox-card h-100 text-center p-3">
              <Card.Body>
                <h5 className="text-green mb-2">🍸 Bar & Venue Owners</h5>
                <p>
                  Host a jukebox night where customers pick and boost songs with $FLOW —
                  the playlist becomes a living pulse of your crowd.
                  Earn crypto as they play!
                </p>
              </Card.Body>
            </Card>
          </Col>
          <Col md={6} lg={4}>
            <Card className="jukebox-card h-100 text-center p-3">
              <Card.Body>
                <h5 className="text-green mb-2">🏠 Home Party Organizers</h5>
                <p>
                  Fire up a Flow Jukebox for birthdays, BBQs, or celebrations.
                  Let guests vote with their Flow tokens for what comes next — no more arguments about the aux cord!
                </p>
              </Card.Body>
            </Card>
          </Col>
          <Col md={6} lg={4}>
            <Card className="jukebox-card h-100 text-center p-3">
              <Card.Body>
                <h5 className="text-green mb-2">💼 Team Building & Events</h5>
                <p>
                  Spice up corporate sessions or hackathons — each participant adds songs
                  and contributes to the collective vibe. Great for team energy and fun competitions.
                </p>
              </Card.Body>
            </Card>
          </Col>
          <Col md={6} lg={4}>
            <Card className="jukebox-card h-100 text-center p-3">
              <Card.Body>
                <h5 className="text-green mb-2">🌍 Online Communities</h5>
                <p>
                  Set up a shared jukebox for your Discord or online fam.
                  Everyone tunes in together — a new era of global, token-powered listening sessions.
                </p>
              </Card.Body>
            </Card>
          </Col>
          <Col md={6} lg={4}>
            <Card className="jukebox-card h-100 text-center p-3">
              <Card.Body>
                <h5 className="text-green mb-2">🎤 Musicians & Creators</h5>
                <p>
                  Showcase your songs by hosting your own jukebox.
                  Let fans pay Flow to hear your track, turning engagement into income.
                </p>
              </Card.Body>
            </Card>
          </Col>
          <Col md={6} lg={4}>
            <Card className="jukebox-card h-100 text-center p-3">
              <Card.Body>
                <h5 className="text-green mb-2">🎧 Streaming Collectives</h5>
                <p>
                  Build a round-the-clock jukebox that never sleeps — curated by your
                  followers, funded by Flow, running forever on chain.
                </p>
              </Card.Body>
            </Card>
          </Col>
        </Row>
      </section>

      {/* Featured Section */}
      <section className="mb-5">
        <h2 className="text-center text-green mb-4">Why Flow Jukebox?</h2>
        <Row className="g-4">
          <Col md={6}>
            <Card className="jukebox-card h-100">
              <Card.Body>
                <h5 className="text-green mb-2">🌐 Fully On-Chain Experience</h5>
                <p>
                  Every song, queue, and reward runs natively on Flow — no servers, no downtime, no middlemen.
                </p>
              </Card.Body>
            </Card>
          </Col>
          <Col md={6}>
            <Card className="jukebox-card h-100">
              <Card.Body>
                <h5 className="text-green mb-2">💸 Community-Driven Economy</h5>
                <p>
                  Each song entry supports creators and jukebox owners,
                  turning fan interaction into real Flow revenue.
                </p>
              </Card.Body>
            </Card>
          </Col>
          <Col md={6}>
            <Card className="jukebox-card h-100">
              <Card.Body>
                <h5 className="text-green mb-2">🎶 Decentralized Music Moments</h5>
                <p>
                  Discover evolving community playlists — every play is an immutable moment on chain.
                </p>
              </Card.Body>
            </Card>
          </Col>
          <Col md={6}>
            <Card className="jukebox-card h-100">
              <Card.Body>
                <h5 className="text-green mb-2">🔒 Trustless Payments</h5>
                <p>
                  Flow smart contracts handle all buy-ins, boosts and payouts — instant, secure and verifiable.
                </p>
              </Card.Body>
            </Card>
          </Col>
        </Row>
      </section>

      {/* CTA */}
      <section className="text-center py-5">
        <h2 className="mb-3">Ready to Spin Your First Jukebox?</h2>
        <p className="mb-4">
          Bring your playlist to life — mint a jukebox NFT and let the world decide what plays next.
        </p>
        <Button variant="primary" size="lg" href="/jukebox">
          🚀 Start Now
        </Button>
      </section>

      {/* Footer Note */}
      <footer className="footer mt-5">
        <p>
          Built on Flow 💚 | Powered by Smart Contracts | Made for the Music Community
        </p>
      </footer>
    </div>
  );
}
