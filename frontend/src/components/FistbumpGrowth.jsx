import React, { useState, useEffect } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts';
import './FistbumpGrowth.css';

const FistbumpGrowth = () => {
  const [fromDate, setFromDate] = useState('');
  const [selectedUser, setSelectedUser] = useState('');
  const [users, setUsers] = useState([]);
  const [growthData, setGrowthData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [showChart, setShowChart] = useState(false);
  const [animationProgress, setAnimationProgress] = useState(0);

  // Mock data - replace with actual API call
  const fetchUsers = async () => {
    // TODO: Replace with actual API call
    return [
      { id: 'dawn', name: 'Dawn' },
      { id: 'leo', name: 'Leo' },
      { id: 'patrick', name: 'Patrick' },
      { id: 'calvin', name: 'Calvin' }
    ];
  };

  // Mock data - replace with actual API call
  const fetchGrowthData = async (userId, fromDate) => {
    // TODO: Replace with actual API call
    const months = [];
    let currentDate = new Date(fromDate);
    const today = new Date();
    
    while (currentDate <= today) {
      months.push({
        month: currentDate.toLocaleString('default', { month: 'short', year: 'numeric' }),
        fistbumps: Math.floor(Math.random() * 50)
      });
      currentDate.setMonth(currentDate.getMonth() + 1);
    }
    
    return months;
  };

  useEffect(() => {
    const loadUsers = async () => {
      const userList = await fetchUsers();
      setUsers(userList);
    };
    loadUsers();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedUser || !fromDate) return;

    setLoading(true);
    try {
      const data = await fetchGrowthData(selectedUser, fromDate);
      setGrowthData(data);
      setShowChart(true);
      // Start the animation
      setAnimationProgress(0);
      const startTime = Date.now();
      const duration = 1500; // Animation duration in milliseconds

      const animate = () => {
        const currentTime = Date.now();
        const progress = Math.min((currentTime - startTime) / duration, 1);
        setAnimationProgress(progress);

        if (progress < 1) {
          requestAnimationFrame(animate);
        }
      };

      requestAnimationFrame(animate);
    } catch (error) {
      console.error('Error fetching growth data:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fistbump-growth">
      <div className="growth-header">
        <h2>Fistbump Growth Analysis</h2>
        <p>Track your fistbump growth over time</p>
      </div>

      <form onSubmit={handleSubmit} className="growth-form">
        <div className="form-group">
          <label htmlFor="user-select">Team Member</label>
          <select
            id="user-select"
            value={selectedUser}
            onChange={(e) => setSelectedUser(e.target.value)}
            required
          >
            <option value="">Select a team member</option>
            {users.map(user => (
              <option key={user.id} value={user.id}>{user.name}</option>
            ))}
          </select>
        </div>

        <div className="form-group">
          <label htmlFor="from-date">From Date</label>
          <input
            type="date"
            id="from-date"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
            max={new Date().toISOString().split('T')[0]}
            required
          />
        </div>

        <button type="submit" className="analyze-button">
          Analyze Growth
        </button>
      </form>

      {loading && (
        <div className="growth-loading">
          Analyzing growth data...
        </div>
      )}

      {showChart && growthData && (
        <div className="growth-chart">
          <ResponsiveContainer width="100%" height={400}>
            <LineChart
              data={growthData}
              margin={{ top: 20, right: 30, left: 20, bottom: 20 }}
            >
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis
                dataKey="month"
                axisLine={false}
                tickLine={false}
                padding={{ left: 20, right: 20 }}
              />
              <YAxis
                axisLine={false}
                tickLine={false}
                label={{ 
                  value: 'Fistbumps',
                  angle: -90,
                  position: 'insideLeft',
                  offset: 0
                }}
              />
              <Tooltip
                contentStyle={{
                  background: 'rgba(255, 255, 255, 0.95)',
                  border: 'none',
                  borderRadius: '8px',
                  boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                  padding: '8px 12px'
                }}
              />
              <Legend
                verticalAlign="top"
                align="right"
                iconType="circle"
                wrapperStyle={{
                  paddingBottom: '20px'
                }}
              />
              <Line
                type="monotone"
                dataKey="fistbumps"
                name="Monthly Fistbumps"
                stroke="#4CAF50"
                strokeWidth={2}
                dot={{ r: 4 }}
                activeDot={{ r: 6 }}
                strokeDasharray={`${animationProgress * 1000} ${1000 - animationProgress * 1000}`}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
};

export default FistbumpGrowth;
