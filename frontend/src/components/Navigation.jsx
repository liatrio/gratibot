import React from 'react';
import { NavLink } from 'react-router-dom';
import './Navigation.css';

const Navigation = () => {
  return (
    <nav className="main-nav">
      <div className="nav-links">
        <NavLink 
          to="/" 
          className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}
          end
        >
          Team Overview
        </NavLink>
        <NavLink 
          to="/wrapped" 
          className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}
        >
          Fistbump Wrapped
        </NavLink>
        <NavLink 
          to="/growth" 
          className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}
        >
          Growth Analysis
        </NavLink>
      </div>
    </nav>
  );
};

export default Navigation;
