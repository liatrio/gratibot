import React, { useState, useEffect } from 'react';
import './FistbumpWrapped.css';

const FistbumpWrapped = () => {
  const [selectedUser, setSelectedUser] = useState('dawn');
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
    // Fetch stats for Dawn immediately
    fetchUserStats('dawn').then(data => {
      setStats(data);
      setLoading(false);
    });
  }, []);

  const fetchUserStats = async (userId) => {
    // TODO: Replace with actual API call
    return {
      totalFistbumps: 245,
      monthlyBreakdown: [
        { month: 'January', count: 15, topGiver: 'Dawn', tags: ['teamwork', 'innovation'] },
        { month: 'February', count: 22, topGiver: 'Leo', tags: ['leadership', 'collaboration'] },
        { month: 'March', count: 18, topGiver: 'Patrick', tags: ['problem-solving', 'mentoring'] },
        { month: 'April', count: 25, topGiver: 'Calvin', tags: ['excellence', 'support'] },
        { month: 'May', count: 28, topGiver: 'Dawn', tags: ['innovation', 'dedication'] },
        { month: 'June', count: 32, topGiver: 'Leo', tags: ['teamwork', 'leadership'] },
        { month: 'July', count: 24, topGiver: 'Patrick', tags: ['collaboration', 'mentoring'] },
        { month: 'August', count: 30, topGiver: 'Calvin', tags: ['excellence', 'innovation'] },
        { month: 'September', count: 35, topGiver: 'Dawn', tags: ['teamwork', 'support'] },
        { month: 'October', count: 29, topGiver: 'Leo', tags: ['leadership', 'dedication'] },
        { month: 'November', count: 33, topGiver: 'Patrick', tags: ['problem-solving', 'collaboration'] },
        { month: 'December', count: 38, topGiver: 'Calvin', tags: ['excellence', 'mentoring'] }
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
                <div className="monthly-chart">
                  <div className="bar-container">
                    <div 
                      className="bar" 
                      style={{ height: `${(stats.monthlyBreakdown.reduce((max, stat) => Math.max(max, stat.count), 0) / 50) * 100}%` }}
                    >
                      <span className="bar-value">{stats.monthlyBreakdown.reduce((sum, stat) => sum + stat.count, 0)}</span>
                    </div>
                  </div>
                  <div className="bar-label">Total Monthly Fistbumps</div>
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
