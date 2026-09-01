import React, { useState } from 'react';
import { Check, X } from 'lucide-react';
import { incidentService } from '../services/incidentService';
import { useToast } from '../context/ToastContext';

export const IncidentActionPanel = ({ incident, onRefresh }) => {
  const { success, error: showError } = useToast();
  const [loading, setLoading] = useState(false);
  const [rejReason, setRejReason] = useState('');
  const [rejectingId, setRejectingId] = useState(null);

  if (!incident?.pending_actions || incident.pending_actions.length === 0) {
    return null;
  }

  const handleApprove = async (actionId) => {
    setLoading(true);
    try {
      const res = await incidentService.approveAction(incident.id, actionId);
      success(res.detail || 'Action approved and executed.');
      if (onRefresh) onRefresh();
    } catch (err) {
      showError('Action approval failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleReject = async (actionId) => {
    setLoading(true);
    try {
      await incidentService.rejectAction(incident.id, actionId, rejReason || 'Manager rejected action.');
      success('Action rejected.');
      setRejectingId(null);
      setRejReason('');
      if (onRefresh) onRefresh();
    } catch (err) {
      showError('Action rejection failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-amber-500/10 rounded-xl p-4 border border-amber-500/30 font-mono">
      <div className="text-amber-400 font-extrabold text-[10px] uppercase tracking-wider mb-2 flex items-center justify-between">
        <span>MANAGER APPROVAL REQUIRED</span>
        <span className="text-[9px] bg-amber-500/20 px-2 py-0.5 rounded text-amber-300">
          {incident.pending_actions.length} Pending
        </span>
      </div>
      <div className="space-y-3">
        {incident.pending_actions.map(action => (
          <div key={action.id} className="bg-slate-900 rounded-lg p-3 border border-slate-700">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-bold text-white uppercase">{action.action_type.replace(/_/g, ' ')}</span>
              <span className="text-[9px] text-amber-400 bg-amber-400/10 px-1.5 py-0.5 rounded">PENDING</span>
            </div>
            <p className="text-[10px] text-slate-400 mb-3">{action.description}</p>

            {rejectingId === action.id ? (
              <div className="space-y-2">
                <textarea
                  value={rejReason}
                  onChange={e => setRejReason(e.target.value)}
                  placeholder="Enter rejection reason..."
                  rows={2}
                  className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-xs text-white resize-none focus:outline-none focus:border-red-500"
                />
                <div className="flex gap-2">
                  <button
                    onClick={() => handleReject(action.id)}
                    disabled={loading}
                    className="px-3 py-1 bg-red-700 hover:bg-red-600 text-white text-xs rounded font-bold transition"
                  >
                    Confirm Rejection
                  </button>
                  <button
                    onClick={() => setRejectingId(null)}
                    className="px-3 py-1 bg-slate-800 text-slate-300 text-xs rounded font-bold transition"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex gap-2">
                <button
                  onClick={() => handleApprove(action.id)}
                  disabled={loading}
                  className="flex items-center gap-1 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs rounded font-bold transition"
                >
                  <Check className="w-3.5 h-3.5" /> Approve & Execute
                </button>
                <button
                  onClick={() => setRejectingId(action.id)}
                  disabled={loading}
                  className="flex items-center gap-1 px-3 py-1.5 bg-red-900/50 hover:bg-red-800 text-white text-xs rounded font-bold transition"
                >
                  <X className="w-3.5 h-3.5" /> Reject
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default IncidentActionPanel;
