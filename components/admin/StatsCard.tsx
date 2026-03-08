"use client";

import { motion } from 'framer-motion';
import { TrendingUp, TrendingDown, MessageSquare, Users, Target, Flame } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useEffect, useState } from 'react';

interface StatsCardProps {
  title: string;
  value: number;
  suffix?: string;
  trend: number;
  trendLabel: string;
  icon: 'dialogs' | 'visitors' | 'conversion' | 'hot';
  sparklineData: number[];
  index: number;
}

const iconMap = {
  dialogs: MessageSquare,
  visitors: Users,
  conversion: Target,
  hot: Flame,
};

const iconColors = {
  dialogs: 'bg-indigo-500/20 text-indigo-400',
  visitors: 'bg-blue-500/20 text-blue-400',
  conversion: 'bg-emerald-500/20 text-emerald-400',
  hot: 'bg-rose-500/20 text-rose-400',
};

// Count up animation hook
function useCountUp({
  end,
  duration = 800,
  decimals = 0,
  suffix = '',
}: {
  end: number;
  duration?: number;
  decimals?: number;
  suffix?: string;
}) {
  const [value, setValue] = useState(0);

  useEffect(() => {
    let startTime: number;
    let animationFrame: number;

    const animate = (timestamp: number) => {
      if (!startTime) startTime = timestamp;
      const progress = Math.min((timestamp - startTime) / duration, 1);
      const easeOut = 1 - Math.pow(1 - progress, 3);
      setValue(end * easeOut);

      if (progress < 1) {
        animationFrame = requestAnimationFrame(animate);
      }
    };

    animationFrame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animationFrame);
  }, [end, duration]);

  return `${value.toFixed(decimals)}${suffix}`;
}

export function StatsCard({
  title,
  value,
  suffix = '',
  trend,
  trendLabel,
  icon,
  sparklineData,
  index,
}: StatsCardProps) {
  const Icon = iconMap[icon];
  const isPositive = trend >= 0;
  const formattedValue = useCountUp({
    end: value,
    duration: 800 + index * 100,
    decimals: suffix === '%' ? 1 : 0,
    suffix,
  });

  // Generate SVG sparkline path
  const max = Math.max(...sparklineData);
  const min = Math.min(...sparklineData);
  const range = max - min || 1;
  const width = 120;
  const height = 40;
  const points = sparklineData.map((val, i) => {
    const x = (i / (sparklineData.length - 1)) * width;
    const y = height - ((val - min) / range) * height;
    return `${x},${y}`;
  });
  const pathD = `M ${points.join(' L ')}`;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        duration: 0.4,
        delay: index * 0.05,
        ease: [0.4, 0, 0.2, 1],
      }}
      whileHover={{ y: -2 }}
      className={cn(
        'bg-slate-800 border border-slate-700 rounded-xl p-6',
        'shadow-card hover:shadow-card-hover hover:border-indigo-500/30',
        'transition-all duration-200'
      )}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className={cn('w-10 h-10 rounded-lg flex items-center justify-center', iconColors[icon])}>
            <Icon className="w-5 h-5" />
          </div>
          <span className="text-sm font-medium text-slate-400 uppercase tracking-wider">
            {title}
          </span>
        </div>
      </div>

      {/* Value & Trend */}
      <div className="flex items-baseline gap-3 mb-3">
        <span className="text-3xl font-bold text-slate-50 tabular-nums">
          {formattedValue}
        </span>
        <div
          className={cn(
            'flex items-center gap-1 text-sm font-medium',
            isPositive ? 'text-emerald-400' : 'text-rose-400'
          )}
        >
          {isPositive ? (
            <TrendingUp className="w-4 h-4" />
          ) : (
            <TrendingDown className="w-4 h-4" />
          )}
          <span>{isPositive ? '+' : ''}{trend}%</span>
        </div>
      </div>

      {/* Sparkline */}
      <div className="relative h-10 mb-2">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="w-full h-full"
          preserveAspectRatio="none"
        >
          <defs>
            <linearGradient id={`gradient-${index}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#6366F1" stopOpacity="0.3" />
              <stop offset="100%" stopColor="#6366F1" stopOpacity="0" />
            </linearGradient>
          </defs>
          <path
            d={`${pathD} L ${width},${height} L 0,${height} Z`}
            fill={`url(#gradient-${index})`}
          />
          <path
            d={pathD}
            fill="none"
            stroke="#6366F1"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>

      {/* Subtitle */}
      <p className="text-xs text-slate-500">{trendLabel}</p>
    </motion.div>
  );
}
