import React from 'react';
import { DollarSign, Clock, Fuel, Wrench } from 'lucide-react';

export const CostImpactPanel = ({ costsData, idleData }) => {
  if (!costsData || !costsData.asset_costs) return null;

  const formatCurrency = (val) => `₹${val.toLocaleString()}`;

  return (
    <div className="bg-slate-900 border border-industrial-border rounded-2xl p-6 shadow-xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-white font-extrabold text-lg tracking-tight">Fleet Cost & Idle Impact</h3>
          <p className="text-xs text-slate-400 mt-0.5">Asset-level operating vs idle cost breakdown</p>
        </div>
        <span className="px-2.5 py-1 rounded text-[10px] font-bold uppercase font-mono bg-amber-500/10 text-amber-300 border border-amber-500/20">
          ESTIMATED COST — DEMO DATA
        </span>
      </div>

      {/* High Idle Risk Callout Banner */}
      {idleData && idleData.total_potential_idle_saving > 0 && (
        <div className="p-4 rounded-xl bg-amber-950/30 border border-amber-500/30 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-amber-500/20 text-amber-400">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <span className="text-xs font-bold text-amber-300 uppercase font-mono">Idle Cost Reduction Opportunity</span>
              <p className="text-xs text-slate-300 mt-0.5">
                Total Fleet Idle Cost: <strong className="text-white font-mono">{formatCurrency(idleData.total_fleet_idle_cost)}</strong>.
                Reducing idle to baseline yields an estimated potential saving of <strong className="text-emerald-400 font-mono">{formatCurrency(idleData.total_potential_idle_saving)}</strong>.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Asset Cost Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs font-mono">
          <thead className="bg-slate-950 text-slate-400 uppercase tracking-wider">
            <tr>
              <th className="p-3 rounded-l-xl">Asset ID</th>
              <th className="p-3">Type</th>
              <th className="p-3">Site</th>
              <th className="p-3 text-right">Op Cost (₹)</th>
              <th className="p-3 text-right">Idle Cost (₹)</th>
              <th className="p-3 text-right">Fuel Cost (₹)</th>
              <th className="p-3 text-right">Maint Cost (₹)</th>
              <th className="p-3 text-right rounded-r-xl">Total Cost (₹)</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800 text-slate-300">
            {costsData.asset_costs.slice(0, 7).map((asset) => (
              <tr key={asset.id} className="hover:bg-slate-800/40 transition">
                <td className="p-3 font-extrabold text-white">{asset.equipment_id}</td>
                <td className="p-3 text-slate-400">{asset.equipment_type}</td>
                <td className="p-3 text-slate-400">{asset.site_code}</td>
                <td className="p-3 text-right text-slate-300">{formatCurrency(asset.estimated_operating_cost)}</td>
                <td className="p-3 text-right text-amber-400 font-bold">{formatCurrency(asset.estimated_idle_cost)}</td>
                <td className="p-3 text-right text-slate-300">{formatCurrency(asset.estimated_fuel_cost)}</td>
                <td className="p-3 text-right text-slate-300">{formatCurrency(asset.estimated_maintenance_cost)}</td>
                <td className="p-3 text-right text-cat-400 font-extrabold">{formatCurrency(asset.total_estimated_cost)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
