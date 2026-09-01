import React from 'react';
import { ShieldAlert, Bell } from 'lucide-react';

export const PredictiveAlertFeed = ({ alerts }) => {
  if (!alerts || alerts.length === 0) return null;

  return (
    <div className="bg-slate-900 border border-industrial-border rounded-2xl p-6 shadow-xl space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Bell className="w-5 h-5 text-amber-400" />
          <h3 className="text-white font-extrabold text-base tracking-tight">Deduplicated Predictive Alert Log</h3>
        </div>
        <span className="px-2.5 py-1 rounded text-[10px] font-bold uppercase font-mono bg-slate-800 text-slate-300">
          LIVE APPLICATION DATA
        </span>
      </div>

      <div className="space-y-2.5 font-mono text-xs max-h-60 overflow-y-auto">
        {alerts.slice(0, 6).map((a) => (
          <div
            key={a.id}
            className="p-3 bg-slate-950 rounded-xl border border-slate-800 flex items-center justify-between gap-4"
          >
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-white">{a.equipment_code}</span>
                <span className="px-2 py-0.5 rounded text-[9px] font-extrabold uppercase bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  {a.alert_type}
                </span>
              </div>
              <p className="text-[11px] text-slate-300 mt-0.5">{a.message}</p>
            </div>
            <span className="text-[10px] text-slate-500 shrink-0">{a.created_at ? new Date(a.created_at).toLocaleTimeString() : ''}</span>
          </div>
        ))}
      </div>
    </div>
  );
};
