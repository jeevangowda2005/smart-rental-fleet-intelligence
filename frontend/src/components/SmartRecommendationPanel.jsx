import React, { useState } from 'react';
import { ArrowRight, TrendingUp, MapPin, Zap, ChevronRight, BarChart2 } from 'lucide-react';
import { WhatIfModal } from './WhatIfModal';

const ScoreBadge = ({ score }) => {
  const color = score >= 80 ? 'text-emerald-400' : score >= 60 ? 'text-amber-400' : 'text-slate-300';
  return <span className={`font-mono font-black text-2xl ${color}`}>{score}</span>;
};

export const SmartRecommendationPanel = ({ recommendations = [], sites = [] }) => {
  const [selectedRec, setSelectedRec] = useState(null);

  if (recommendations.length === 0) {
    return (
      <div className="bg-industrial-card border border-industrial-border rounded-2xl p-6 text-center text-slate-400 text-sm">
        <Zap className="w-8 h-8 text-slate-600 mx-auto mb-2" />
        <p>No reallocation recommendations at this time. Fleet assets are well distributed.</p>
        <p className="text-xs text-slate-500 mt-1 font-mono">AI PREDICTED / ESTIMATED</p>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-4">
        {recommendations.slice(0, 4).map((rec, idx) => (
          <div
            key={rec.equipment_id + rec.destination_site_code}
            className="bg-industrial-card border border-industrial-border rounded-2xl p-5 hover:border-cat-500/40 transition-all shadow-xl"
          >
            {/* Header row */}
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-7 h-7 rounded-full bg-cat-500/20 border border-cat-500/40 flex items-center justify-center text-cat-500 font-black text-xs shrink-0">
                  {idx + 1}
                </div>
                <div>
                  <div className="font-mono font-bold text-cat-500">{rec.equipment_id}</div>
                  <div className="text-xs text-slate-400">{rec.equipment_type} · {rec.model}</div>
                </div>
              </div>
              <div className="text-right shrink-0">
                <ScoreBadge score={rec.recommendation_score} />
                <div className="text-[10px] text-slate-500 font-mono mt-0.5">AI SCORE</div>
              </div>
            </div>

            {/* Route */}
            <div className="flex items-center gap-2 mt-3 px-1">
              <span className="flex items-center gap-1 text-xs font-mono bg-slate-800 px-2 py-1 rounded-lg text-slate-300">
                <MapPin className="w-3 h-3 text-slate-500" />
                {rec.current_site_code}
              </span>
              <ArrowRight className="w-4 h-4 text-cat-500 shrink-0" />
              <span className="flex items-center gap-1 text-xs font-mono bg-cat-500/20 border border-cat-500/30 px-2 py-1 rounded-lg text-cat-400 font-bold">
                <MapPin className="w-3 h-3" />
                {rec.destination_site_code}
              </span>
              <span className="ml-auto text-[11px] font-mono text-slate-500">{rec.distance_km} km</span>
            </div>

            {/* Metrics */}
            <div className="grid grid-cols-3 gap-3 mt-4">
              <div className="text-center bg-slate-900/60 rounded-xl p-2.5">
                <div className="text-sm font-mono font-bold text-slate-300">{rec.current_utilization}%</div>
                <div className="text-[10px] text-slate-500">Current Util.</div>
              </div>
              <div className="text-center bg-emerald-950/40 border border-emerald-500/20 rounded-xl p-2.5">
                <div className="text-sm font-mono font-bold text-emerald-400">{rec.estimated_utilization_after}%</div>
                <div className="text-[10px] text-emerald-500/70">Est. After</div>
              </div>
              <div className="text-center bg-amber-950/30 border border-amber-500/20 rounded-xl p-2.5">
                <div className="text-sm font-mono font-bold text-amber-400">{rec.destination_demand_level}</div>
                <div className="text-[10px] text-amber-500/70">Dest. Demand</div>
              </div>
            </div>

            {/* Reasons */}
            <div className="mt-4 pt-3 border-t border-industrial-border space-y-1">
              <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">WHY THIS RECOMMENDATION:</div>
              {rec.reasons.map((reason, i) => (
                <div key={i} className="flex items-start gap-1.5 text-[11px] text-slate-400">
                  <ChevronRight className="w-3 h-3 text-cat-500 shrink-0 mt-0.5" />
                  {reason}
                </div>
              ))}
            </div>

            {/* Actions */}
            <div className="flex gap-2 mt-4">
              <button
                onClick={() => setSelectedRec(rec)}
                className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-cat-500/10 hover:bg-cat-500/20 border border-cat-500/30 text-cat-400 text-xs font-bold transition"
              >
                <BarChart2 className="w-3.5 h-3.5" />
                RUN WHAT-IF
              </button>
              <div className="flex-1 flex items-center justify-center px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-slate-400 text-[10px] font-mono">
                Confidence: {rec.confidence}%
              </div>
            </div>

            <p className="text-[10px] text-slate-600 font-mono mt-2 text-center">
              AI PREDICTED / ESTIMATED · Decision support only · No records auto-modified
            </p>
          </div>
        ))}
      </div>

      {selectedRec && (
        <WhatIfModal
          recommendation={selectedRec}
          sites={sites}
          onClose={() => setSelectedRec(null)}
        />
      )}
    </>
  );
};
