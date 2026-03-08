"use client";

import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { RefreshCw, Download, Settings, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatsCard } from "@/components/admin/StatsCard";
import { ActivityChart } from "@/components/admin/ActivityChart";
import { SentimentChart } from "@/components/admin/SentimentChart";
import { FunnelChart } from "@/components/admin/FunnelChart";
import { LeadsTable } from "@/components/admin/LeadTable";
import { toast } from "sonner";

type Period = "24h" | "7d" | "30d";

interface AnalyticsData {
  period: string;
  summary: {
    totalChats: number;
    totalLeads: number;
    conversionRate: number;
    escalations: number;
    avgMessages: number;
  };
  sentimentDistribution: {
    POSITIVE: number;
    NEGATIVE: number;
    NEUTRAL: number;
  };
  scoreDistribution: {
    HOT: number;
    WARM: number;
    COLD: number;
  };
  dailyStats: Array<{
    date: string;
    chats: number;
    leads: number;
    sentiment: number;
  }>;
  recentLeads: Array<{
    ID: string;
    TITLE: string;
    NAME: string;
    COMPANY_TITLE: string;
    OPPORTUNITY: string;
    DATE_CREATE: string;
    SOURCE_ID: string;
  }>;
  lastUpdated: string;
}

const periodLabels: Record<Period, string> = {
  "24h": "24 часа",
  "7d": "7 дней",
  "30d": "30 дней",
};

