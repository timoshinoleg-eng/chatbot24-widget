"use client";

import React from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface SentimentChartProps {
  dailyStats: Array<{
    date: string;
    chats: number;
    leads: number;
    sentiment: number;
  }>;
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
}

const COLORS = {
  positive: "#22c55e",
  negative: "#ef4444",
  neutral: "#9ca3af",
  hot: "#ef4444",
  warm: "#f59e0b",
  cold: "#3b82f6",
};

export function SentimentChart({
  dailyStats,
  sentimentDistribution,
  scoreDistribution,
}: SentimentChartProps) {
  const sentimentPieData = [
    { name: "Позитивные", value: sentimentDistribution.POSITIVE, color: COLORS.positive },
    { name: "Негативные", value: sentimentDistribution.NEGATIVE, color: COLORS.negative },
    { name: "Нейтральные", value: sentimentDistribution.NEUTRAL, color: COLORS.neutral },
  ];

  const scorePieData = [
    { name: "HOT", value: scoreDistribution.HOT, color: COLORS.hot },
    { name: "WARM", value: scoreDistribution.WARM, color: COLORS.warm },
    { name: "COLD", value: scoreDistribution.COLD, color: COLORS.cold },
  ];

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {/* Daily Activity Chart */}
      <Card className="md:col-span-2">
        <CardHeader>
          <CardTitle>Активность по дням</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={dailyStats}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Line
                type="monotone"
                dataKey="chats"
                name="Диалоги"
                stroke="#3b82f6"
                strokeWidth={2}
              />
              <Line
                type="monotone"
                dataKey="leads"
                name="Лиды"
                stroke="#22c55e"
                strokeWidth={2}
              />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Sentiment Distribution */}
      <Card>
        <CardHeader>
          <CardTitle>Распределение тональности</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={250}>
            <PieChart>
              <Pie
                data={sentimentPieData}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={80}
                paddingAngle={5}
                dataKey="value"
              >
                {sentimentPieData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Score Distribution */}
      <Card>
        <CardHeader>
          <CardTitle>Распределение скоринга</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={250}>
            <PieChart>
              <Pie
                data={scorePieData}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={80}
                paddingAngle={5}
                dataKey="value"
              >
                {scorePieData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}
