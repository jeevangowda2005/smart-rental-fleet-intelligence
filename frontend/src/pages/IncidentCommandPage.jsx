import React, { useState, useEffect } from 'react';
import { ShieldAlert, RefreshCw, Radio } from 'lucide-react';
import { incidentService } from '../services/incidentService';
import { IncidentSummaryCards } from '../components/IncidentSummaryCards';
import { IncidentTable } from '../components/IncidentTable';
import { IncidentDetailDrawer } from '../components/IncidentDetailDrawer';
import { NotificationCenter } from '../components/NotificationCenter';
import { useWebSocket } from '../hooks/useWebSocket';
import { useToast } from '../context/ToastContext';

export const IncidentCommandPage = () => {
  const { error: showError } = useToast();
  const [summary, setSummary] = useState(null);
  const [incidents, setIncidents] = useState([]);
  const [selectedIncident, setSelectedIncident] = useState(null);
  const [filters, setFilters] = useState({ severity: '', status: '', incident_type: '' });
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    try {
      const [sumRes, incRes] = await Promise.all([
        incidentService.getSummary(),
        incidentService.getIncidents(filters)
      ]);
      setSummary(sumRes);
      setIncidents(incRes.incidents || []);
      if (selectedIncident) {
        const refreshed = (incRes.incidents || []).find(i => i.id === selectedIncident.id);
        if (refreshed) setSelectedIncident(refreshed);
      }
    } catch (err) {
      showError('Failed to load incident data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [filters]);

  // Connect to existing WebSocket stream for real-time incident updates
  useWebSocket({
    onMessage: (data) => {
      if (data.type === 'INCIDENT_UPDATE' || data.type === 'NOTIFICATION_UPDATE') {
        loadData();
      }
    }
  });

  const handleFilterChange = (key, value) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto font-mono text-slate-100">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-industrial-border pb-4">
        <div>
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-7 h-7 text-rose-500" />
            <h1 className="text-2xl font-black uppercase tracking-wider text-white">
              Incident Command Center
            </h1>
          </div>
          <p className="text-xs text-slate-400 font-mono mt-1">
            Real-time incident detection, automated playbooks & Manager approval workflows
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-[10px] text-emerald-400 font-bold">
            <Radio className="w-3.5 h-3.5 animate-pulse" /> LIVE TELEMETRY STREAM
          </div>
          <NotificationCenter />
          <button
            onClick={loadData}
            className="flex items-center gap-1.5 px-3 py-2 bg-slate-900 hover:bg-slate-800 text-slate-300 text-xs font-bold rounded-xl border border-slate-800 transition"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </button>
        </div>
      </div>

      {/* Honesty Banner */}
      <div className="bg-slate-900/80 border border-industrial-border rounded-xl p-3 flex flex-wrap items-center justify-between text-[10px] font-mono text-slate-400">
        <div>
          <span className="font-bold text-cat-400">DATA HONESTY:</span> All recommendations require explicit Manager approval before software execution.
        </div>
        <div className="flex gap-2">
          <span className="bg-slate-950 px-2 py-0.5 rounded border border-slate-800 text-slate-300 font-bold">AI RECOMMENDED ACTION</span>
          <span className="bg-amber-500/20 px-2 py-0.5 rounded border border-amber-500/30 text-amber-300 font-bold">MANAGER APPROVAL REQUIRED</span>
        </div>
      </div>

      {/* Incident Summary Cards */}
      <IncidentSummaryCards summary={summary} />

      {/* Incident Table */}
      <IncidentTable
        incidents={incidents}
        onSelect={(inc) => setSelectedIncident(inc)}
        filters={filters}
        onFilterChange={handleFilterChange}
      />

      {/* Detail Drawer */}
      {selectedIncident && (
        <IncidentDetailDrawer
          incident={selectedIncident}
          onClose={() => setSelectedIncident(null)}
          onRefresh={loadData}
        />
      )}
    </div>
  );
};

export default IncidentCommandPage;
