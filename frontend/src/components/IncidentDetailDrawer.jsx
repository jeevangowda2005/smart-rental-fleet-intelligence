import React, { useState, useEffect } from 'react';
import { X, ShieldAlert, Eye, Play, Check, Trash2, Info } from 'lucide-react';
import { incidentService } from '../services/incidentService';
import { useToast } from '../context/ToastContext';

const SEVERITY_COLOR = { CRITICAL: 'text-rose-400', HIGH: 'text-amber-400', WARNING: 'text-yellow-400', INFO: 'text-slate-400' };

export const IncidentDetailDrawer = ({ incident, onClose, onRefresh }) => {
  const { success, error: showError } = useToast();
  const [auditLogs, setAuditLogs] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!incident?.id) return;
    incidentService.getAuditTrail(incident.id).then(d => setAuditLogs(d.audit_trail || []));
  }, [incident?.id]);

  if (!incident) return null;

  const handleAcknowledge = async () => {
    setLoading(true);
    try {
      await incidentService.acknowledge(incident.id);
      success('Incident acknowledged.');
      onRefresh();
    } catch { showError('Acknowledge failed.'); } finally { setLoading(false); }
  };

  const handleResolve = async () => {
    setLoading(true);
    try {
      await incidentService.resolve(incident.id);
      success('Incident resolved.');
      onRefresh();
      onClose();
    } catch { showError('Resolve failed.'); } finally { setLoading(false); }
  };

  const handleDismiss = async () => {
    setLoading(true);
    try {
      await incidentService.dismiss(incident.id);
      success('Incident dismissed.');
      onRefresh();
      onClose();
    } catch { showError('Dismiss failed.'); } finally { setLoading(false); }
  };

  const sev = incident.severity || 'INFO';
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-end" style={{ pointerEvents: 'none' }}>
      <div className="relative h-full w-full max-w-xl bg-slate-950 border-l border-industrial-border shadow-2xl overflow-y-auto flex flex-col" style={{ pointerEvents: 'all' }}>
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-800 bg-slate-900">
          <div className="flex items-center gap-3">
            <ShieldAlert className={`w-5 h-5 ${SEVERITY_COLOR[sev]}`} />
            <span className="text-white font-black font-mono text-sm">INCIDENT #{incident.id}</span>
            <span className={`text-[9px] px-2 py-0.5 rounded border font-extrabold uppercase ${SEVERITY_COLOR[sev]} bg-slate-800 border-slate-700`}>{sev}</span>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 flex-1 space-y-5">
          {/* Equipment & Meta */}
          <div className="bg-slate-900 rounded-xl p-4 border border-slate-800 space-y-2 text-xs font-mono">
            <div className="text-slate-400 uppercase font-bold text-[10px]">Equipment</div>
            <div className="text-white font-black text-lg">{incident.equipment_code}</div>
            <div className="text-slate-400">{incident.equipment_type} — {incident.equipment_model}</div>
            <div className="grid grid-cols-2 gap-2 pt-2">
              <div><span className="text-slate-500">Site: </span><span className="text-slate-300">{incident.site_code}</span></div>
              <div><span className="text-slate-500">Type: </span><span className="text-slate-300">{incident.incident_type?.replace(/_/g,' ')}</span></div>
              <div><span className="text-slate-500">Status: </span><span className="text-slate-300">{incident.status}</span></div>
              <div><span className="text-slate-500">Occurrences: </span><span className="text-slate-300">{incident.occurrence_count}</span></div>
              <div className="col-span-2"><span className="text-slate-500">Detected: </span><span className="text-slate-300">{incident.detected_at ? new Date(incident.detected_at).toLocaleString() : '—'}</span></div>
            </div>
          </div>

          {/* Description */}
          <div className="bg-slate-900 rounded-xl p-4 border border-slate-800">
            <div className="text-slate-400 uppercase font-bold text-[10px] font-mono mb-2 flex items-center gap-1"><Info className="w-3 h-3" /> Description</div>
            <p className="text-slate-300 text-xs font-mono leading-relaxed">{incident.description}</p>
          </div>

          {/* Recommended Action */}
          {incident.recommended_action && (
            <div className="bg-cat-500/10 rounded-xl p-4 border border-cat-500/30">
              <div className="text-cat-400 uppercase font-bold text-[10px] font-mono mb-2">AI RECOMMENDED ACTION</div>
              <p className="text-slate-300 text-xs font-mono leading-relaxed">{incident.recommended_action}</p>
              <p className="text-cat-500 text-[9px] font-mono mt-2 font-bold">MANAGER APPROVAL REQUIRED</p>
            </div>
          )}

          {/* Pending Actions */}
          {incident.pending_actions?.length > 0 && (
            <IncidentActionPanel incident={incident} onRefresh={onRefresh} onClose={onClose} />
          )}

          {/* Evidence */}
          {incident.evidence && Object.keys(incident.evidence).length > 0 && (
            <div className="bg-slate-900 rounded-xl p-4 border border-slate-800">
              <div className="text-slate-400 uppercase font-bold text-[10px] font-mono mb-2">Evidence</div>
              <div className="text-[10px] font-mono text-slate-400 space-y-1">
                {Object.entries(incident.evidence).map(([k, v]) => (
                  <div key={k}><span className="text-slate-500">{k}: </span><span className="text-slate-300">{JSON.stringify(v)}</span></div>
                ))}
              </div>
            </div>
          )}

          {/* Audit Timeline */}
          {auditLogs.length > 0 && (
            <div>
              <div className="text-slate-400 uppercase font-bold text-[10px] font-mono mb-3">Audit Trail</div>
              <IncidentAuditTimeline auditLogs={auditLogs} />
            </div>
          )}
        </div>

        {/* Footer actions */}
        <div className="p-4 border-t border-slate-800 flex flex-wrap gap-2 bg-slate-900">
          {incident.status === 'NEW' && (
            <button onClick={handleAcknowledge} disabled={loading}
              className="flex items-center gap-1 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs rounded-lg font-mono font-bold transition">
              <Eye className="w-3.5 h-3.5" /> Acknowledge
            </button>
          )}
          {!['RESOLVED','DISMISSED'].includes(incident.status) && (
            <>
              <button onClick={handleResolve} disabled={loading}
                className="flex items-center gap-1 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs rounded-lg font-mono font-bold transition">
                <Check className="w-3.5 h-3.5" /> Resolve
              </button>
              <button onClick={handleDismiss} disabled={loading}
                className="flex items-center gap-1 px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-white text-xs rounded-lg font-mono font-bold transition">
                <Trash2 className="w-3.5 h-3.5" /> Dismiss
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

// Inline Action Panel
const IncidentActionPanel = ({ incident, onRefresh, onClose }) => {
  const { success, error: showError } = useToast();
  const [loading, setLoading] = useState(false);
  const [rejReason, setRejReason] = useState('');
  const [rejectingId, setRejectingId] = useState(null);

  const handleApprove = async (actionId) => {
    setLoading(true);
    try {
      const r = await incidentService.approveAction(incident.id, actionId);
      success(r.detail || 'Action approved and executed.');
      onRefresh();
    } catch { showError('Approval failed.'); } finally { setLoading(false); }
  };

  const handleReject = async (actionId) => {
    setLoading(true);
    try {
      await incidentService.rejectAction(incident.id, actionId, rejReason || 'Manager rejected.');
      success('Action rejected.');
      setRejectingId(null);
      setRejReason('');
      onRefresh();
    } catch { showError('Rejection failed.'); } finally { setLoading(false); }
  };

  return (
    <div className="bg-amber-500/10 rounded-xl p-4 border border-amber-500/30">
      <div className="text-amber-400 uppercase font-bold text-[10px] font-mono mb-3">MANAGER APPROVAL REQUIRED</div>
      <div className="space-y-3">
        {incident.pending_actions.map(action => (
          <div key={action.id} className="bg-slate-900 rounded-lg p-3 border border-slate-700">
            <div className="text-xs font-mono font-bold text-white mb-1">{action.action_type.replace(/_/g,' ')}</div>
            <div className="text-[10px] text-slate-400 font-mono mb-3">{action.description}</div>
            {rejectingId === action.id ? (
              <div className="space-y-2">
                <textarea value={rejReason} onChange={e => setRejReason(e.target.value)}
                  placeholder="Rejection reason..." rows={2}
                  className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1.5 text-xs text-white font-mono resize-none focus:outline-none focus:border-red-500" />
                <div className="flex gap-2">
                  <button onClick={() => handleReject(action.id)} disabled={loading}
                    className="px-3 py-1.5 bg-red-700 hover:bg-red-600 text-white text-xs rounded font-mono font-bold transition">Confirm Reject</button>
                  <button onClick={() => setRejectingId(null)}
                    className="px-3 py-1.5 bg-slate-700 text-slate-300 text-xs rounded font-mono font-bold transition">Cancel</button>
                </div>
              </div>
            ) : (
              <div className="flex gap-2">
                <button onClick={() => handleApprove(action.id)} disabled={loading}
                  className="px-3 py-1.5 bg-emerald-700 hover:bg-emerald-600 text-white text-xs rounded font-mono font-bold transition">
                  ✓ Approve
                </button>
                <button onClick={() => setRejectingId(action.id)}
                  className="px-3 py-1.5 bg-red-700/50 hover:bg-red-700 text-white text-xs rounded font-mono font-bold transition">
                  ✗ Reject
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

// Inline Audit Timeline
const IncidentAuditTimeline = ({ auditLogs }) => (
  <div className="relative pl-4 border-l border-slate-700 space-y-4">
    {auditLogs.map((log, i) => (
      <div key={log.id} className="relative">
        <div className="absolute -left-5 top-0.5 w-2.5 h-2.5 rounded-full bg-slate-600 border-2 border-slate-700" />
        <div className="bg-slate-900 rounded-lg p-3 border border-slate-800">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] font-bold text-slate-400 font-mono uppercase">{log.action}</span>
            <span className="text-[9px] text-slate-500 font-mono">{log.timestamp ? new Date(log.timestamp).toLocaleTimeString() : ''}</span>
          </div>
          <div className="text-[10px] text-slate-300 font-mono">{log.reason}</div>
          {log.previous_state && (
            <div className="text-[9px] text-slate-500 font-mono mt-1">{log.previous_state} → {log.new_state} · {log.user_name}</div>
          )}
        </div>
      </div>
    ))}
  </div>
);
