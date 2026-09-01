import React, { useState } from 'react';
import { ShieldCheck, AlertOctagon, CheckCircle, XCircle } from 'lucide-react';
import Modal from './Modal';

export const ApprovalModal = ({ isOpen, onClose, action, onConfirmApprove, onConfirmReject }) => {
  const [reason, setReason] = useState('');
  const [isRejecting, setIsRejecting] = useState(false);

  if (!action) return null;

  const handleApprove = () => {
    onConfirmApprove(action.id);
    onClose();
  };

  const handleReject = () => {
    onConfirmReject(action.id, reason || 'Manager rejected workflow action.');
    setReason('');
    setIsRejecting(false);
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Manager Action Approval Required">
      <div className="space-y-4 font-mono">
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4">
          <div className="flex items-center gap-2 text-amber-400 font-extrabold text-xs uppercase mb-1">
            <AlertOctagon className="w-4 h-4" /> MANAGER APPROVAL REQUIRED
          </div>
          <p className="text-xs text-slate-300 leading-relaxed font-mono">{action.description}</p>
        </div>

        <div className="text-xs text-slate-400 bg-slate-900 rounded-lg p-3 border border-slate-800 space-y-1">
          <div><span className="text-slate-500">Action Type: </span><span className="text-white font-bold">{action.action_type}</span></div>
          <div><span className="text-slate-500">Safety Policy: </span><span className="text-emerald-400">SAFE SOFTWARE WORKFLOW ONLY — NO HARDWARE CONTROL</span></div>
        </div>

        {isRejecting && (
          <div className="space-y-2">
            <label className="text-xs text-slate-400 font-bold block">REJECTION REASON</label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="State reason for rejecting this action..."
              rows={2}
              className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-xs text-white resize-none focus:outline-none focus:border-red-500"
            />
          </div>
        )}

        <div className="flex justify-end gap-3 pt-3 border-t border-slate-800">
          {!isRejecting ? (
            <>
              <button
                onClick={() => setIsRejecting(true)}
                className="px-4 py-2 bg-red-900/50 hover:bg-red-800 text-white text-xs font-bold rounded-xl transition flex items-center gap-1.5"
              >
                <XCircle className="w-4 h-4" /> Reject Action
              </button>
              <button
                onClick={handleApprove}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl transition flex items-center gap-1.5"
              >
                <CheckCircle className="w-4 h-4" /> Approve & Execute
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => setIsRejecting(false)}
                className="px-4 py-2 bg-slate-800 text-slate-300 text-xs font-bold rounded-xl transition"
              >
                Back
              </button>
              <button
                onClick={handleReject}
                className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white text-xs font-bold rounded-xl transition"
              >
                Confirm Rejection
              </button>
            </>
          )}
        </div>
      </div>
    </Modal>
  );
};

export default ApprovalModal;
