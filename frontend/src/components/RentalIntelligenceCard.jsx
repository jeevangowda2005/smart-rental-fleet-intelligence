import React from 'react';
import {
  Clock, Gauge, Fuel, AlertCircle, ArrowRight, Activity, Zap, CheckCircle2,
  TrendingDown, MapPin, User, HardHat, ShieldCheck, Sparkles, RefreshCw, Scale
} from 'lucide-react';
import { StatusBadge } from './StatusBadge';

export const RentalIntelligenceCard = ({
  rental,
  onSimulateWhatIf,
  onCheckinClick,
  onViewDetails,
  isOperator = false
}) => {
  if (!rental) return null;

  const earlyReturnOp = rental.early_return_opportunity;
  const progressPct = rental.progress_pct || 0;
  const utilPct = rental.utilization || 0;
  const plannedDays = rental.planned_duration_days || 0;
  const elapsedDays = rental.elapsed_duration_days || 0;
  const remainingDays = rental.remaining_duration_days || 0;

  return (
    <div className="bg-industrial-card border border-industrial-border rounded-2xl p-6 shadow-xl relative overflow-hidden space-y-6">
      {/* Accent Blur Background */}
      <div className="absolute top-0 right-0 w-64 h-64 bg-cat-500/5 rounded-full blur-3xl pointer-events-none" />

      {/* 1. Header & Rental Overview */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-industrial-border pb-5">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 bg-slate-900 border border-slate-700 text-cat-500 font-mono text-xs font-bold uppercase rounded-md">
              {rental.equipment_code}
            </span>
            <span className="text-xs font-mono text-slate-400 uppercase">
              Contract #{rental.id}
            </span>
            <StatusBadge status={rental.status} />
          </div>

          <h3 className="text-xl font-extrabold text-white mt-1.5 flex items-center gap-2">
            {rental.equipment_model}
            {rental.equipment_category && (
              <span className="text-xs font-normal text-slate-400 font-mono">
                ({rental.equipment_category})
              </span>
            )}
          </h3>

          <div className="flex flex-wrap items-center gap-4 text-xs text-slate-300 mt-2">
            <span className="flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5 text-cat-500" />
              {rental.site_name}
            </span>
            <span className="flex items-center gap-1.5">
              <User className="w-3.5 h-3.5 text-slate-400" />
              Operator: <strong className="text-white">{rental.operator_name}</strong>
            </span>
            <span className="flex items-center gap-1.5 font-mono text-slate-400">
              <Clock className="w-3.5 h-3.5 text-slate-400" />
              Checked Out: {new Date(rental.checkout_time).toLocaleDateString()}
            </span>
          </div>
        </div>

        {/* Header Action Controls */}
        <div className="flex items-center gap-2">
          {onViewDetails && (
            <button
              onClick={() => onViewDetails(rental)}
              className="px-3.5 py-2 bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-200 font-extrabold text-xs uppercase tracking-wider rounded-xl transition flex items-center gap-1.5"
            >
              <Activity className="w-3.5 h-3.5 text-cat-500" />
              Lifecycle Timeline
            </button>
          )}

          {!isOperator && onSimulateWhatIf && (
            <button
              onClick={() => onSimulateWhatIf(rental)}
              className="px-3.5 py-2 bg-cat-500/10 hover:bg-cat-500/20 border border-cat-500/40 text-cat-500 font-extrabold text-xs uppercase tracking-wider rounded-xl transition flex items-center gap-1.5 shadow-sm"
            >
              <Scale className="w-3.5 h-3.5" />
              What-If Simulation
            </button>
          )}
        </div>
      </div>

      {/* 2. Rental Progress Bar & Duration Metrics */}
      <div className="space-y-3">
        <div className="flex items-center justify-between text-xs uppercase font-mono font-semibold">
          <span className="text-slate-300 flex items-center gap-1.5">
            <Clock className="w-4 h-4 text-cat-500" />
            Rental Schedule Progress
          </span>
          <span className="text-slate-400">
            {elapsedDays} / {plannedDays} Days Elapsed ({progressPct}%)
          </span>
        </div>

        {/* Visual Progress Bar */}
        <div className="w-full h-3 bg-slate-900 border border-industrial-border rounded-full overflow-hidden flex">
          <div
            className="h-full bg-gradient-to-r from-cat-500 to-amber-500 transition-all duration-500"
            style={{ width: `${Math.min(100, progressPct)}%` }}
          />
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
          <div className="p-3 bg-slate-900/90 border border-slate-800 rounded-xl">
            <span className="text-[10px] text-slate-400 uppercase font-mono tracking-wider">Planned Rental</span>
            <div className="text-lg font-bold text-white font-mono mt-0.5">{plannedDays} Days</div>
          </div>
          <div className="p-3 bg-slate-900/90 border border-slate-800 rounded-xl">
            <span className="text-[10px] text-slate-400 uppercase font-mono tracking-wider">Elapsed Time</span>
            <div className="text-lg font-bold text-slate-200 font-mono mt-0.5">{elapsedDays} Days</div>
          </div>
          <div className="p-3 bg-slate-900/90 border border-slate-800 rounded-xl">
            <span className="text-[10px] text-slate-400 uppercase font-mono tracking-wider">Remaining Period</span>
            <div className="text-lg font-bold text-cat-500 font-mono mt-0.5">{remainingDays} Days</div>
          </div>
          <div className="p-3 bg-slate-900/90 border border-slate-800 rounded-xl">
            <span className="text-[10px] text-slate-400 uppercase font-mono tracking-wider">Rental Utilization</span>
            <div className="text-lg font-bold text-emerald-400 font-mono mt-0.5">{utilPct}%</div>
          </div>
        </div>
      </div>

      {/* 3. Live Telemetry & Machine Health Status */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-1">
        <div className="p-3.5 bg-slate-900/70 border border-slate-800 rounded-xl flex items-center justify-between">
          <div>
            <span className="text-[10px] text-slate-400 uppercase font-mono">Engine Meter</span>
            <div className="text-base font-bold text-white font-mono mt-0.5">{rental.engine_hours || 0} hrs</div>
          </div>
          <Gauge className="w-5 h-5 text-slate-500" />
        </div>

        <div className="p-3.5 bg-slate-900/70 border border-slate-800 rounded-xl flex items-center justify-between">
          <div>
            <span className="text-[10px] text-slate-400 uppercase font-mono">Operating / Idle</span>
            <div className="text-base font-bold text-amber-400 font-mono mt-0.5">
              {rental.operating_hours || 0}h / {rental.idle_hours || 0}h
            </div>
          </div>
          <Clock className="w-5 h-5 text-amber-500/80" />
        </div>

        <div className="p-3.5 bg-slate-900/70 border border-slate-800 rounded-xl flex items-center justify-between">
          <div>
            <span className="text-[10px] text-slate-400 uppercase font-mono">Fuel Consumption</span>
            <div className="text-base font-bold text-white font-mono mt-0.5">{rental.fuel_usage || 0} L/hr</div>
          </div>
          <Fuel className="w-5 h-5 text-slate-500" />
        </div>

        <div className="p-3.5 bg-slate-900/70 border border-slate-800 rounded-xl flex items-center justify-between">
          <div>
            <span className="text-[10px] text-slate-400 uppercase font-mono">Health Score</span>
            <div className="text-base font-bold text-emerald-400 font-mono mt-0.5">
              {rental.health_score || 100}% ({rental.health_status || 'HEALTHY'})
            </div>
          </div>
          <ShieldCheck className="w-5 h-5 text-emerald-500" />
        </div>
      </div>

      {/* 4. AI Early Return Opportunity & Decision Support Guidance */}
      {earlyReturnOp ? (
        <div className="p-5 bg-gradient-to-br from-amber-950/40 via-slate-900 to-slate-900 border border-amber-500/40 rounded-xl space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-amber-500/20 text-amber-400 rounded-lg">
                <Sparkles className="w-5 h-5" />
              </div>
              <div>
                <span className="text-xs font-mono font-bold uppercase text-amber-400 tracking-wider flex items-center gap-1.5">
                  {earlyReturnOp.title}
                </span>
                <p className="text-xs text-slate-200 mt-0.5 leading-relaxed">
                  {earlyReturnOp.evidence_summary}
                </p>
              </div>
            </div>

            <span className="px-2.5 py-1 bg-amber-500/20 border border-amber-500/40 text-amber-300 text-[10px] font-mono font-bold uppercase rounded-md shrink-0">
              {remainingDays} Days Unused
            </span>
          </div>

          {/* Evidence Details */}
          {earlyReturnOp.evidence_reasons && earlyReturnOp.evidence_reasons.length > 0 && (
            <div className="p-3 bg-slate-950/60 border border-amber-500/20 rounded-lg text-xs space-y-1 font-mono text-slate-300">
              <span className="text-[10px] text-amber-400 uppercase font-bold tracking-wider block mb-1">
                Telemetry Evidence Signals:
              </span>
              {earlyReturnOp.evidence_reasons.map((reason, idx) => (
                <div key={idx} className="flex items-center gap-1.5 text-slate-300">
                  <span className="text-amber-500">•</span>
                  <span>{reason}</span>
                </div>
              ))}
            </div>
          )}

          {/* Manager Action Options vs Operator Guidance */}
          {!isOperator ? (
            <div className="pt-2 flex flex-wrap items-center gap-3">
              {onSimulateWhatIf && (
                <button
                  onClick={() => onSimulateWhatIf(rental)}
                  className="px-4 py-2 bg-cat-500 hover:bg-cat-600 text-black font-extrabold text-xs uppercase tracking-wider rounded-lg shadow transition flex items-center gap-1.5"
                >
                  <Scale className="w-4 h-4" />
                  Simulate Early Return Savings
                </button>
              )}

              {onCheckinClick && (
                <button
                  onClick={() => onCheckinClick(rental)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-white font-extrabold text-xs uppercase tracking-wider rounded-lg transition flex items-center gap-1.5"
                >
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  Return Early & Release
                </button>
              )}
            </div>
          ) : (
            <div className="p-3 bg-blue-950/40 border border-blue-500/30 rounded-lg text-xs text-blue-200 font-mono">
              <span className="font-bold text-blue-400 uppercase block mb-0.5">Operator Informational Guidance:</span>
              {earlyReturnOp.operator_guidance}
            </div>
          )}
        </div>
      ) : (
        <div className="p-3 bg-slate-900/60 border border-slate-800 rounded-xl text-xs text-slate-400 font-mono flex items-center justify-between">
          <span className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            Active rental contract operating within standard utilization thresholds.
          </span>
          <span className="text-[10px] uppercase text-slate-500">AI Intelligence Active</span>
        </div>
      )}
    </div>
  );
};
