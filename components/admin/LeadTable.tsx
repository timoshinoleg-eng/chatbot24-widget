"use client";

import React from "react";
import { ArrowUpDown, ExternalLink } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface Lead {
  ID: string;
  TITLE: string;
  NAME: string;
  COMPANY_TITLE: string;
  OPPORTUNITY: string;
  DATE_CREATE: string;
  SOURCE_ID: string;
}

interface LeadTableProps {
  leads: Lead[];
}

export function LeadTable({ leads }: LeadTableProps) {
  const getScoreBadge = (title: string) => {
    if (title.includes("HOT")) {
      return (
        <span className="inline-flex items-center rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-medium text-red-800">
          HOT
        </span>
      );
    }
    if (title.includes("WARM")) {
      return (
        <span className="inline-flex items-center rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-800">
          WARM
        </span>
      );
    }
    return (
      <span className="inline-flex items-center rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-medium text-blue-800">
        COLD
      </span>
    );
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return "-";
    const date = new Date(dateString);
    return date.toLocaleDateString("ru-RU", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  };

  const formatBudget = (amount: string) => {
    if (!amount || amount === "0") return "-";
    const num = parseInt(amount, 10);
    return `${num.toLocaleString("ru-RU")} ₽`;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Последние лиды</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="pb-3 text-left font-medium text-gray-500">ID</th>
                <th className="pb-3 text-left font-medium text-gray-500">Имя</th>
                <th className="pb-3 text-left font-medium text-gray-500">Компания</th>
                <th className="pb-3 text-left font-medium text-gray-500">Бюджет</th>
                <th className="pb-3 text-left font-medium text-gray-500">Статус</th>
                <th className="pb-3 text-left font-medium text-gray-500">Дата</th>
                <th className="pb-3 text-left font-medium text-gray-500"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {leads.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-gray-500">
                    Нет данных о лидах
                  </td>
                </tr>
              ) : (
                leads.map((lead) => (
                  <tr key={lead.ID} className="hover:bg-gray-50">
                    <td className="py-3 text-gray-900">#{lead.ID}</td>
                    <td className="py-3 font-medium text-gray-900">
                      {lead.NAME || lead.TITLE?.split("—")[1]?.trim() || "-"}
                    </td>
                    <td className="py-3 text-gray-600">{lead.COMPANY_TITLE || "-"}</td>
                    <td className="py-3 text-gray-900">
                      {formatBudget(lead.OPPORTUNITY)}
                    </td>
                    <td className="py-3">{getScoreBadge(lead.TITLE)}</td>
                    <td className="py-3 text-gray-600">
                      {formatDate(lead.DATE_CREATE)}
                    </td>
                    <td className="py-3">
                      <button className="text-blue-600 hover:text-blue-800">
                        <ExternalLink className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
