import React, { useState } from 'react';
import './TopBar.css';
import ariacall_logo from './ariacall_logo.png';

function NavLinks({ navOpen }) {
  return (
    <div className={`nav-links ${navOpen ? 'open' : ''}`} id="navLinks">
      <a href="https://ariacall.pl" target="_blank" rel="noopener noreferrer">
        About project
      </a>
      <a
        href="https://github.com/u6h6r/aria-call"
        target="_blank"
        rel="noopener noreferrer"
      >
        Github
      </a>
    </div>
  );
}

function TopBar() {
  const [navOpen, setNavOpen] = useState(false);

  const toggleNavLinks = () => setNavOpen((prev) => !prev);

  return (
    <div className="top-bar">
      <div className="logo">
        <img src={ariacall_logo} alt="Logo" />
      </div>
      <NavLinks navOpen={navOpen} />
      <a href="https://calendly.com/ariacall/30min" className="demo-button">
        Schedule a demo
      </a>
      <div className="hamburger-menu" onClick={toggleNavLinks}>
        <span></span>
        <span></span>
        <span></span>
      </div>
    </div>
  );
}

export default TopBar;
