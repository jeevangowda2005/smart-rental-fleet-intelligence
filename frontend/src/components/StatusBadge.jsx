import React from 'react';

export const StatusBadge = ({ status }) => {
  const getStyle = (s) => {
    switch (s?.toUpperCase()) {
      case 'AVAILABLE':
        return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30';
      case 'ACTIVE':
      case 'COMPLETED':
        return 'bg-blue-500/10 text-blue-400 border-blue-500/30';
      case 'RENTED':
        return 'bg-indigo-500/10 text-indigo-400 border-indigo-500/30';
      case 'IDLE':
        return 'bg-amber-500/10 text-amber-400 border-amber-500/30';
      case 'OVERDUE':
      case 'CRITICAL':
        return 'bg-rose-500/10 text-rose-400 border-rose-500/30 animate-pulse';
      case 'MAINTENANCE':
      case 'WARNING':
        return 'bg-orange-500/10 text-orange-400 border-orange-500/30';
      default:
        return 'bg-slate-500/10 text-slate-400 border-slate-500/30';
    }
  };

  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${getStyle(
        status
      )} uppercase tracking-wider`}
    >
      <span className="w-1.5 h-1.5 rounded-full bg-current mr-1.5 opacity-80" />
      {status || 'UNKNOWN'}
    </span>
  );
};
