import React, { useEffect, useState } from 'react';
import { Wrench, Plus, CheckCircle, Clock, Calendar, AlertTriangle } from 'lucide-react';
import { MainLayout } from '../layouts/MainLayout';
import { DataTable } from '../components/DataTable';
import { StatusBadge } from '../components/StatusBadge';
import { Modal } from '../components/Modal';
import { LoadingSpinner, ErrorState } from '../components/StateViews';
import { maintenanceService } from '../services/maintenanceService';
import { equipmentService } from '../services/equipmentService';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';

export const MaintenancePage = () => {
  const [maintenanceRecords, setMaintenanceRecords] = useState([]);
  const [equipmentList, setEquipmentList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Modal State
  const [showAddModal, setShowAddModal] = useState(false);
  const [formData, setFormData] = useState({
    equipment_id: '',
    maintenance_type: '500-Hour Hydraulic Service',
    description: '',
    scheduled_days: 7
  });

  const { isManager } = useAuth();
  const { addToast } = useToast();

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [maintData, eqData] = await Promise.all([
        maintenanceService.getMaintenance(),
        equipmentService.getEquipment()
      ]);
      setMaintenanceRecords(maintData);
      setEquipmentList(eqData);
    } catch (err) {
      setError('Unable to load maintenance records.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleScheduleMaintenance = async (e) => {
    e.preventDefault();
    if (!formData.equipment_id) {
      addToast('Please select a machine to schedule', 'warning');
      return;
    }
    try {
      const scheduledDate = new Date();
      scheduledDate.setDate(scheduledDate.getDate() + parseInt(formData.scheduled_days));

      await maintenanceService.scheduleMaintenance({
        equipment_id: parseInt(formData.equipment_id),
        maintenance_type: formData.maintenance_type,
        description: formData.description || 'Routine scheduled machine maintenance',
        scheduled_date: scheduledDate.toISOString()
      });
      addToast('Maintenance task successfully scheduled', 'success');
      setShowAddModal(false);
      loadData();
    } catch (err) {
      addToast(err.response?.data?.detail || 'Failed to schedule maintenance', 'error');
    }
  };

  const handleUpdateStatus = async (maintId, newStatus) => {
    try {
      await maintenanceService.updateMaintenanceStatus(maintId, { status: newStatus });
      addToast(`Work order status updated to ${newStatus}`, 'success');
      loadData();
    } catch (err) {
      addToast('Failed to update maintenance record status', 'error');
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
      header: 'Work Order / Service Type',
      render: (item) => (
        <div>
          <div className="font-semibold text-white">{item.maintenance_type}</div>
          <div className="text-xs text-slate-400">{item.description}</div>
        </div>
      )
    },
    {
      header: 'Scheduled Date',
      render: (item) => (
        <span className="font-mono text-xs text-slate-300">
          {new Date(item.scheduled_date).toLocaleDateString()}
        </span>
      )
    },
    {
      header: 'Status',
      render: (item) => <StatusBadge status={item.status} />
    },
    {
      header: 'Work Order Action',
      render: (item) => (
        <div className="flex items-center gap-2">
          {item.status === 'SCHEDULED' && (
            <button
              onClick={() => handleUpdateStatus(item.id, 'IN_PROGRESS')}
              className="px-3 py-1 bg-amber-950/40 hover:bg-amber-900/80 border border-amber-700/50 text-amber-300 rounded text-xs font-semibold uppercase tracking-wider transition"
            >
              Start Service
            </button>
          )}
          {item.status === 'IN_PROGRESS' && (
            <button
              onClick={() => handleUpdateStatus(item.id, 'COMPLETED')}
              className="px-3 py-1 bg-emerald-950/40 hover:bg-emerald-900/80 border border-emerald-700/50 text-emerald-300 rounded text-xs font-semibold uppercase tracking-wider transition"
            >
              Complete Service
            </button>
          )}
          {item.status === 'COMPLETED' && (
            <span className="text-xs text-slate-500 font-mono">Service Done</span>
          )}
        </div>
      )
    }
  ];

  return (
    <MainLayout title="Maintenance & Servicing Schedules">
      {/* Header Bar */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-bold text-white uppercase tracking-wider">Fleet Work Orders</h3>
          <p className="text-xs text-slate-400">Track 500-hr oil changes, hydraulic pump overhaul, and track inspections</p>
        </div>

        {isManager && (
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-cat-500 hover:bg-cat-600 text-black font-extrabold text-xs uppercase tracking-wider rounded-xl shadow-lg shadow-cat-500/20 transition"
          >
            <Plus className="w-4 h-4" />
            Schedule Work Order
          </button>
        )}
      </div>

      {loading ? (
        <LoadingSpinner label="Fetching machine servicing schedules..." />
      ) : error ? (
        <ErrorState message={error} onRetry={loadData} />
      ) : (
        <DataTable
          columns={columns}
          data={maintenanceRecords}
          searchPlaceholder="Search machine ID, service type, description..."
        />
      )}

      {/* Schedule Maintenance Modal */}
      <Modal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        title="Schedule Fleet Maintenance"
      >
        <form onSubmit={handleScheduleMaintenance} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold uppercase text-slate-300 mb-1">
              Select Target Equipment
            </label>
            <select
              required
              value={formData.equipment_id}
              onChange={(e) => setFormData({ ...formData, equipment_id: e.target.value })}
              className="w-full p-2.5 bg-industrial-bg border border-industrial-border rounded-lg text-sm text-white focus:border-cat-500 focus:outline-none"
            >
              <option value="">-- Choose Machine --</option>
              {equipmentList.map((eq) => (
                <option key={eq.id} value={eq.id}>
                  {eq.equipment_id} - {eq.model} ({eq.status})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase text-slate-300 mb-1">
              Maintenance Service Type
            </label>
            <select
              value={formData.maintenance_type}
              onChange={(e) => setFormData({ ...formData, maintenance_type: e.target.value })}
              className="w-full p-2.5 bg-industrial-bg border border-industrial-border rounded-lg text-sm text-white focus:border-cat-500 focus:outline-none"
            >
              <option value="500-Hour Hydraulic Service">500-Hour Hydraulic Service</option>
              <option value="Preventative Engine Inspection">Preventative Engine Inspection</option>
              <option value="Track Tension & Undercarriage Service">Track Tension & Undercarriage Service</option>
              <option value="Brake System Fluid Overhaul">Brake System Fluid Overhaul</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase text-slate-300 mb-1">
              Task Description & Notes
            </label>
            <textarea
              rows="3"
              placeholder="Enter service details or symptoms..."
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full p-2.5 bg-industrial-bg border border-industrial-border rounded-lg text-sm text-white focus:border-cat-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase text-slate-300 mb-1">
              Schedule In (Days)
            </label>
            <input
              type="number"
              min="0"
              max="180"
              value={formData.scheduled_days}
              onChange={(e) => setFormData({ ...formData, scheduled_days: e.target.value })}
              className="w-full p-2.5 bg-industrial-bg border border-industrial-border rounded-lg text-sm text-white font-mono focus:border-cat-500 focus:outline-none"
            />
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-industrial-border">
            <button
              type="button"
              onClick={() => setShowAddModal(false)}
              className="px-4 py-2 bg-slate-800 text-slate-300 rounded-lg text-xs font-bold uppercase tracking-wider hover:bg-slate-700"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 bg-cat-500 hover:bg-cat-600 text-black font-extrabold text-xs uppercase tracking-wider rounded-lg shadow"
            >
              Save Work Order
            </button>
          </div>
        </form>
      </Modal>
    </MainLayout>
  );
};
