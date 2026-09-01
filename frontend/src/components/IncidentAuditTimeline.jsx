import React from 'react';
import { History, ShieldCheck, UserCheck, Activity } from 'lucide-react';

export const IncidentAuditTimeline = ({ auditLogs = [] }) => {
  if (!auditLogs || auditLogs.length === 0) {
    return (
      <div className="p-4 bg-slate-900 rounded-xl border border-slate-800 text-slate-500 font-mono text-xs text-center">
        No audit log history recorded yet.
      </div>
    );
  }

  return (
    <div className="space-y-3 font-mono">
      <div className="flex items-center gap-2 text-xs font-bold text-slate-400 uppercase tracking-wider">
        <History className="w-4 h-4 text-cat-400" /> Immutable Incident Audit History
      </div>
      <div className="relative pl-5 border-l-2 border-slate-800 space-y-3">
        {auditLogs.map((log) => (
          <div key={log.id} className="relative bg-slate-900 rounded-xl p-3.5 border border-slate-800 shadow-md">
            <div className="absolute -left-[27px] top-4 w-3.5 h-3.5 rounded-full bg-slate-800 border-2 border-cat-500 flex items-center justify-center">
              <div className="w-1.5 h-1.5 rounded-full bg-cat-400" />
            </div>
            <div className="flex items-center justify-between gap-2 mb-1">
              <span className="text-xs font-black text-white uppercase tracking-tight flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" /> {log.action}
              </span>
              <span className="text-[10px] text-slate-500 font-bold">
                {log.timestamp ? new Date(log.timestamp).toLocaleString() : ''}
              </span>
            </div>
            <p className="text-xs text-slate-300 mb-2 leading-relaxed">{log.reason}</p>
            <div className="flex flex-wrap items-center justify-between text-[10px] text-slate-400 pt-2 border-t border-slate-800/80">
              <span className="flex items-center gap-1">
                <UserCheck className="w-3 h-3 text-cat-400" /> {log.user_name} ({log.role})
              </span>
              {log.previous_state && log.new_state && (
                <span className="bg-slate-950 px-2 py-0.5 rounded border border-slate-800 text-slate-400 font-bold">
                  {log.previous_state} → <span className="text-cat-400">{log.new_state}</span>
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default IncidentAuditTimeline;
