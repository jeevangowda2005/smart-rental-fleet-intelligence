import React, { useState } from 'react';
import { Filter } from 'lucide-react';

const SEVERITY_BADGE = {
  CRITICAL: 'bg-rose-500/20 text-rose-300 border-rose-500/40',
  HIGH: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
  WARNING: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/40',
  INFO: 'bg-slate-500/20 text-slate-300 border-slate-500/40',
};
const STATUS_BADGE = {
  NEW: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
  ACKNOWLEDGED: 'bg-slate-500/20 text-slate-300 border-slate-500/30',
  INVESTIGATING: 'bg-purple-500/20 text-purple-300 border-purple-500/30',
  ACTION_REQUIRED: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
  IN_PROGRESS: 'bg-cat-500/20 text-cat-400 border-cat-500/30',
  RESOLVED: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
  DISMISSED: 'bg-slate-700/20 text-slate-500 border-slate-600/30',
};

export const IncidentTable = ({ incidents, onSelect, filters, onFilterChange }) => {
  return (
    <div className="bg-slate-900 border border-industrial-border rounded-2xl shadow-xl overflow-hidden">
      {/* Filter bar */}
      <div className="p-4 border-b border-slate-800 flex flex-wrap gap-3 items-center">
        <div className="flex items-center gap-1.5 text-xs font-mono font-bold text-slate-400 uppercase">
          <Filter className="w-4 h-4" /> Filters:
        </div>
        {['severity', 'status', 'incident_type'].map(key => (
          <select
            key={key}
            value={filters[key] || ''}
            onChange={e => onFilterChange(key, e.target.value)}
            className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-300 font-mono focus:border-cat-500 focus:outline-none"
          >
            <option value="">{key === 'severity' ? 'All Severities' : key === 'status' ? 'All Statuses' : 'All Types'}</option>
            {key === 'severity' && ['CRITICAL','HIGH','WARNING','INFO'].map(v => <option key={v} value={v}>{v}</option>)}
            {key === 'status' && ['NEW','ACKNOWLEDGED','INVESTIGATING','ACTION_REQUIRED','IN_PROGRESS','RESOLVED','DISMISSED'].map(v => <option key={v} value={v}>{v}</option>)}
            {key === 'incident_type' && ['HIGH_MAINTENANCE_RISK','GEOFENCE_BREACH','OVERDUE_RENTAL','FUEL_ANOMALY','UTILIZATION_DEGRADATION'].map(v => <option key={v} value={v}>{v.replace(/_/g,' ')}</option>)}
          </select>
        ))}
        <span className="ml-auto text-xs font-mono text-slate-500">{incidents.length} incident(s)</span>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-xs font-mono text-left">
          <thead className="bg-slate-950 text-slate-400 uppercase tracking-wider">
            <tr>
              <th className="p-3 rounded-l-xl">Sev</th>
              <th className="p-3">ID</th>
              <th className="p-3">Equipment</th>
              <th className="p-3">Type</th>
              <th className="p-3 max-w-xs">Description</th>
              <th className="p-3">Status</th>
              <th className="p-3">Detected</th>
              <th className="p-3 rounded-r-xl">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800">
            {incidents.length === 0 && (
              <tr><td colSpan={8} className="p-6 text-center text-slate-400">No incidents match current filters.</td></tr>
            )}
            {incidents.map(inc => (
              <tr
                key={inc.id}
                onClick={() => onSelect(inc)}
                className="hover:bg-slate-800/40 cursor-pointer transition"
              >
                <td className="p-3">
                  <span className={`px-2 py-0.5 rounded text-[9px] font-extrabold uppercase border ${SEVERITY_BADGE[inc.severity] || SEVERITY_BADGE.INFO}`}>
                    {inc.severity}
                  </span>
                </td>
                <td className="p-3 text-slate-400">#{inc.id}</td>
                <td className="p-3 font-extrabold text-white">{inc.equipment_code}</td>
                <td className="p-3 text-slate-400 text-[10px]">{inc.incident_type?.replace(/_/g,' ')}</td>
                <td className="p-3 text-slate-300 max-w-xs truncate">{inc.description}</td>
                <td className="p-3">
                  <span className={`px-2 py-0.5 rounded text-[9px] font-extrabold uppercase border ${STATUS_BADGE[inc.status] || STATUS_BADGE.NEW}`}>
                    {inc.status}
                  </span>
                </td>
                <td className="p-3 text-slate-400">
                  {inc.detected_at ? new Date(inc.detected_at).toLocaleTimeString() : '—'}
                </td>
                <td className="p-3">
                  {inc.pending_actions?.length > 0 && (
                    <span className="px-2 py-0.5 rounded text-[9px] font-bold uppercase bg-cat-500/20 text-cat-400 border border-cat-500/30">
                      {inc.pending_actions.length} pending
                    </span>
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
