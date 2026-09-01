import React from 'react';
import { ArrowRight, Wrench } from 'lucide-react';

export const MaintenancePriorityTable = ({ priorities, onSelectWhatIf }) => {
  if (!priorities || priorities.length === 0) return null;

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

  const getTrendBadge = (trend) => {
    switch (trend) {
      case 'DETERIORATING':
        return 'text-rose-400 font-bold';
      case 'IMPROVING':
        return 'text-emerald-400 font-bold';
      default:
        return 'text-slate-400';
    }
  };

  return (
    <div className="bg-slate-900 border border-industrial-border rounded-2xl p-6 shadow-xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-white font-extrabold text-lg tracking-tight">Ranked Maintenance Priorities</h3>
          <p className="text-xs text-slate-400 mt-0.5">Prioritized service queue based on risk score & telemetry deterioration</p>
        </div>
        <span className="px-2.5 py-1 rounded text-[10px] font-bold uppercase font-mono bg-cat-500/10 text-cat-400 border border-cat-500/20">
          AI PREDICTED / ESTIMATED
        </span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs font-mono">
          <thead className="bg-slate-950 text-slate-400 uppercase tracking-wider">
            <tr>
              <th className="p-3 rounded-l-xl">Rank</th>
              <th className="p-3">Asset ID</th>
              <th className="p-3">Site</th>
              <th className="p-3 text-center">Risk Score</th>
              <th className="p-3">Priority</th>
              <th className="p-3">Trend</th>
              <th className="p-3">Estimated Window</th>
              <th className="p-3">Recommended Inspection</th>
              <th className="p-3 text-right rounded-r-xl">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800 text-slate-300">
            {priorities.slice(0, 7).map((item) => (
              <tr key={item.id} className="hover:bg-slate-800/40 transition">
                <td className="p-3 font-extrabold text-cat-400 font-mono">#{item.rank}</td>
                <td className="p-3 font-extrabold text-white">{item.equipment_id}</td>
                <td className="p-3 text-slate-400">{item.site_code}</td>
                <td className="p-3 text-center font-black text-amber-400">{item.risk_score}/100</td>
                <td className="p-3">
                  <span className={`px-2 py-0.5 rounded text-[10px] font-extrabold uppercase border ${getPriorityBadge(item.priority)}`}>
                    {item.priority}
                  </span>
                </td>
                <td className={`p-3 font-bold ${getTrendBadge(item.risk_trend)}`}>
                  {item.risk_trend} {item.trend_delta_pts > 0 ? `(+${item.trend_delta_pts})` : ''}
                </td>
                <td className="p-3 text-slate-300 text-[11px]">{item.estimated_maintenance_window}</td>
                <td className="p-3 text-slate-300 max-w-xs truncate">{item.recommended_action}</td>
                <td className="p-3 text-right">
                  {onSelectWhatIf && (
                    <button
                      onClick={() => onSelectWhatIf(item)}
                      className="px-2.5 py-1 rounded-lg bg-cat-500/10 hover:bg-cat-500/20 text-cat-400 border border-cat-500/30 text-[10px] font-extrabold uppercase tracking-wider"
                    >
                      Simulate Service
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
