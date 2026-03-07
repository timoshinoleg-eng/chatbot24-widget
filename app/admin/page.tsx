"use client";

import React, { useState, useEffect } from "react";
import { RefreshCw, Calendar, TrendingUp, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatsCards } from "@/components/admin/StatsCards";
import { SentimentChart } from "@/components/admin/SentimentChart";
import { LeadTable } from "@/components/admin/LeadTable";
import { AdminModePanel } from "@/components/ModeSwitcher";

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

export default function AdminDashboard() {
  const [period, setPeriod] = useState<Period>("7d");
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/analytics?period=${period}`);
      
      if (!response.ok) {
        throw new Error("Failed to fetch analytics");
      }

      const result = await response.json();
      setData(result);
    } catch (err) {
      console.error("Analytics fetch error:", err);
      setError("Ошибка загрузки данных");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [period]);

  // Auto-refresh every 30 seconds
  useEffect(() => {
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, [period]);

  const periodLabels: Record<Period, string> = {
    "24h": "24 часа",
    "7d": "7 дней",
    "30d": "30 дней",
  };

  if (isLoading && !data) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="flex items-center gap-2 text-gray-600">
          <RefreshCw className="h-5 w-5 animate-spin" />
          Загрузка...
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-blue-600 to-indigo-600">
                <TrendingUp className="h-5 w-5 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-900">
                  Kimi Agent 2.5
                </h1>
                <p className="text-sm text-gray-500">Analytics Dashboard</p>
              </div>
            </div>

            <div className="flex items-center gap-4">
              {/* Period Selector */}
              <div className="flex items-center gap-2 bg-gray-100 rounded-lg p-1">
                {(Object.keys(periodLabels) as Period[]).map((p) => (
                  <button
                    key={p}
                    onClick={() => setPeriod(p)}
                    className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                      period === p
                        ? "bg-white text-gray-900 shadow-sm"
                        : "text-gray-600 hover:text-gray-900"
                    }`}
                  >
                    {periodLabels[p]}
                  </button>
                ))}
              </div>

              {/* Refresh Button */}
              <Button
                variant="outline"
                size="icon"
                onClick={fetchData}
                disabled={isLoading}
              >
                <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {error ? (
          <div className="rounded-lg bg-red-50 p-4 text-red-600">{error}</div>
        ) : data ? (
          <div className="space-y-6">
            {/* Mode Control Panel */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2">
                {/* Stats Cards */}
                <StatsCards stats={data.summary} />
              </div>
              <div>
                <AdminModePanel />
              </div>
            </div>

            {/* Charts */}
            <SentimentChart
              dailyStats={data.dailyStats}
              sentimentDistribution={data.sentimentDistribution}
              scoreDistribution={data.scoreDistribution}
            />

            {/* Lead Table */}
            <LeadTable leads={data.recentLeads} />

            {/* Last Updated */}
            <div className="text-right text-sm text-gray-500">
              Обновлено: {new Date(data.lastUpdated).toLocaleString("ru-RU")}
            </div>
          </div>
        ) : null}
      </main>
    </div>
  );
}
