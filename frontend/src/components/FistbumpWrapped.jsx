import React, { useState, useEffect } from 'react';
import './FistbumpWrapped.css';

const FistbumpWrapped = () => {
  const [selectedUser, setSelectedUser] = useState('');
  const [users, setUsers] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [currentSlide, setCurrentSlide] = useState(0);

  useEffect(() => {
    // Mock user list - replace with actual API call
    setUsers([
      { id: 'dawn', name: 'Dawn' },
      { id: 'leo', name: 'Leo' },
      { id: 'patrick', name: 'Patrick' },
      { id: 'calvin', name: 'Calvin' }
    ]);
    setLoading(false);
  }, []);

  const fetchUserStats = async (userId) => {
    // TODO: Replace with actual API call
    return {
      totalFistbumps: 245,
      monthlyStats: [
        { month: 'January', count: 15 },
        { month: 'February', count: 22 },
        { month: 'March', count: 45 },
        { month: 'April', count: 30 },
        { month: 'May', count: 28 }
      ],
      topGivers: [
        { name: 'Dawn', count: 20 },
        { name: 'Leo', count: 15 },
        { name: 'Patrick', count: 12 },
        { name: 'Calvin', count: 10 }
      ],
      percentileRank: 92
    };
  };

  useEffect(() => {
    if (selectedUser) {
      setLoading(true);
      fetchUserStats(selectedUser).then(data => {
        setStats(data);
        setLoading(false);
      });
    }
  }, [selectedUser]);

  const nextSlide = () => {
    setCurrentSlide((prev) => (prev + 1) % 4);
  };

  const prevSlide = () => {
    setCurrentSlide((prev) => (prev - 1 + 4) % 4);
  };

  return (
    <div className="fistbump-wrapped">
      <div className="wrapped-header">
        <h2>Fistbump Wrapped 2025</h2>
        <select
          value={selectedUser}
          onChange={(e) => setSelectedUser(e.target.value)}
          className="user-select"
        >
          <option value="">Select a team member</option>
          {users.map(user => (
            <option key={user.id} value={user.id}>{user.name}</option>
          ))}
        </select>
      </div>

      {loading ? (
        <div className="wrapped-loading">Loading your year in fistbumps...</div>
      ) : stats ? (
        <div className="wrapped-content">
          <button className="nav-button prev" onClick={prevSlide}>←</button>
          
          <div className="slides-container">
            {currentSlide === 0 && (
              <div className="wrapped-slide active">
                <h3>Total Fistbumps</h3>
                <div className="stat-number">{stats.totalFistbumps}</div>
                <div className="stat-label">fistbumps received in 2025</div>
              </div>
            )}

            {currentSlide === 1 && (
              <div className="wrapped-slide active">
                <h3>Monthly Breakdown</h3>
                <div className="monthly-stats">
                  {stats.monthlyStats.map((stat, index) => (
                    <div key={index} className="month-stat">
                      <div className="month-name">{stat.month}</div>
                      <div className="month-count">{stat.count}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {currentSlide === 2 && (
              <div className="wrapped-slide active">
                <h3>Top Givers</h3>
                <div className="top-givers">
                  {stats.topGivers.map((giver, index) => (
                    <div key={index} className="giver">
                      <div className="giver-name">{giver.name}</div>
                      <div className="giver-count">{giver.count} fistbumps</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {currentSlide === 3 && (
              <div className="wrapped-slide active">
                <h3>Your Ranking</h3>
                <div className="percentile">
                  <div className="percentile-text">
                    You're in the top {stats.percentileRank}% of fistbump receivers!
                  </div>
                </div>
              </div>
            )}
          </div>

          <button className="nav-button next" onClick={nextSlide}>→</button>

          <div className="slide-dots">
            {[0, 1, 2, 3].map((index) => (
              <span
                key={index}
                className={`dot ${index === currentSlide ? 'active' : ''}`}
                onClick={() => setCurrentSlide(index)}
              />
            ))}
          </div>
        </div>
      ) : (
        <div className="wrapped-empty">
          Select a team member to view their Fistbump Wrapped
        </div>
      )}
    </div>
  );
};

export default FistbumpWrapped;
