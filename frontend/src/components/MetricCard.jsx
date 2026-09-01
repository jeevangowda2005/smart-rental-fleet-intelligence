import React from 'react';

export const MetricCard = ({ title, value, unit, subtitle, icon: Icon, trend, trendType = 'neutral' }) => {
  return (
    <div className="bg-industrial-card border border-industrial-border rounded-xl p-5 shadow-lg relative overflow-hidden group hover:border-slate-700 transition duration-200">
      {/* Background Amber Glow Accent */}
      <div className="absolute top-0 right-0 w-24 h-24 bg-cat-500/5 rounded-full blur-2xl group-hover:bg-cat-500/10 transition" />
      
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">{title}</span>
        {Icon && (
          <div className="p-2.5 rounded-lg bg-slate-900/80 border border-slate-800 text-cat-500">
            <Icon className="w-5 h-5" />
          </div>
        )}
      </div>

      <div className="flex items-baseline gap-2">
        <span className="text-3xl font-extrabold text-white tracking-tight font-mono">{value}</span>
        {unit && <span className="text-sm font-medium text-slate-400">{unit}</span>}
      </div>

      {(subtitle || trend) && (
        <div className="mt-3 flex items-center justify-between text-xs pt-3 border-t border-slate-800/60">
          {subtitle && <span className="text-slate-400 font-medium">{subtitle}</span>}
          {trend && (
            <span
              className={`font-semibold ${
                trendType === 'positive'
                  ? 'text-emerald-400'
                  : trendType === 'negative'
                  ? 'text-rose-400'
                  : 'text-slate-400'
              }`}
            >
              {trend}
            </span>
          )}
        </div>
      )}
    </div>
  );
};
