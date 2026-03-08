"use client";

import { motion } from 'framer-motion';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';

interface SentimentData {
  name: string;
  value: number;
  color: string;
}

interface SentimentChartProps {
  data: SentimentData[];
}

const CustomTooltip = ({ active, payload }: { active?: boolean; payload?: any[] }) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-slate-800 border border-slate-700 rounded-lg p-3 shadow-lg">
        <p className="text-slate-200 font-medium">{payload[0].name}</p>
        <p className="text-slate-400 text-sm">
          {payload[0].value}% ({payload[0].payload.count || payload[0].value})
        </p>
      </div>
    );
  }
  return null;
};

export function SentimentChart({ data }: SentimentChartProps) {
  const total = data.reduce((sum, item) => sum + item.value, 0);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.3, ease: [0.4, 0, 0.2, 1] }}
      className="bg-slate-800 border border-slate-700 rounded-xl p-6 shadow-card h-full"
    >
      <h3 className="text-lg font-semibold text-slate-50 mb-2">Распределение тональности</h3>
      
      <div className="h-[250px]">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={60}
              outerRadius={80}
              paddingAngle={2}
              dataKey="value"
              animationBegin={400}
              animationDuration={800}
            >
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} strokeWidth={0} />
              ))}
            </Pie>
            <Tooltip content={<CustomTooltip />} />
            <Legend 
              verticalAlign="bottom" 
              height={36}
              formatter={(value: string) => (
                <span className="text-slate-400 text-sm">{value}</span>
              )}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>

      {/* Center label */}
      <div className="text-center -mt-16 mb-4">
        <span className="text-2xl font-bold text-slate-50">{total}</span>
        <p className="text-xs text-slate-500">всего</p>
      </div>
    </motion.div>
  );
}
