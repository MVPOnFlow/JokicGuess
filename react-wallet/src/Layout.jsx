import { useEffect, useState } from 'react';
import { Outlet, NavLink } from "react-router-dom";
import * as fcl from "@onflow/fcl";
import 'bootstrap/dist/css/bootstrap.min.css';
import 'bootstrap-icons/font/bootstrap-icons.css';
import './App.css';

// The FCL config import ensures your Flow settings load
import "./flow/config";
import { Navbar, Nav, Container } from 'react-bootstrap';

export default function Layout() {
  const [user, setUser] = useState({ loggedIn: null });

  // Subscribe to Flow user state
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
      <nav className="navbar navbar-expand-lg">
        <div className="container-fluid">
          <NavLink className="navbar-brand d-flex align-items-center" to="/">
            <img src="/favicon.png" alt="MVP on Flow Logo" height="40" className="me-2" />
          </NavLink>
          <button
            className="navbar-toggler"
            type="button"
            data-bs-toggle="collapse"
            data-bs-target="#navbarNav"
          >
            <span className="navbar-toggler-icon"></span>
          </button>
          <div className="collapse navbar-collapse" id="navbarNav">
            <ul className="navbar-nav me-auto mb-2 mb-lg-0">
              <li className="nav-item">
                <NavLink className="nav-link" to="/">Home</NavLink>
              </li>
              <li className="nav-item">
                <NavLink className="nav-link" to="/swapfest">Swapfest</NavLink>
              </li>
              <li className="nav-item">
                <NavLink className="nav-link" to="/treasury">Treasury</NavLink>
              </li>
              <li className="nav-item">
                <NavLink className="nav-link" to="/vote">Vote</NavLink>
              </li>
              <li className="nav-item">
                <NavLink className="nav-link" to="/fastbreak">Fastbreak</NavLink>
              </li>
            </ul>
            <div className="d-flex align-items-center">
              {user.loggedIn ? (
                <>
                  <span className="wallet-address me-2">
                    {user.addr}
                  </span>
                  <button
                    className="btn btn-outline-light btn-sm"
                    onClick={handleDisconnect}
                  >
                    Disconnect
                  </button>
                </>
              ) : (
                <button
                  className="btn btn-light btn-sm"
                  onClick={handleConnect}
                >
                  Connect Wallet
                </button>
              )}
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <div className="container-fluid mt-4 flex-grow-1">
        <Outlet />
      </div>

      {/* Footer */}
      <div className="footer mt-auto">
        <p>
          This is a fan project and is not affiliated with NBA TopShot, Nikola Jokić, or any official organization.
        </p>
        <div className="d-flex justify-content-center align-items-center gap-3 mt-2">
          <a href="https://discord.gg/3p3ff9PHqW" target="_blank" aria-label="Discord">
            <i className="bi bi-discord" style={{ fontSize: '1.5rem' }}></i>
          </a>
          <a href="https://x.com/petjokicshorses" target="_blank" aria-label="Twitter">
            <i className="bi bi-twitter-x" style={{ fontSize: '1.5rem' }}></i>
          </a>
        </div>
      </div>
    </>
  );
}
