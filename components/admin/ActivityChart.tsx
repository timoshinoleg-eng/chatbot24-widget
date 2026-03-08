"use client";

import { motion } from 'framer-motion';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';

interface ActivityData {
  date: string;
  chats: number;
  leads: number;
}

interface ActivityChartProps {
  data: ActivityData[];
}

const CustomTooltip = ({ active, payload, label }: { active?: boolean; payload?: any[]; label?: string }) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-slate-800 border border-slate-700 rounded-lg p-3 shadow-lg">
        <p className="text-slate-300 font-medium mb-2">{label}</p>
        {payload.map((entry, index) => (
          <div key={index} className="flex items-center gap-2">
            <div 
              className="w-3 h-3 rounded-full" 
              style={{ backgroundColor: entry.color }}
            />
            <span className="text-slate-400">
              {entry.name}: {' '}
            </span>
            <span className="text-slate-200 font-semibold">
              {entry.value}
            </span>
          </div>
        ))}
      </div>
    );
  }
  return null;
};

export function ActivityChart({ data }: ActivityChartProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.15, ease: [0.4, 0, 0.2, 1] }}
      className="bg-slate-800 border border-slate-700 rounded-xl p-6 shadow-card"
    >
      <h3 className="text-lg font-semibold text-slate-50 mb-6">Активность по дням</h3>

      <div className="h-[300px]">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
            <defs>
              <linearGradient id="colorChats" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#6366F1" stopOpacity={0.3}/>
                <stop offset="95%" stopColor="#6366F1" stopOpacity={0}/>
              </linearGradient>
              <linearGradient id="colorLeads" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#10B981" stopOpacity={0.3}/>
                <stop offset="95%" stopColor="#10B981" stopOpacity={0}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="4 4" stroke="#334155" />
            <XAxis 
              dataKey="date" 
              stroke="#64748B" 
              tick={{ fill: '#94A3B8', fontSize: 12 }}
              tickLine={false}
            />
            <YAxis 
              stroke="#64748B" 
              tick={{ fill: '#94A3B8', fontSize: 12 }}
              tickLine={false}
            />
            <Tooltip content={<CustomTooltip />} />
            <Legend 
              wrapperStyle={{ paddingTop: 20 }}
              formatter={(value: string) => (
                <span className="text-slate-400">{value}</span>
              )}
            />
            <Line
              type="monotone"
              dataKey="chats"
              name="Диалоги"
              stroke="#6366F1"
              strokeWidth={3}
              dot={{ fill: '#6366F1', strokeWidth: 2, r: 4 }}
              activeDot={{ r: 6, fill: '#6366F1', stroke: '#fff', strokeWidth: 2 }}
              fillOpacity={1}
              fill="url(#colorChats)"
            />
            <Line
              type="monotone"
              dataKey="leads"
              name="Лиды"
              stroke="#10B981"
              strokeWidth={3}
              dot={{ fill: '#10B981', strokeWidth: 2, r: 4 }}
              activeDot={{ r: 6, fill: '#10B981', stroke: '#fff', strokeWidth: 2 }}
              fillOpacity={1}
              fill="url(#colorLeads)"
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </motion.div>
  );
}
