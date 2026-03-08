"use client";

import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

interface FunnelData {
  stage: string;
  count: number;
  percent: number;
}

interface FunnelChartProps {
  data: FunnelData[];
}

const stageColors = [
  'from-indigo-500 to-indigo-600',
  'from-blue-500 to-blue-600',
  'from-cyan-500 to-cyan-600',
  'from-emerald-500 to-emerald-600',
];

export function FunnelChart({ data }: FunnelChartProps) {
  const maxCount = Math.max(...data.map((d) => d.count));

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.25, ease: [0.4, 0, 0.2, 1] }}
      className="bg-slate-800 border border-slate-700 rounded-xl p-6 shadow-card h-full"
    >
      <h3 className="text-lg font-semibold text-slate-50 mb-6">Воронка конверсии</h3>

      <div className="space-y-4">
        {data.map((item, index) => {
          const widthPercent = (item.count / maxCount) * 100;
          const prevItem = index > 0 ? data[index - 1] : null;
          const conversionRate = prevItem
            ? Math.round((item.count / prevItem.count) * 100)
            : 100;

          return (
            <div key={item.stage} className="space-y-1">
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-400 font-medium">{item.stage}</span>
                <div className="flex items-center gap-3">
                  <span className="text-slate-50 font-semibold tabular-nums">
                    {item.count.toLocaleString('ru-RU')}
                  </span>
                  <span className="text-slate-500 text-xs w-10 text-right">
                    {item.percent}%
                  </span>
                </div>
              </div>

              <div className="relative h-8 bg-slate-700/50 rounded-lg overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${widthPercent}%` }}
                  transition={{
                    duration: 0.8,
                    delay: 0.3 + index * 0.1,
                    ease: [0.4, 0, 0.2, 1],
                  }}
                  className={cn(
                    'h-full rounded-lg bg-gradient-to-r',
                    stageColors[index % stageColors.length]
                  )}
                />
              </div>

              {prevItem && (
                <div className="flex justify-end">
                  <span className="text-xs text-slate-500">
                    Конверсия: {' '}
                    <span className="text-emerald-400 font-medium">{conversionRate}%</span>
                  </span>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </motion.div>
  );
}
