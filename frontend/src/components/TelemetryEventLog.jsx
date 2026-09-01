import React from 'react';
import { Activity, Radio, Clock } from 'lucide-react';
import { StatusBadge } from './StatusBadge';

export const TelemetryEventLog = ({ events = [] }) => {
  return (
    <div className="bg-industrial-card border border-industrial-border rounded-2xl p-5 shadow-xl flex flex-col h-[450px]">
      <div className="flex items-center justify-between pb-3 border-b border-industrial-border">
        <div className="flex items-center gap-2">
          <Radio className="w-4 h-4 text-cat-500 animate-pulse" />
          <h3 className="text-sm font-bold text-white uppercase tracking-wider">Live Telemetry Feed</h3>
        </div>
        <span className="text-[10px] text-slate-400 font-mono">Stream Log</span>
      </div>

      <div className="flex-1 overflow-y-auto pt-3 space-y-2.5 font-mono text-xs">
        {events.length > 0 ? (
          events.map((evt) => (
            <div
              key={evt.id}
              className="p-2.5 rounded-xl bg-slate-900/80 border border-slate-800/80 flex items-start gap-3 hover:border-slate-700 transition"
            >
              <div className="p-1 rounded bg-slate-800 text-cat-500 font-bold shrink-0 text-[10px]">
                {evt.timestamp}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-white">{evt.equipment_id}</span>
                  {evt.status && <StatusBadge status={evt.status} />}
                </div>
                <p className="text-slate-300 text-[11px] mt-0.5 truncate">{evt.message}</p>
              </div>
            </div>
          ))
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-center text-slate-500">
            <Activity className="w-8 h-8 text-slate-600 mb-2 animate-pulse" />
            <p className="text-xs">Listening for incoming IoT telemetry frames...</p>
          </div>
        )}
      </div>
    </div>
  );
};
