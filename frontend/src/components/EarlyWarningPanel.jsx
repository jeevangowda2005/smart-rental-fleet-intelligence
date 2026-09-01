import React from 'react';
import { AlertCircle, Eye } from 'lucide-react';

export const EarlyWarningPanel = ({ earlyWarnings }) => {
  if (!earlyWarnings || earlyWarnings.length === 0) {
    return (
      <div className="bg-slate-900 border border-industrial-border rounded-2xl p-6 shadow-xl text-center">
        <p className="text-sm text-slate-400">No equipment currently exhibiting early warning telemetry signals.</p>
      </div>
    );
  }

  return (
    <div className="bg-slate-900 border border-industrial-border rounded-2xl p-6 shadow-xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-white font-extrabold text-lg tracking-tight">Early Warning Signals</h3>
          <p className="text-xs text-slate-400 mt-0.5">Deteriorating telemetry patterns detected before failure events</p>
        </div>
        <span className="px-2.5 py-1 rounded text-[10px] font-bold uppercase font-mono bg-amber-500/10 text-amber-300 border border-amber-500/20">
          AI PREDICTED / ESTIMATED
        </span>
      </div>

      <div className="space-y-3">
        {earlyWarnings.slice(0, 5).map((item) => (
          <div
            key={item.id}
            className="bg-slate-950 border border-slate-800 rounded-xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
          >
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-extrabold text-white font-mono">{item.equipment_id}</span>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase font-mono bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  {item.early_warning_state}
                </span>
                <span className="text-xs text-slate-400 font-mono">({item.site_code})</span>
              </div>
              <p className="text-xs text-slate-300 mt-1">{item.reasons[0]}</p>
            </div>

            <div className="text-right font-mono text-xs shrink-0">
              <div className="text-slate-300 font-bold">Meter: {item.engine_hours} hrs</div>
              <div className="text-cat-400 font-bold mt-0.5">Risk Score: {item.risk_score}/100</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
