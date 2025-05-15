import React, { useState, useEffect } from 'react';

const TIME_RANGES = [
  { label: 'Today', value: 1 },
  { label: 'Week', value: 7 },
  { label: 'Month', value: 30 },
  { label: 'Year', value: 365 }
];

const Leaderboard = () => {
  const [timeRange, setTimeRange] = useState(30);
  const [leaderboardData, setLeaderboardData] = useState({
    giverScores: [],
    receiverScores: []
  });

  useEffect(() => {
    // This is where we'll fetch data from the backend
    const fetchData = async () => {
      try {
        // For now, using mock data
        const mockData = {
          giverScores: [
            { userID: "User1", score: 15 },
            { userID: "User2", score: 12 },
            { userID: "User3", score: 10 }
          ],
          receiverScores: [
            { userID: "User4", score: 18 },
            { userID: "User5", score: 14 },
            { userID: "User6", score: 11 }
          ]
        };
        setLeaderboardData(mockData);
      } catch (error) {
        console.error('Error fetching leaderboard data:', error);
      }
    };

    fetchData();
  }, [timeRange]);

  return (
    <div className="leaderboard">
      <h1>Fistbump Leaderboard</h1>
      
      {/* Time Range Selector */}
      <div className="time-range-selector">
        {TIME_RANGES.map(range => (
          <button
            key={range.value}
            onClick={() => setTimeRange(range.value)}
            className={`time-button ${timeRange === range.value ? 'active' : ''}`}
          >
            {range.label}
          </button>
        ))}
      </div>

      {/* Top Givers */}
      <div className="leaderboard-section">
        <h2>Top Givers</h2>
        <div className="leaderboard-list">
          {leaderboardData.giverScores.map((giver, index) => (
            <div key={giver.userID} className="leaderboard-item">
              <div className="rank">{index + 1}</div>
              <div className="user-info">
                <span className="user-id">{giver.userID}</span>
                <div className="score-bar" style={{ width: `${(giver.score / 20) * 100}%` }}>
                  <span className="score">{giver.score}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Top Receivers */}
      <div className="leaderboard-section">
        <h2>Top Receivers</h2>
        <div className="leaderboard-list">
          {leaderboardData.receiverScores.map((receiver, index) => (
            <div key={receiver.userID} className="leaderboard-item">
              <div className="rank">{index + 1}</div>
              <div className="user-info">
                <span className="user-id">{receiver.userID}</span>
                <div className="score-bar" style={{ width: `${(receiver.score / 20) * 100}%` }}>
                  <span className="score">{receiver.score}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Leaderboard;
