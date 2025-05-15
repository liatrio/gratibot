import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import FistbumpChart from './components/FistbumpChart';
import FistbumpWrapped from './components/FistbumpWrapped';
import FistbumpGrowth from './components/FistbumpGrowth';
import Navigation from './components/Navigation';
import './App.css';

function App() {
  return (
    <BrowserRouter>
      <div className="app">
        <header className="app-header">
          <div className="header-content">
            <h1>Gratibot Fistbump Tracker</h1>
            <p className="header-subtitle">Track and celebrate team recognition</p>
          </div>
        </header>
        <main className="app-main">
          <div className="content-wrapper">
            <Navigation />
            <div className="page-content">
              <Routes>
                <Route path="/" element={
                  <div className="visualization-container">
                    <FistbumpChart />
                  </div>
                } />
                <Route path="/wrapped" element={
                  <div className="visualization-container">
                    <FistbumpWrapped />
                  </div>
                } />
                <Route path="/growth" element={
                  <div className="visualization-container">
                    <FistbumpGrowth />
                  </div>
                } />
              </Routes>
            </div>
          </div>
        </main>
        <footer className="app-footer">
          <p>Powered by Gratibot</p>
        </footer>
      </div>
    </BrowserRouter>
  );
}

export default App;
