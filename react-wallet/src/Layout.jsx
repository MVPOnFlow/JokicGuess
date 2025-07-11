import { Outlet, NavLink } from "react-router-dom";
import { Navbar, Nav, Container } from 'react-bootstrap';
import 'bootstrap/dist/css/bootstrap.min.css';
import 'bootstrap-icons/font/bootstrap-icons.css';
import './App.css'; // Your custom styles

export default function Layout() {
  return (
    <>
      {/* Navbar */}
      <Navbar expand="lg" className="navbar navbar-dark">
        <Container fluid>
          <Navbar.Brand as={NavLink} to="/" className="d-flex align-items-center">
            <img
              src="/favicon.png"
              alt="MVP on Flow Logo"
              height="40"
              className="me-2"
              style={{
                maxWidth: "100px",
                objectFit: "contain",
                borderRadius: "50%",
                boxShadow: "0 2px 5px rgba(0,0,0,0.3)",
                backgroundColor: "#fff",
                padding: "2px"
              }}
            />
            MVP on Flow
          </Navbar.Brand>

          <Navbar.Toggle aria-controls="basic-navbar-nav" />
          <Navbar.Collapse id="basic-navbar-nav">
            <Nav className="me-auto">
              <Nav.Link as={NavLink} to="/">Home</Nav.Link>
              <Nav.Link as={NavLink} to="/swapfest">Swapfest</Nav.Link>
              <Nav.Link as={NavLink} to="/treasury">Treasury</Nav.Link>
              <Nav.Link as={NavLink} to="/vote">Vote</Nav.Link>
            </Nav>
            <div className="d-flex align-items-center">
              {/* Replace these with your wallet Connect/Disconnect Buttons */}
              <button className="btn btn-light btn-sm me-2">Connect Wallet</button>
              <button className="btn btn-outline-light btn-sm me-2">Disconnect</button>
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
