import React from 'react';
import { ShieldAlert, AlertTriangle, Activity, Wrench } from 'lucide-react';

export const MaintenanceRiskOverview = ({ riskData }) => {
  if (!riskData) return null;

  const cards = [
    {
      title: 'Average Fleet Risk Score',
      value: `${riskData.average_risk_score}/100`,
      subtitle: `Analyzed Assets: ${riskData.total_equipment}`,
      badge: 'MAINTENANCE RISK ESTIMATE',
      icon: Activity,
      color: 'amber'
    },
    {
      title: 'Critical Risk Assets',
      value: riskData.critical_risk_count,
      subtitle: 'Score 75–100 (Immediate Service)',
      badge: 'CRITICAL PRIORITY',
      icon: ShieldAlert,
      color: 'rose'
    },
    {
      title: 'High Risk Assets',
      value: riskData.high_risk_count,
      subtitle: 'Score 50–74 (Elevated Risk)',
      badge: 'HIGH PRIORITY',
      icon: AlertTriangle,
      color: 'amber'
    },
    {
      title: 'Early Warning Signals',
      value: riskData.early_warning_count,
      subtitle: 'Assets in Watch / Early Warning State',
      badge: 'AI PREDICTED / ESTIMATED',
      icon: Wrench,
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
