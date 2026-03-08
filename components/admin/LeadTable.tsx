"use client";

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Search, Eye, Pencil, Trash2, Flame, Thermometer, Snowflake } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { cn } from '@/lib/utils';

interface Lead {
  ID: string;
  TITLE: string;
  NAME: string;
  COMPANY_TITLE: string;
  OPPORTUNITY: string;
  DATE_CREATE: string;
  SOURCE_ID: string;
}

interface LeadsTableProps {
  leads: Lead[];
}

type StatusFilter = 'all' | 'HOT' | 'WARM' | 'COLD';

const statusConfig = {
  HOT: {
    icon: Flame,
    label: 'HOT',
    className: 'bg-rose-500/20 text-rose-400 border-rose-500/30',
  },
  WARM: {
    icon: Thermometer,
    label: 'WARM',
    className: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  },
  COLD: {
    icon: Snowflake,
    label: 'COLD',
    className: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  },
};

export function LeadsTable({ leads }: LeadsTableProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');

  // Parse status from lead title
  const getLeadStatus = (title: string): 'HOT' | 'WARM' | 'COLD' => {
    if (title.includes('HOT')) return 'HOT';
    if (title.includes('WARM')) return 'WARM';
    return 'COLD';
  };

  const filteredLeads = leads.filter((lead) => {
    const matchesSearch =
      (lead.NAME || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (lead.COMPANY_TITLE || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      lead.ID.includes(searchQuery);
    const leadStatus = getLeadStatus(lead.TITLE);
    const matchesStatus = statusFilter === 'all' || leadStatus === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const formatDate = (dateString: string) => {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return date.toLocaleDateString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  };

  const formatBudget = (amount: string) => {
    if (!amount || amount === '0' || amount === '0.00') return '-';
    const num = parseInt(amount, 10);
    return `${num.toLocaleString('ru-RU')} ₽`;
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.35, ease: [0.4, 0, 0.2, 1] }}
      className="bg-slate-800 border border-slate-700 rounded-xl p-6 shadow-card"
    >
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <h3 className="text-lg font-semibold text-slate-50">Последние лиды</h3>

        <div className="flex flex-col sm:flex-row gap-3">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <Input
              placeholder="Поиск..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 bg-slate-700/50 border-slate-600 text-slate-200 placeholder:text-slate-500 w-full sm:w-64"
            />
          </div>

          {/* Status Filters */}
          <div className="flex gap-1">
            {(['all', 'HOT', 'WARM', 'COLD'] as StatusFilter[]).map((status) => (
              <Button
                key={status}
                variant="ghost"
                size="sm"
                onClick={() => setStatusFilter(status)}
                className={cn(
                  'text-xs font-medium capitalize',
                  statusFilter === status
                    ? 'bg-indigo-500/20 text-indigo-400'
                    : 'text-slate-400 hover:text-white hover:bg-slate-700'
                )}
              >
                {status === 'all' ? 'Все' : status}
              </Button>
            ))}
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="border-slate-700 hover:bg-transparent">
              <TableHead className="text-slate-400 font-medium uppercase text-xs tracking-wider">
                ID
              </TableHead>
              <TableHead className="text-slate-400 font-medium uppercase text-xs tracking-wider">
                Имя
              </TableHead>
              <TableHead className="text-slate-400 font-medium uppercase text-xs tracking-wider">
                Компания
              </TableHead>
              <TableHead className="text-slate-400 font-medium uppercase text-xs tracking-wider">
                Бюджет
              </TableHead>
              <TableHead className="text-slate-400 font-medium uppercase text-xs tracking-wider">
                Статус
              </TableHead>
              <TableHead className="text-slate-400 font-medium uppercase text-xs tracking-wider">
                Дата
              </TableHead>
              <TableHead className="text-slate-400 font-medium uppercase text-xs tracking-wider text-right">
                Действия
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredLeads.map((lead, index) => {
              const status = statusConfig[getLeadStatus(lead.TITLE)];
              const StatusIcon = status.icon;

              return (
                <motion.tr
                  key={lead.ID}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.2, delay: 0.4 + index * 0.05 }}
                  className="border-slate-700/50 hover:bg-slate-700/30 transition-colors group"
                >
                  <TableCell className="text-slate-900">#{lead.ID}</TableCell>
                  <TableCell className="font-medium text-slate-200">
                    {lead.NAME || lead.TITLE?.split('—')[1]?.trim() || '-'}
                  </TableCell>
                  <TableCell className="text-slate-400">{lead.COMPANY_TITLE || '-'}</TableCell>
                  <TableCell className="text-slate-200">
                    {formatBudget(lead.OPPORTUNITY)}
                  </TableCell>
                  <TableCell>
                    <span
                      className={cn(
                        'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border',
                        status.className
                      )}
                    >
                      <StatusIcon className="w-3.5 h-3.5" />
                      {status.label}
                    </span>
                  </TableCell>
                  <TableCell className="text-slate-400 text-sm">{formatDate(lead.DATE_CREATE)}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-slate-400 hover:text-indigo-400 hover:bg-indigo-500/10"
                      >
                        <Eye className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-slate-400 hover:text-emerald-400 hover:bg-emerald-500/10"
                      >
                        <Pencil className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </TableCell>
                </motion.tr>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {/* Empty state */}
      {filteredLeads.length === 0 && (
        <div className="text-center py-12">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-slate-700/50 flex items-center justify-center">
            <Search className="w-8 h-8 text-slate-500" />
          </div>
          <p className="text-slate-400">Лиды не найдены</p>
          <p className="text-slate-500 text-sm mt-1">
            Попробуйте изменить параметры поиска
          </p>
        </div>
      )}
    </motion.div>
  );
}
