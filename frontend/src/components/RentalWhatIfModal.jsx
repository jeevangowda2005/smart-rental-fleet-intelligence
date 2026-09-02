import React, { useState } from 'react';
import { Modal } from './Modal';
import { Scale, DollarSign, Fuel, Leaf, ShieldAlert, CheckCircle, ArrowRight, Sparkles } from 'lucide-react';
import { rentalService } from '../services/rentalService';
import { useToast } from '../context/ToastContext';

export const RentalWhatIfModal = ({ isOpen, onClose, rental }) => {
  const [simulationData, setSimulationData] = useState(null);
  const [loading, setLoading] = useState(false);
  const { addToast } = useToast();

  React.useEffect(() => {
    if (isOpen && rental) {
      runSimulation();
    } else {
      setSimulationData(null);
    }
  }, [isOpen, rental]);

  const runSimulation = async () => {
    if (!rental) return;
    setLoading(true);
    try {
      const res = await rentalService.simulateEarlyReturn(rental.id);
      setSimulationData(res);
    } catch (err) {
      addToast('Failed to execute What-If simulation', 'error');
    } finally {
      setLoading(false);
    }
  };

  if (!rental) return null;

  const sim = simulationData?.simulation_results || {};

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`What-If Early Return Simulator: ${rental.equipment_code}`}
      maxWidth="max-w-xl"
    >
      <div className="space-y-5">
        {/* Banner Alert */}
        <div className="p-3.5 bg-cat-500/10 border border-cat-500/40 rounded-xl flex items-center gap-3">
          <Scale className="w-6 h-6 text-cat-500 shrink-0" />
          <div className="text-xs">
            <strong className="text-cat-500 uppercase tracking-wider block font-mono">
              Decision Support What-If Analysis
            </strong>
            <span className="text-slate-300">
              Evaluating financial & capacity impact if <strong className="text-white font-mono">{rental.equipment_code}</strong> is returned <strong className="text-cat-500 font-mono">{rental.remaining_duration_days} days early</strong>.
            </span>
          </div>
        </div>

        {loading ? (
          <div className="p-8 text-center text-xs font-mono text-slate-400">
            Calculating telemetry & financial simulation...
          </div>
        ) : simulationData ? (
          <div className="space-y-4">
            {/* Savings & Impact Grid */}
            <div className="grid grid-cols-2 gap-3">
              <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl">
                <span className="text-[10px] text-slate-400 font-mono uppercase tracking-wider flex items-center gap-1">
                  <DollarSign className="w-3.5 h-3.5 text-emerald-400" />
                  Avoided Idle Cost
                </span>
                <div className="text-xl font-bold text-emerald-400 font-mono mt-1">
                  ${sim.avoided_idle_cost || 0}
                </div>
                <span className="text-[10px] text-slate-500 font-mono">
                  Saved over remaining {rental.remaining_duration_days} days
                </span>
              </div>

              <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl">
                <span className="text-[10px] text-slate-400 font-mono uppercase tracking-wider flex items-center gap-1">
                  <Fuel className="w-3.5 h-3.5 text-amber-400" />
                  Potential Fuel Saved
                </span>
                <div className="text-xl font-bold text-amber-400 font-mono mt-1">
                  {sim.potential_fuel_saved_liters || 0} Liters
                </div>
                <span className="text-[10px] text-slate-500 font-mono">
                  ~{sim.potential_co2_reduction_kg || 0} kg CO2 reduction
                </span>
              </div>
            </div>

            {/* Availability & Reallocation Impact */}
            <div className="p-4 bg-slate-900/90 border border-slate-800 rounded-xl space-y-2 text-xs font-mono">
              <div className="flex justify-between items-center pb-2 border-b border-slate-800">
                <span className="text-slate-400">Depot Fleet Availability:</span>
                <span className="text-cat-500 font-bold">{sim.availability_gained}</span>
              </div>

              <div className="flex justify-between items-center pt-1">
                <span className="text-slate-400">Fleet Capacity Score Impact:</span>
                <span className="text-emerald-400 font-bold">{sim.fleet_utilization_impact}</span>
              </div>

              {sim.reallocation_opportunity && (
                <div className="p-3 mt-2 bg-amber-950/30 border border-amber-500/30 rounded-lg text-slate-200">
                  <span className="text-[10px] text-amber-400 uppercase font-bold tracking-wider block mb-1">
                    Potential Reallocation Target:
                  </span>
                  Transfer to <strong className="text-white">{sim.reallocation_opportunity.site_name}</strong> ({sim.reallocation_opportunity.site_code}) — Predicted shortage of {sim.reallocation_opportunity.predicted_shortage} unit(s).
                </div>
              )}
            </div>

            {/* Verdict */}
            <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl flex items-center justify-between text-xs font-mono">
              <span className="text-slate-400">Simulation Verdict:</span>
              <span className={`px-2.5 py-0.5 rounded font-bold uppercase ${
                simulationData.verdict === 'RECOMMENDED'
                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                  : 'bg-slate-800 text-slate-300'
              }`}>
                {simulationData.verdict}
              </span>
            </div>

            {/* Explicit Non-Mutation Safety Notice */}
            <div className="p-3 bg-slate-900/40 border border-slate-800 rounded-lg text-[11px] font-mono text-slate-400">
              <ShieldAlert className="w-3.5 h-3.5 text-cat-500 inline mr-1.5" />
              {simulationData.safety_note}
            </div>
          </div>
        ) : null}

        {/* Footer Actions */}
        <div className="flex justify-end pt-4 border-t border-industrial-border">
          <button
            onClick={onClose}
            className="px-5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold uppercase rounded-lg transition"
          >
            Close Simulator
          </button>
        </div>
      </div>
    </Modal>
  );
};
