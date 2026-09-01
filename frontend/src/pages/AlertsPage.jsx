import React, { useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle, Filter, ShieldAlert } from 'lucide-react';
import { MainLayout } from '../layouts/MainLayout';
import { DataTable } from '../components/DataTable';
import { StatusBadge } from '../components/StatusBadge';
import { LoadingSpinner, ErrorState } from '../components/StateViews';
import { alertService } from '../services/alertService';
import { useToast } from '../context/ToastContext';

export const AlertsPage = () => {
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filterResolved, setFilterResolved] = useState(false);

  const { addToast } = useToast();

  const loadAlerts = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await alertService.getAlerts(
        filterResolved !== null ? { is_resolved: filterResolved } : {}
      );
      setAlerts(data);
    } catch (err) {
      setError('Unable to load telemetry alerts.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAlerts();
  }, [filterResolved]);

  const handleResolveAlert = async (alertId) => {
    try {
      await alertService.resolveAlert(alertId);
      addToast('Alert marked as resolved', 'success');
      loadAlerts();
    } catch (err) {
      addToast('Failed to resolve alert', 'error');
    }
  };

  const columns = [
    {
      header: 'Machine ID',
      accessor: 'equipment_code',
      render: (item) => (
        <span className="font-mono font-bold text-cat-500">{item.equipment_code}</span>
      )
    },
    {
      header: 'Alert Category',
      accessor: 'alert_type',
      render: (item) => (
        <span className="font-mono text-xs text-white bg-slate-900 px-2 py-1 rounded border border-slate-800">
          {item.alert_type}
        </span>
      )
    },
    {
      header: 'Severity',
      render: (item) => <StatusBadge status={item.severity} />
    },
    {
      header: 'Alert Message / Details',
      accessor: 'message',
      render: (item) => <span className="text-slate-300">{item.message}</span>
    },
    {
      header: 'Timestamp',
      render: (item) => (
        <span className="font-mono text-xs text-slate-400">
          {new Date(item.created_at).toLocaleString()}
        </span>
      )
    },
    {
      header: 'Status & Action',
      render: (item) => (
        item.is_resolved ? (
          <span className="inline-flex items-center gap-1 text-xs text-emerald-400 font-mono font-semibold">
            <CheckCircle className="w-3.5 h-3.5" /> Resolved
          </span>
        ) : (
          <button
            onClick={() => handleResolveAlert(item.id)}
            className="px-3 py-1 bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-200 rounded text-xs font-semibold uppercase tracking-wider transition"
          >
            Acknowledge & Resolve
          </button>
        )
      )
    }
  ];

  return (
    <MainLayout title="Telematics & Anomaly Alerts">
      {/* Header Bar */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-bold text-white uppercase tracking-wider">Fleet Alert Log</h3>
          <p className="text-xs text-slate-400 font-mono">Real-time alerts for high engine idle, temperature limits, geofence breaches, and overdue rentals</p>
        </div>

        {/* Filter Toggle */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setFilterResolved(false)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold uppercase tracking-wider transition ${
              filterResolved === false
                ? 'bg-cat-500 text-black font-bold shadow-md'
                : 'bg-industrial-card border border-industrial-border text-slate-400 hover:text-white'
            }`}
          >
            Active Unresolved
          </button>
          <button
            onClick={() => setFilterResolved(true)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold uppercase tracking-wider transition ${
              filterResolved === true
                ? 'bg-cat-500 text-black font-bold shadow-md'
                : 'bg-industrial-card border border-industrial-border text-slate-400 hover:text-white'
            }`}
          >
            Resolved Log
          </button>
        </div>
      </div>

      {loading ? (
        <LoadingSpinner label="Fetching telemetry alerts..." />
      ) : error ? (
        <ErrorState message={error} onRetry={loadAlerts} />
      ) : (
        <DataTable
          columns={columns}
          data={alerts}
          searchPlaceholder="Search alert type, machine ID, message..."
        />
      )}
    </MainLayout>
  );
};
