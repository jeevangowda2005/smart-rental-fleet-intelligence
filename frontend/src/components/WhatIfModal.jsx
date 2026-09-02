import React, { useState } from 'react';
import { X, ArrowRight, TrendingUp, AlertTriangle, CheckCircle, Minus, Loader2 } from 'lucide-react';
import { aiService } from '../services/aiService';
import { siteService } from '../services/siteService';

const VerdictBadge = ({ verdict }) => {
  const config = {
    RECOMMENDED: { color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30', icon: CheckCircle },
    NEUTRAL: { color: 'text-amber-400 bg-amber-500/10 border-amber-500/30', icon: Minus },
    'NOT RECOMMENDED': { color: 'text-rose-400 bg-rose-500/10 border-rose-500/30', icon: AlertTriangle },
  };
  const c = config[verdict] || config['NEUTRAL'];
  const Icon = c.icon;
  return (
    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-bold border ${c.color}`}>
      <Icon className="w-3.5 h-3.5" />
      {verdict}
    </span>
  );
};

export const WhatIfModal = ({ recommendation, sites, sitesList, isOpen, onClose }) => {
  const effectiveSites = sites || sitesList || [];
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [selectedSiteId, setSelectedSiteId] = useState('');

  useEffect(() => {
    if (recommendation && effectiveSites.length > 0) {
      const match = effectiveSites.find(s => s.site_code === recommendation.destination_site_code);
      if (match) {
        setSelectedSiteId(match.id);
      } else {
        const available = effectiveSites.filter(s => s.id !== recommendation.current_site_id);
        if (available.length > 0) setSelectedSiteId(available[0].id);
      }
    }
  }, [recommendation, effectiveSites]);

  const runSimulation = async () => {
    if (!selectedSiteId || (!recommendation?.equipment_db_id && !recommendation?.id)) return;
    const eqId = recommendation.equipment_db_id || recommendation.id;
    setLoading(true);
    try {
      const data = await aiService.runWhatIf(eqId, parseInt(selectedSiteId));
      setResult(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  if (isOpen === false) return null;
  if (!recommendation) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-slate-900 border border-industrial-border rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-industrial-border">
          <div>
            <h2 className="text-white font-bold text-lg tracking-tight">What-If Simulation</h2>
            <p className="text-xs text-amber-400 font-mono mt-0.5">AI PREDICTED / ESTIMATED — SIMULATION ONLY. NO RECORDS MODIFIED.</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-slate-800 text-slate-400 hover:text-white transition">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-5">
          {/* Move Details */}
          <div className="bg-slate-800/60 border border-industrial-border rounded-xl p-4">
            <div className="flex items-center gap-3">
              <span className="font-mono font-bold text-cat-500 text-sm">{recommendation.equipment_id}</span>
              <span className="text-slate-400 text-xs">{recommendation.equipment_type}</span>
            </div>
            <div className="flex items-center gap-3 mt-3">
              <span className="px-2 py-1 rounded-lg text-xs font-mono bg-slate-700 text-slate-300">
                {recommendation.current_site_code || 'DEPOT'}
              </span>
              <ArrowRight className="w-4 h-4 text-cat-500" />
              <select
                value={selectedSiteId}
                onChange={e => setSelectedSiteId(e.target.value)}
                className="bg-slate-700 border border-slate-600 text-white text-xs font-mono rounded-lg px-2 py-1"
              >
                {effectiveSites.filter(s => s.id !== recommendation.current_site_id).map(s => (
                  <option key={s.id} value={s.id}>{s.site_code} — {s.site_name}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Run button */}
          <button
            onClick={runSimulation}
            disabled={loading || !selectedSiteId}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-cat-500 hover:bg-cat-600 text-black font-bold text-sm transition disabled:opacity-50"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <TrendingUp className="w-4 h-4" />}
            {loading ? 'Running Simulation...' : 'Run What-If Simulation'}
          </button>

          {/* Results */}
          {result && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-white font-bold text-sm uppercase tracking-wider">Simulation Results</h3>
                <VerdictBadge verdict={result.verdict} />
              </div>

              {!result.feasible ? (
                <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-sm">
                  {result.reason}
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    {/* Before */}
                    <div className="bg-slate-800/60 border border-slate-700 rounded-xl p-4 space-y-2">
                      <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">BEFORE</div>
                      <div className="text-2xl font-mono font-black text-slate-200">{result.before.utilization}%</div>
                      <div className="text-xs text-slate-400">Utilization</div>
                      <div className="space-y-1 text-xs pt-2 border-t border-slate-700">
                        <div className="flex justify-between"><span className="text-slate-500">Demand Coverage</span><span className="text-slate-300">{result.before.demand_coverage_pct}%</span></div>
                        <div className="flex justify-between"><span className="text-slate-500">Idle Ratio</span><span className="text-slate-300">{result.before.idle_ratio_pct}%</span></div>
                        <div className="flex justify-between"><span className="text-slate-500">Supply at Dest.</span><span className="text-slate-300">{result.before.supply_at_destination} units</span></div>
                      </div>
                    </div>

                    {/* After */}
                    <div className="bg-emerald-950/40 border border-emerald-500/30 rounded-xl p-4 space-y-2">
                      <div className="text-xs font-bold text-emerald-400 uppercase tracking-wider">AFTER (ESTIMATED)</div>
                      <div className="text-2xl font-mono font-black text-emerald-400">{result.after.estimated_utilization}%</div>
                      <div className="text-xs text-emerald-300">Estimated Utilization</div>
                      <div className="space-y-1 text-xs pt-2 border-t border-emerald-500/20">
                        <div className="flex justify-between"><span className="text-emerald-500/80">Demand Coverage</span><span className="text-emerald-300">{result.after.estimated_demand_coverage_pct}%</span></div>
                        <div className="flex justify-between"><span className="text-emerald-500/80">Idle Ratio</span><span className="text-emerald-300">{result.after.estimated_idle_ratio_pct}%</span></div>
                        <div className="flex justify-between"><span className="text-emerald-500/80">Supply at Dest.</span><span className="text-emerald-300">{result.after.supply_at_destination} units</span></div>
                        <div className="flex justify-between"><span className="text-emerald-500/80">Idle Reduction</span><span className="text-emerald-300">−{result.after.idle_reduction_pct}%</span></div>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-3 text-center">
                    <div className="bg-slate-800 rounded-xl p-3">
                      <div className="text-emerald-400 font-mono font-bold text-lg">+{result.utilization_improvement}%</div>
                      <div className="text-xs text-slate-400">Utilization Boost</div>
                    </div>
                    <div className="bg-slate-800 rounded-xl p-3">
                      <div className="text-cat-500 font-mono font-bold text-lg">{result.confidence}%</div>
                      <div className="text-xs text-slate-400">Confidence</div>
                    </div>
                    <div className="bg-slate-800 rounded-xl p-3">
                      <div className="text-slate-300 font-mono font-bold text-lg">{result.distance_km} km</div>
                      <div className="text-xs text-slate-400">Travel Distance</div>
                    </div>
                  </div>

                  <p className="text-[11px] text-slate-500 font-mono text-center">
                    {result.safety_note}
                  </p>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
