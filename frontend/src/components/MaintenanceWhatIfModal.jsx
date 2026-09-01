import React, { useState } from 'react';
import { X, Wrench, ArrowRight, ShieldCheck, AlertCircle } from 'lucide-react';
import predictiveMaintenanceService from '../services/predictiveMaintenanceService';
import { useToast } from '../context/ToastContext';

export const MaintenanceWhatIfModal = ({ isOpen, onClose, equipmentList, defaultEquipment }) => {
  const [selectedEqId, setSelectedEqId] = useState(defaultEquipment ? defaultEquipment.id : (equipmentList[0]?.id || ''));
  const [loading, setLoading] = useState(false);
  const [simResult, setSimResult] = useState(null);
  const { addToast } = useToast();

  if (!isOpen) return null;

  const runSimulation = async () => {
    if (!selectedEqId) return;
    setLoading(true);
    try {
      const res = await predictiveMaintenanceService.runMaintenanceWhatIf(selectedEqId);
      setSimResult(res);
      addToast('Maintenance What-If simulation completed', 'success');
    } catch (e) {
      console.error(e);
      addToast('Error running maintenance simulation', 'error');
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (val) => `₹${val.toLocaleString()}`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
      <div className="bg-slate-900 border border-industrial-border rounded-2xl w-full max-w-xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="p-5 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-cat-500/10 text-cat-400 border border-cat-500/30">
              <Wrench className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-white font-extrabold text-base">Maintenance What-If Simulator</h3>
              <p className="text-xs text-amber-400 font-mono mt-0.5">AI PREDICTED / ESTIMATED — NON-MUTATING DECISION SUPPORT</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <div className="p-6 space-y-5">
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-300 uppercase font-mono">Select Target Asset to Service</label>
            <select
              value={selectedEqId}
              onChange={(e) => setSelectedEqId(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white font-mono focus:border-cat-500 focus:outline-none"
            >
              {equipmentList.map((eq) => (
                <option key={eq.id} value={eq.id}>
                  {eq.equipment_id} ({eq.model}) — Status: {eq.status}
                </option>
              ))}
            </select>
          </div>

          <button
            onClick={runSimulation}
            disabled={loading}
            className="w-full py-2.5 rounded-xl bg-cat-500 hover:bg-cat-400 text-black font-extrabold text-xs font-mono uppercase tracking-wider transition"
          >
            {loading ? 'Simulating Maintenance Impact...' : 'Simulate Immediate Maintenance'}
          </button>

          {/* Simulation Results */}
          {simResult && simResult.feasible && (
            <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 space-y-4 font-mono">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <span className="text-xs font-bold text-slate-300 uppercase">Simulation Verdict</span>
                <span className={`px-3 py-1 rounded text-xs font-black uppercase tracking-wider ${
                  simResult.verdict === 'RECOMMENDED'
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                    : 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                }`}>
                  {simResult.verdict} (Confidence: {simResult.confidence}%)
                </span>
              </div>

              {/* Before vs After Grid */}
              <div className="grid grid-cols-2 gap-4 text-xs">
                <div className="bg-slate-900/60 p-3 rounded-lg border border-slate-800 space-y-1.5">
                  <span className="text-[10px] font-bold text-amber-400 uppercase">BEFORE (CURRENT)</span>
                  <div>Risk Score: <strong className="text-rose-400">{simResult.before.risk_score}/100</strong></div>
                  <div>Downtime Exp: <strong className="text-slate-200">{simResult.before.estimated_downtime_exposure_hrs} hrs</strong></div>
                  <div>Cost Exp: <strong className="text-slate-200">{formatCurrency(simResult.before.estimated_cost_exposure)}</strong></div>
                </div>

                <div className="bg-slate-900/60 p-3 rounded-lg border border-slate-800 space-y-1.5">
                  <span className="text-[10px] font-bold text-emerald-400 uppercase">AFTER (SERVICED)</span>
                  <div>Risk Score: <strong className="text-emerald-400">{simResult.after.estimated_risk_score}/100</strong></div>
                  <div>Downtime Exp: <strong className="text-slate-200">{simResult.after.estimated_downtime_exposure_hrs} hrs</strong></div>
                  <div>Cost Exp: <strong className="text-slate-200">{formatCurrency(simResult.after.estimated_cost_exposure)}</strong></div>
                </div>
              </div>

              {/* Dynamic Impact Summary */}
              <div className="p-3 bg-emerald-950/20 border border-emerald-500/30 rounded-lg text-xs text-emerald-300 space-y-1">
                <div>• Risk Reduction: <strong>-{simResult.impact.risk_score_reduction_pts} points</strong></div>
                <div>• Downtime Hours Saved: <strong>+{simResult.impact.downtime_hours_saved} hours</strong></div>
                <div>• Potential Cost Savings: <strong>+{formatCurrency(simResult.impact.estimated_potential_cost_savings)}</strong></div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
