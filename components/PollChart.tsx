import React from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
  PieChart,
  Pie
} from 'recharts';
import { PollOption } from '../types';

interface PollChartProps {
  options: PollOption[];
  totalVotes: number;
  type?: 'bar' | 'pie';
}

export const PollChart: React.FC<PollChartProps> = ({ options, totalVotes, type = 'bar' }) => {
  if (totalVotes === 0) {
    return (
      <div className="h-64 flex flex-col items-center justify-center text-gray-400 dark:text-gray-600 bg-gray-50 dark:bg-gray-900/50 rounded-xl border border-dashed border-gray-200 dark:border-gray-700">
        <p>No votes yet</p>
      </div>
    );
  }

  // Calculate percentages for tooltip/labels
  const data = options.map(opt => ({
    ...opt,
    percentage: Math.round((opt.votes / totalVotes) * 100),
  }));

  // Monochrome Palette (Black to Light Gray)
  const getMonochromeColor = (index: number) => {
    // Start from black/dark gray and get lighter
    const shades = [
      '#111827', // Gray 900
      '#374151', // Gray 700
      '#6b7280', // Gray 500
      '#9ca3af', // Gray 400
      '#d1d5db', // Gray 300
      '#e5e7eb'  // Gray 200
    ];
    return shades[index % shades.length];
  };

  if (type === 'pie') {
    return (
      <div className="h-64 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={60}
              outerRadius={80}
              paddingAngle={5}
              dataKey="votes"
            >
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={getMonochromeColor(index)} stroke="none" />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{
                backgroundColor: '#1f2937',
                borderRadius: '8px',
                border: 'none',
                color: '#ffffff',
                fontSize: '12px',
                boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
              }}
              itemStyle={{
                color: '#ffffff'
              }}
              labelStyle={{
                color: '#ffffff'
              }}
              formatter={(value: number, name: string, props: any) => [
                `${value} votes (${props.payload.percentage}%)`,
                props.payload.text
              ]}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
    );
  }

  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={data}
          layout="vertical"
          margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
        >
          <XAxis type="number" hide />
          <YAxis
            type="category"
            dataKey="text"
            width={100}
            tick={{ fontSize: 12, fill: '#6b7280' }}
            tickLine={false}
            axisLine={false}
          />
          <Tooltip
            cursor={{ fill: 'transparent' }}
            contentStyle={{
              backgroundColor: '#1f2937',
              borderRadius: '8px',
              border: 'none',
              color: '#ffffff',
              fontSize: '12px',
              boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
            }}
            itemStyle={{
              color: '#ffffff'
            }}
            labelStyle={{
              color: '#ffffff'
            }}
            formatter={(value: number, name: string, props: any) => [
              `${value} votes`,
              `${props.payload.percentage}%`
            ]}
          />
          <Bar dataKey="votes" radius={[0, 4, 4, 0]} barSize={24}>
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill="#374151" />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};