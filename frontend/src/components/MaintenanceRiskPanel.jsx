import React from 'react';
import { Wrench, ShieldAlert } from 'lucide-react';

export const MaintenanceRiskPanel = ({ risksData }) => {
  if (!risksData || !risksData.maintenance_risks) return null;

  const getPriorityBadge = (priority) => {
    switch (priority) {
      case 'CRITICAL':
        return 'bg-rose-500/20 text-rose-300 border-rose-500/40';
      case 'HIGH':
        return 'bg-amber-500/20 text-amber-300 border-amber-500/40';
      case 'MEDIUM':
        return 'bg-yellow-500/20 text-yellow-300 border-yellow-500/40';
      default:
        return 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40';
    }
  };

  return (
    <div className="bg-slate-900 border border-industrial-border rounded-2xl p-6 shadow-xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-white font-extrabold text-lg tracking-tight">Maintenance Risk Matrix</h3>
          <p className="text-xs text-slate-400 mt-0.5">0–100 risk score based on engine hours, idle trends & alerts</p>
        </div>
        <span className="px-2.5 py-1 rounded text-[10px] font-bold uppercase font-mono bg-rose-500/10 text-rose-300 border border-rose-500/20">
          MAINTENANCE RISK ESTIMATE
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {risksData.maintenance_risks.slice(0, 6).map((item) => (
          <div
            key={item.id}
            className="bg-slate-950 border border-slate-800 rounded-xl p-4 flex flex-col justify-between space-y-3"
          >
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-extrabold text-white font-mono">{item.equipment_id}</div>
                <div className="text-[11px] text-slate-400 font-mono">{item.model} • {item.site_code}</div>
              </div>
              <div className="flex items-center gap-2">
                <span className={`px-2.5 py-0.5 rounded text-[10px] font-extrabold font-mono uppercase border ${getPriorityBadge(item.priority)}`}>
                  {item.priority}
                </span>
                <div className="px-2 py-1 rounded-lg bg-slate-900 border border-slate-800 text-xs font-mono font-bold text-cat-400">
                  {item.risk_score}/100
                </div>
              </div>
            </div>

            <div className="space-y-1">
              <span className="text-[10px] font-bold text-slate-400 uppercase font-mono">Risk Contributing Factors:</span>
              <ul className="text-xs text-slate-300 space-y-1">
                {item.reasons.map((r, idx) => (
                  <li key={idx} className="flex items-start gap-1.5 text-slate-300">
                    <span className="text-amber-400 font-bold">•</span>
                    <span>{r}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
