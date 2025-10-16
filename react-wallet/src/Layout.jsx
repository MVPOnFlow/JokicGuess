import { useEffect, useState } from 'react';
import { Outlet, NavLink } from "react-router-dom";
import * as fcl from "@onflow/fcl";
import 'bootstrap/dist/css/bootstrap.min.css';
import 'bootstrap-icons/font/bootstrap-icons.css';
import './App.css';

import "./flow/config";
import { Navbar, Nav, Container, Dropdown } from 'react-bootstrap';

export default function Layout() {
  const [user, setUser] = useState({ loggedIn: null });

  useEffect(() => {
    fcl.currentUser().subscribe(setUser);
  }, []);

  const handleConnect = () => {
    fcl.authenticate();
  };

  const handleDisconnect = () => {
    fcl.unauthenticate();
  };

  return (
    <>
      {/* Navbar */}
      <Navbar expand="lg" className="navbar mb-3">
        <Container fluid>
          <Navbar.Brand as={NavLink} to="/" className="d-flex align-items-center">
            <img
              src="/favicon2.png"
              alt="Flow Jukebox Logo"
              height="40"
              className="me-2"
            />
            <span className="brand-text">Flow Jukebox</span>
          </Navbar.Brand>


          {/* Burger toggle with gold color */}
          <Navbar.Toggle
            aria-controls="navbarNav"
            style={{
              borderColor: '#FDB927',
              color: '#FDB927'
            }}
          >
            <span
              className="navbar-toggler-icon"
              style={{ filter: 'invert(80%) sepia(100%) saturate(400%) hue-rotate(10deg)' }}
            />
          </Navbar.Toggle>

          <Navbar.Collapse id="navbarNav">
            <Nav className="me-auto mb-2 mb-lg-0">
              <Nav.Link as={NavLink} to="/jukebox">🎵 Jukebox</Nav.Link>
            </Nav>

            <div className="d-flex align-items-center">
              {user.loggedIn ? (
                <>
                  <span className="wallet-address me-2">{user.addr}</span>
                  <button
                    className="btn-wallet"
                    onClick={handleDisconnect}
                  >
                    Disconnect
                  </button>
                </>
              ) : (
                <button
                  className="btn-wallet"
                  onClick={handleConnect}
                >
                  Connect Wallet
                </button>
              )}
            </div>
          </Navbar.Collapse>
        </Container>
      </Navbar>

      {/* Main Content */}
      <div className="container-fluid mt-4 flex-grow-1">
        <Outlet />
      </div>

      {/* Footer */}
      <div className="footer mt-auto">
        <p>
          Copyright Flow Jukebox 2025
        </p>
        <div className="d-flex justify-content-center align-items-center gap-3 mt-2">
          <a href="https://discord.gg/" target="_blank" aria-label="Discord" rel="noreferrer">
            <i className="bi bi-discord" style={{ fontSize: '1.5rem' }}></i>
          </a>
          <a href="https://x.com/" target="_blank" aria-label="Twitter" rel="noreferrer">
            <i className="bi bi-twitter-x" style={{ fontSize: '1.5rem' }}></i>
          </a>
        </div>
      </div>
    </>
  );
}
