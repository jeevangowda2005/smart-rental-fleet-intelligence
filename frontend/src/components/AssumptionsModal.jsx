import React from 'react';
import { X, Info, ShieldAlert } from 'lucide-react';

export const AssumptionsModal = ({ isOpen, onClose, config }) => {
  if (!isOpen || !config) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
      <div className="bg-slate-900 border border-industrial-border rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="p-5 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-cat-500/10 text-cat-400 border border-cat-500/30">
              <Info className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-white font-extrabold text-base">Business Intelligence Assumptions</h3>
              <p className="text-xs text-amber-400 font-mono mt-0.5">DEMO CONFIGURATION — NOT ACTUAL CUSTOMER COSTS</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4 text-xs font-mono text-slate-300">
          <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-amber-300">
            {config.disclaimer}
          </div>

          <div className="space-y-2.5">
            <div className="flex justify-between p-2.5 bg-slate-950 rounded-lg border border-slate-800">
              <span className="text-slate-400">Idle Cost Rate:</span>
              <span className="font-bold text-white">₹{config.idle_cost_per_hour} / hour</span>
            </div>

            <div className="flex justify-between p-2.5 bg-slate-950 rounded-lg border border-slate-800">
              <span className="text-slate-400">Operating Cost Rate:</span>
              <span className="font-bold text-white">₹{config.operating_cost_per_hour} / engine hour</span>
            </div>

            <div className="flex justify-between p-2.5 bg-slate-950 rounded-lg border border-slate-800">
              <span className="text-slate-400">Fuel Diesel Rate:</span>
              <span className="font-bold text-white">₹{config.fuel_cost_per_liter} / liter</span>
            </div>

            <div className="flex justify-between p-2.5 bg-slate-950 rounded-lg border border-slate-800">
              <span className="text-slate-400">Maintenance Accrual Rate:</span>
              <span className="font-bold text-white">₹{config.maintenance_cost_per_hour} / engine hour</span>
            </div>

            <div className="flex justify-between p-2.5 bg-slate-950 rounded-lg border border-slate-800">
              <span className="text-slate-400">CO₂ Emission Factor:</span>
              <span className="font-bold text-white">{config.co2_emission_factor_kg_per_l} kg CO₂ / liter</span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-950 border-t border-slate-800 text-right">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-cat-500 text-black font-extrabold rounded-xl hover:bg-cat-400 text-xs font-mono uppercase tracking-wider"
          >
            Close Assumptions
          </button>
        </div>
      </div>
    </div>
  );
};
