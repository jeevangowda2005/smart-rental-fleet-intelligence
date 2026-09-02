import React from 'react';
import { Modal } from './Modal';
import { Clock, MapPin, User, CheckCircle, AlertTriangle, Shield, Gauge, Fuel, Activity, Sparkles } from 'lucide-react';
import { StatusBadge } from './StatusBadge';

export const RentalDetailModal = ({ isOpen, onClose, rental }) => {
  if (!rental) return null;

  const stages = rental.lifecycle_stages || [];

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Rental Contract Lifecycle: ${rental.equipment_code}`}
      maxWidth="max-w-2xl"
    >
      <div className="space-y-6">
        {/* Machine & Contract Quick Info */}
        <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <span className="font-mono text-cat-500 font-bold text-sm">{rental.equipment_code}</span>
              <h3 className="text-base font-extrabold text-white">{rental.equipment_model}</h3>
            </div>
            <StatusBadge status={rental.status} />
          </div>

          <div className="grid grid-cols-2 gap-3 pt-2 text-xs font-mono border-t border-slate-800 text-slate-300">
            <div><span className="text-slate-400">Site Location:</span> <strong className="text-white">{rental.site_name}</strong></div>
            <div><span className="text-slate-400">Assigned Operator:</span> <strong className="text-white">{rental.operator_name}</strong></div>
            <div><span className="text-slate-400">Planned Duration:</span> <strong className="text-cat-500">{rental.planned_duration_days} Days</strong></div>
            <div><span className="text-slate-400">Current Utilization:</span> <strong className="text-emerald-400">{rental.utilization}%</strong></div>
          </div>
        </div>

        {/* 7-Stage Complete Lifecycle Timeline */}
        <div className="space-y-3">
          <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
            <Activity className="w-4 h-4 text-cat-500" />
            Complete Rental Lifecycle & Telematics Timeline
          </h4>

          <div className="relative pl-6 space-y-6 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-800">
            {stages.map((stg, idx) => {
              const isCompleted = stg.stage === 'CHECK-IN' && rental.actual_return_time;
              const isActiveStage = ['CURRENT USAGE', 'CURRENT TELEMETRY', 'RENTAL PROGRESS', 'AI INSIGHTS'].includes(stg.stage);

              return (
                <div key={idx} className="relative flex items-start gap-4">
                  {/* Timeline Dot */}
                  <div className={`absolute -left-6 top-1.5 w-5 h-5 rounded-full border-2 flex items-center justify-center text-[10px] font-bold font-mono ${
                    isCompleted
                      ? 'bg-emerald-500 border-emerald-400 text-black'
                      : isActiveStage
                      ? 'bg-cat-500 border-cat-400 text-black'
                      : 'bg-slate-900 border-slate-700 text-slate-400'
                  }`}>
                    {idx + 1}
                  </div>

                  {/* Stage Details Card */}
                  <div className="flex-1 p-3.5 bg-slate-900/80 border border-slate-800 rounded-xl space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-mono font-bold text-cat-500 uppercase tracking-wider">
                        {stg.stage}: {stg.title}
                      </span>
                      {stg.timestamp && (
                        <span className="text-[10px] font-mono text-slate-400">
                          {new Date(stg.timestamp).toLocaleString()}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-300 font-mono leading-relaxed">
                      {stg.details}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="flex justify-end pt-4 border-t border-industrial-border">
          <button
            onClick={onClose}
            className="px-5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold uppercase rounded-lg transition"
          >
            Close Detail View
          </button>
        </div>
      </div>
    </Modal>
  );
};