export default function AdminDashboard() {
  const [period, setPeriod] = useState<Period>("7d");
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/analytics?period=${period}`);
      if (!response.ok) throw new Error("Failed to fetch");
      const result = await response.json();
      setData(result);
    } catch (error) {
      console.error("Analytics fetch error:", error);
      toast.error("Ошибка загрузки данных");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [period]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }
      switch (e.key.toLowerCase()) {
        case 'e':
          handleExport();
          break;
        case 'r':
          fetchData();
          toast.success("Данные обновлены");
          break;
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleExport = async (format: 'csv' | 'json' = 'csv') => {
    try {
      const response = await fetch('/api/analytics/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ format }),
      });
      if (!response.ok) throw new Error("Export failed");
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `analytics-${new Date().toISOString().split('T')[0]}.${format}`;
      a.click();
      window.URL.revokeObjectURL(url);
      
      toast.success(`Экспорт в ${format.toUpperCase()} выполнен`);
    } catch (error) {
      toast.error("Ошибка экспорта");
    }
  };

  // Prepare chart data
  const activityData = data?.dailyStats?.map(stat => ({
    date: stat.date,
    chats: stat.chats,
    leads: stat.leads,
  })) || [];

  const sentimentData = data ? [
    { name: 'Позитивное', value: data.sentimentDistribution.POSITIVE, color: '#10B981' },
    { name: 'Нейтральное', value: data.sentimentDistribution.NEUTRAL, color: '#3B82F6' },
    { name: 'Негативное', value: data.sentimentDistribution.NEGATIVE, color: '#EF4444' },
  ] : [];

  const funnelData = data ? [
    { stage: 'Диалоги', count: data.summary.totalChats, percent: 100 },
    { stage: 'Лиды', count: data.summary.totalLeads, percent: data.summary.conversionRate },
    { stage: 'HOT', count: data.scoreDistribution.HOT, percent: Math.round((data.scoreDistribution.HOT / data.summary.totalLeads) * 100) || 0 },
  ] : [];

  // Stats for cards with mock sparkline data
  const statsData = data ? [
    {
      id: 'dialogs' as const,
      title: 'Всего диалогов',
      value: data.summary.totalChats,
      trend: 12,
      trendLabel: 'последние 7 дней',
      sparklineData: [100, 120, 115, 140, 165, 180, data.summary.totalChats],
    },
    {
      id: 'visitors' as const,
      title: 'Лиды',
      value: data.summary.totalLeads,
      trend: 8,
      trendLabel: 'последние 7 дней',
      sparklineData: [10, 15, 12, 18, 22, 25, data.summary.totalLeads],
    },
    {
      id: 'conversion' as const,
      title: 'Конверсия',
      value: data.summary.conversionRate,
      suffix: '%',
      trend: 2.1,
      trendLabel: 'последние 7 дней',
      sparklineData: [15, 16, 15.5, 18, 20, 22, data.summary.conversionRate],
    },
    {
      id: 'hot' as const,
      title: 'Горячих лидов',
      value: data.scoreDistribution.HOT,
      trend: -5,
      trendLabel: 'последние 7 дней',
      sparklineData: [30, 35, 40, 38, 45, 50, data.scoreDistribution.HOT],
    },
  ] : [];

  if (isLoading && !data) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="flex items-center gap-3 text-slate-400">
          <RefreshCw className="h-6 w-6 animate-spin" />
          <span className="text-lg">Загрузка...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900">
      {/* Header */}
      <motion.header
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="bg-slate-800 border-b border-slate-700 sticky top-0 z-50"
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600">
                <TrendingUp className="h-5 w-5 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-slate-50">
                  Chatbot24
                </h1>
                <p className="text-sm text-slate-400">Analytics Dashboard</p>
              </div>
            </div>

            <div className="flex items-center gap-4">
              {/* Period Selector */}
              <div className="flex items-center gap-1 bg-slate-700/50 rounded-lg p-1">
                {(Object.keys(periodLabels) as Period[]).map((p) => (
                  <button
                    key={p}
                    onClick={() => setPeriod(p)}
                    className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
                      period === p
                        ? "bg-indigo-500 text-white shadow-lg"
                        : "text-slate-400 hover:text-white hover:bg-slate-600"
                    }`}
                  >
                    {periodLabels[p]}
                  </button>
                ))}
              </div>

              {/* Actions */}
              <Button
                variant="outline"
                size="icon"
                onClick={() => handleExport('csv')}
                className="border-slate-600 text-slate-300 hover:bg-slate-700 hover:text-white"
              >
                <Download className="h-4 w-4" />
              </Button>

              <Button
                variant="outline"
                size="icon"
                onClick={() => { fetchData(); toast.success("Данные обновлены"); }}
                disabled={isLoading}
                className="border-slate-600 text-slate-300 hover:bg-slate-700 hover:text-white"
              >
                <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
              </Button>
            </div>
          </div>
        </div>
      </motion.header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="space-y-6">
          {/* Stats Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {statsData.map((stat, index) => (
              <StatsCard
                key={stat.id}
                title={stat.title}
                value={stat.value}
                suffix={stat.suffix}
                trend={stat.trend}
                trendLabel={stat.trendLabel}
                icon={stat.id}
                sparklineData={stat.sparklineData}
                index={index}
              />
            ))}
          </div>

          {/* Activity Chart */}
          {activityData.length > 0 && (
            <ActivityChart data={activityData} />
          )}

          {/* Funnel & Sentiment */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {funnelData.length > 0 && (
              <FunnelChart data={funnelData} />
            )}
            {sentimentData.length > 0 && (
              <SentimentChart data={sentimentData} />
            )}
          </div>

          {/* Leads Table */}
          {data?.recentLeads && (
            <LeadsTable leads={data.recentLeads} />
          )}

          {/* Last Updated */}
          <div className="text-right text-sm text-slate-500">
            Обновлено: {data?.lastUpdated ? new Date(data.lastUpdated).toLocaleString("ru-RU") : '-'}
          </div>
        </div>
      </main>

      {/* Keyboard Shortcuts Hint */}
      <div className="fixed bottom-4 left-4 z-40 hidden lg:block">
        <div className="bg-slate-800/80 backdrop-blur-sm border border-slate-700 rounded-lg px-3 py-2">
          <p className="text-xs text-slate-500">
            <kbd className="px-1.5 py-0.5 bg-slate-700 rounded text-slate-300">E</kbd>{' '}
            экспорт{' '}
            <kbd className="px-1.5 py-0.5 bg-slate-700 rounded text-slate-300">R</kbd>{' '}
            обновить
          </p>
        </div>
      </div>
    </div>
  );
}
