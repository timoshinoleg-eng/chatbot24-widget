/**
 * Lead Scoring System
 * Automatically calculates HOT/WARM/COLD status based on budget and timeline
 */

export interface LeadScore {
  score: number;      // 0-100
  status: 'HOT' | 'WARM' | 'COLD';
  priority: 'HIGH' | 'MEDIUM' | 'LOW';
  action: string;
}

const budgetMap: Record<string, number> = {
  'до 50 000₽': 20,
  '50 000₽ - 100 000₽': 40,
  '100 000₽ - 250 000₽': 60,
  '250 000₽+': 90,
  'unknown': 30
};

const timelineMap: Record<string, number> = {
  'срочно': 30,
  '1 неделя': 25,
  '1 месяц': 20,
  'не определено': 5,
  'unknown': 10
};

export function scoreLead(budget: string, timeline: string): LeadScore {
  const budgetScore = budgetMap[budget] || 30;
  const timelineScore = timelineMap[timeline.toLowerCase()] || 10;
  const score = budgetScore + timelineScore;

  return {
    score,
    status: score >= 70 ? 'HOT' : score >= 40 ? 'WARM' : 'COLD',
    priority: score >= 70 ? 'HIGH' : score >= 40 ? 'MEDIUM' : 'LOW',
    action: score >= 70
      ? 'Немедленный звонок менеджером'
      : score >= 40
        ? 'Отправка КП в течение 24 часов'
        : 'Добавить в рассылку'
  };
}

export function getScoreColor(status: LeadScore['status']): string {
  switch (status) {
    case 'HOT':
      return 'text-red-600 bg-red-50 border-red-200';
    case 'WARM':
      return 'text-amber-600 bg-amber-50 border-amber-200';
    case 'COLD':
      return 'text-blue-600 bg-blue-50 border-blue-200';
    default:
      return 'text-gray-600 bg-gray-50 border-gray-200';
  }
}

export function getPriorityColor(priority: LeadScore['priority']): string {
  switch (priority) {
    case 'HIGH':
      return 'bg-red-500';
    case 'MEDIUM':
      return 'bg-amber-500';
    case 'LOW':
      return 'bg-blue-500';
    default:
      return 'bg-gray-500';
  }
}
