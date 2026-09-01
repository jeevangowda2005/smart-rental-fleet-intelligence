import React from 'react';
import { Target, ArrowRight, ShieldAlert, Sparkles } from 'lucide-react';

export const OptimizationOpportunityPanel = ({ opportunities, onSelectWhatIf }) => {
  if (!opportunities || opportunities.length === 0) {
    return (
      <div className="bg-slate-900 border border-industrial-border rounded-2xl p-6 shadow-xl text-center">
        <p className="text-sm text-slate-400">All fleet operations are currently performing within optimal parameters.</p>
      </div>
    );
  }

  const formatCurrency = (val) => `₹${val.toLocaleString()}`;

  return (
    <div className="bg-slate-900 border border-industrial-border rounded-2xl p-6 shadow-xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-white font-extrabold text-lg tracking-tight">Top Fleet Optimization Opportunities</h3>
          <p className="text-xs text-slate-400 mt-0.5">Ranked actions by 0–100 optimization opportunity score</p>
        </div>
        <span className="px-2.5 py-1 rounded text-[10px] font-bold uppercase font-mono bg-cat-500/10 text-cat-400 border border-cat-500/20">
          AI ESTIMATED IMPROVEMENT
        </span>
      </div>

      <div className="space-y-4">
        {opportunities.slice(0, 5).map((opp, index) => (
          <div
            key={opp.id || index}
            className="bg-slate-950 border border-slate-800 rounded-xl p-4 hover:border-slate-700 transition space-y-3"
          >
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-cat-500/10 border border-cat-500/30 flex items-center justify-center text-cat-400 font-mono font-bold text-sm">
                  #{index + 1}
                </div>
                <div>
                  <h4 className="text-white font-bold text-sm">{opp.title}</h4>
                  <span className="text-[11px] text-slate-400 font-mono">Category: {opp.category}</span>
                </div>
              </div>

              <div className="flex items-center gap-4">
                <div className="text-right">
                  <div className="text-xs font-mono font-extrabold text-emerald-400">
                    +{formatCurrency(opp.estimated_financial_saving)}
                  </div>
                  <div className="text-[10px] text-slate-400 font-mono">Est. Optimization Value</div>
                </div>

                <div className="px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-700 text-center font-mono">
                  <span className="text-xs font-black text-cat-400">{opp.score}</span>
                  <span className="text-[9px] block text-slate-400">SCORE</span>
                </div>
              </div>
            </div>

            <p className="text-xs text-slate-300 bg-slate-900/60 p-2.5 rounded-lg border border-slate-800/80">
              <strong className="text-amber-300 uppercase font-mono text-[10px]">Problem:</strong> {opp.problem}
            </p>

            <div className="flex items-center justify-between pt-1">
              <div className="text-[11px] text-slate-400 font-mono">
                Recommended Action: <strong className="text-cat-400">{opp.recommended_action}</strong>
              </div>

              {onSelectWhatIf && opp.equipment_id && (
                <button
                  onClick={() => onSelectWhatIf(opp)}
                  className="flex items-center gap-1 text-[11px] font-bold text-cat-400 hover:text-cat-300 font-mono uppercase tracking-wider"
                >
                  Simulate Business Impact <ArrowRight className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
