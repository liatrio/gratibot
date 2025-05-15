import React, { useState, useEffect } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts';
import './FistbumpChart.css';

const TIME_FRAMES = [
  { label: 'Last 30 Minutes', value: '30m' },
  { label: 'Last 24 Hours', value: '1d' },
  { label: 'Last Week', value: '1w' },
  { label: 'Last Month', value: '1m' }
];

// Mock data - replace with actual API call
const fetchData = async (timeFrame) => {
  // TODO: Replace with actual API call
  const mockData = [
    { name: 'Dawn', fistbumps: Math.floor(Math.random() * 50) },
    { name: 'Leo', fistbumps: Math.floor(Math.random() * 50) },
    { name: 'Patrick', fistbumps: Math.floor(Math.random() * 50) },
    { name: 'Calvin', fistbumps: Math.floor(Math.random() * 50) }
  ];
  return mockData;
};

const FistbumpChart = () => {
  const [timeFrame, setTimeFrame] = useState('1m');
  const [chartData, setChartData] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        const data = await fetchData(timeFrame);
        setChartData(data);
      } catch (error) {
        console.error('Error loading chart data:', error);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [timeFrame]);

  const handleTimeFrameChange = (event) => {
    setTimeFrame(event.target.value);
  };

  return (
    <div className="fistbump-chart-container">
      <div className="chart-header">
        <h2>Fistbump Leaderboard</h2>
        <select 
          value={timeFrame}
          onChange={handleTimeFrameChange}
          className="time-frame-select"
        >
          {TIME_FRAMES.map(option => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      <div className="chart-content">
        {loading ? (
          <div className="loading">Loading...</div>
        ) : (
          <ResponsiveContainer width="100%" height="100%" minHeight={500}>
            <BarChart 
                data={chartData} 
                margin={{ top: 20, right: 30, left: 20, bottom: 20 }}
                layout="vertical"
            >
              <CartesianGrid strokeDasharray="3 3" horizontal={false} />
              <XAxis 
                type="number"
                axisLine={false}
                tickLine={false}
                label={{ value: 'Fistbumps Received', position: 'bottom', offset: 0 }}
              />
              <YAxis 
                dataKey="name"
                type="category"
                axisLine={false}
                tickLine={false}
                width={120}
              />
              <Tooltip 
                cursor={false}
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
              <Bar 
                dataKey="fistbumps" 
                name="Fistbumps" 
                fill="#4CAF50"
                animationDuration={1000}
                radius={[0, 4, 4, 0]}
                barSize={20}
              />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
};

export default FistbumpChart;
