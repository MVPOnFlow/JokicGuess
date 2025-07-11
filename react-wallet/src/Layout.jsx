import { Outlet, NavLink } from "react-router-dom";
import 'bootstrap/dist/css/bootstrap.min.css';
import 'bootstrap-icons/font/bootstrap-icons.css';
import './App.css'; // This is your custom CSS

export default function Layout() {
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
            <ul className="navbar-nav me-auto">
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
                <NavLink className="nav-link" to="/vote">$MVP Vote</NavLink>
              </li>
            </ul>
          </div>
        </div>
      </nav>

      {/* Main content */}
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
