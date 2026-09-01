import React from 'react';
import { DollarSign, Clock, TrendingUp, AlertTriangle, Fuel, ShieldCheck } from 'lucide-react';

export const ExecutiveKpiCards = ({ summary }) => {
  if (!summary) return null;

  const formatCurrency = (val) => {
    if (val >= 100000) return `₹${(val / 100000).toFixed(2)}L`;
    if (val >= 1000) return `₹${(val / 1000).toFixed(1)}k`;
    return `₹${val.toLocaleString()}`;
  };

  const cards = [
    {
      title: 'Fleet Utilization',
      value: `${summary.current_fleet_utilization_pct}%`,
      subtitle: `Target Optimized: ${summary.potential_optimized_utilization_pct}%`,
      badge: `AI ESTIMATED IMPROVEMENT (+${summary.estimated_utilization_improvement_pts} pts)`,
      icon: TrendingUp,
      color: 'emerald'
    },
    {
      title: 'Estimated Operating Cost',
      value: formatCurrency(summary.total_estimated_operating_cost),
      subtitle: `Total Fleet Cost: ${formatCurrency(summary.total_estimated_fleet_cost)}`,
      badge: 'ESTIMATED COST — DEMO DATA',
      icon: DollarSign,
      color: 'blue'
    },
    {
      title: 'Estimated Idle Cost',
      value: formatCurrency(summary.total_estimated_idle_cost),
      subtitle: `Potential Idle Saving: ${formatCurrency(summary.estimated_potential_idle_saving)}`,
      badge: 'ESTIMATED COST — DEMO DATA',
      icon: Clock,
      color: 'amber'
    },
    {
      title: 'Optimization Opportunity',
      value: formatCurrency(summary.estimated_optimization_opportunity_value),
      subtitle: 'Estimated Optimization Value',
      badge: 'AI ESTIMATED IMPROVEMENT',
      icon: ShieldCheck,
      color: 'cat'
    }
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {cards.map((card, idx) => {
        const Icon = card.icon;
        return (
          <div
            key={idx}
            className="bg-slate-900 border border-industrial-border rounded-2xl p-5 shadow-lg relative overflow-hidden flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider font-mono">
                  {card.title}
                </span>
                <div className="p-2 rounded-xl bg-slate-800 text-slate-300">
                  <Icon className="w-4 h-4" />
                </div>
              </div>
              <div className="text-2xl font-black text-white font-mono mt-2 tracking-tight">
                {card.value}
              </div>
              <p className="text-xs text-slate-400 mt-1">{card.subtitle}</p>
            </div>
            <div className="mt-4 pt-3 border-t border-slate-800/80">
              <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase font-mono bg-cat-500/10 text-cat-400 border border-cat-500/20">
                {card.badge}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
};
