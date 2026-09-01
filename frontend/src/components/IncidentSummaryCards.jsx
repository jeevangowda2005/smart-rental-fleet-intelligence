import React from 'react';
import { ShieldAlert, AlertTriangle, CheckCircle, Clock, Zap, Activity } from 'lucide-react';

export const IncidentSummaryCards = ({ summary }) => {
  if (!summary) return null;

  const cards = [
    { title: 'Open Incidents', value: summary.total_open, icon: Activity, badge: 'LIVE APPLICATION DATA', colorClass: 'text-white' },
    { title: 'Critical', value: summary.critical, icon: ShieldAlert, badge: 'CRITICAL PRIORITY', colorClass: 'text-rose-400' },
    { title: 'High', value: summary.high, icon: AlertTriangle, badge: 'HIGH PRIORITY', colorClass: 'text-amber-400' },
    { title: 'Awaiting Approval', value: summary.awaiting_approval, icon: Clock, badge: 'MANAGER APPROVAL REQUIRED', colorClass: 'text-cat-400' },
    { title: 'In Progress', value: summary.in_progress, icon: Zap, badge: 'ACTIVE', colorClass: 'text-blue-400' },
    { title: 'Resolved Today', value: summary.resolved_today, icon: CheckCircle, badge: 'RESOLVED', colorClass: 'text-emerald-400' },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
      {cards.map((card, i) => {
        const Icon = card.icon;
        return (
          <div key={i} className="bg-slate-900 border border-industrial-border rounded-2xl p-4 flex flex-col justify-between shadow-lg">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-slate-400 uppercase font-mono">{card.title}</span>
              <Icon className={`w-4 h-4 ${card.colorClass}`} />
            </div>
            <div className={`text-3xl font-black font-mono mt-2 ${card.colorClass}`}>{card.value}</div>
            <div className="mt-2 pt-2 border-t border-slate-800">
              <span className="text-[9px] font-bold uppercase font-mono text-slate-500">{card.badge}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
};
