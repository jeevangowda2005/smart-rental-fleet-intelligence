import React from 'react';
import { Fuel, Leaf } from 'lucide-react';

export const FuelEfficiencyPanel = ({ fuelData }) => {
  if (!fuelData || !fuelData.fuel_analytics) return null;

  return (
    <div className="bg-slate-900 border border-industrial-border rounded-2xl p-6 shadow-xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-white font-extrabold text-lg tracking-tight">Fuel Efficiency & Sustainability</h3>
          <p className="text-xs text-slate-400 mt-0.5">Burn rate deviations vs category baselines & CO₂ emissions</p>
        </div>
        <span className="px-2.5 py-1 rounded text-[10px] font-bold uppercase font-mono bg-emerald-500/10 text-emerald-300 border border-emerald-500/20">
          ESTIMATED CO₂ — DEMONSTRATION MODEL
        </span>
      </div>

      {/* Summary KPI Pills */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
          <span className="text-[10px] font-bold text-slate-400 uppercase font-mono">Total Estimated Fleet CO₂</span>
          <div className="text-lg font-black text-white font-mono mt-0.5">{fuelData.total_fleet_co2_kg.toLocaleString()} kg</div>
        </div>

        <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
          <span className="text-[10px] font-bold text-slate-400 uppercase font-mono">CO₂ Idle Wasted</span>
          <div className="text-lg font-black text-amber-400 font-mono mt-0.5">{fuelData.total_idle_co2_wasted_kg.toLocaleString()} kg</div>
        </div>

        <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 col-span-2 sm:col-span-1">
          <span className="text-[10px] font-bold text-slate-400 uppercase font-mono">Fuel Attention Assets</span>
          <div className="text-lg font-black text-rose-400 font-mono mt-0.5">{fuelData.inefficient_count} Assets</div>
        </div>
      </div>

      {/* Analytics List */}
      <div className="space-y-3">
        {fuelData.fuel_analytics.slice(0, 5).map((item) => (
          <div
            key={item.id}
            className="bg-slate-950 border border-slate-800 rounded-xl p-3.5 flex items-center justify-between gap-4"
          >
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-extrabold text-white font-mono">{item.equipment_id}</span>
                <span className={`px-2 py-0.5 rounded text-[10px] font-bold font-mono uppercase ${
                  item.severity === 'WARNING'
                    ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                    : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                }`}>
                  {item.efficiency_status}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-1">{item.explanation}</p>
            </div>

            <div className="text-right font-mono">
              <div className="text-xs font-bold text-slate-200">
                {item.fuel_burn_rate_lph} L/hr <span className="text-slate-400 text-[10px]">(Baseline: {item.category_baseline_lph})</span>
              </div>
              <div className="text-[11px] text-emerald-400 mt-0.5">
                {item.total_estimated_co2_kg} kg CO₂
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
