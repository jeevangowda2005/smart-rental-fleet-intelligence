import React, { useEffect, useState } from 'react';
import {
  Truck, Plus, Filter, QrCode, Gauge, Fuel, Clock, MapPin, HardHat, Info, ArrowUpDown, ShieldAlert, CheckCircle2, AlertTriangle, Activity
} from 'lucide-react';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';

import { MainLayout } from '../layouts/MainLayout';
import { DataTable } from '../components/DataTable';
import { StatusBadge } from '../components/StatusBadge';
import { Modal } from '../components/Modal';
import { LoadingSpinner, ErrorState } from '../components/StateViews';
import { equipmentService } from '../services/equipmentService';
import { siteService } from '../services/siteService';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';

export const EquipmentPage = () => {
  const [equipmentList, setEquipmentList] = useState([]);
  const [sites, setSites] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Filters & Sorting State
  const [selectedStatus, setSelectedStatus] = useState('');
  const [selectedSite, setSelectedSite] = useState('');
  const [selectedType, setSelectedType] = useState('');
  const [sortBy, setSortBy] = useState('equipment_id');

  // Detailed View State
  const [detailedEquipment, setDetailedEquipment] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showQRModal, setShowQRModal] = useState(false);
  const [selectedItemForQR, setSelectedItemForQR] = useState(null);

  // Add Machine Modal
  const [showAddModal, setShowAddModal] = useState(false);
  const [formData, setFormData] = useState({
    equipment_id: '',
    equipment_type: 'Hydraulic Excavator',
    model: '',
    site_id: '',
    engine_hours: 0,
    idle_hours: 0,
    fuel_usage: 0
  });

  const { isManager } = useAuth();
  const { addToast } = useToast();

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = {
        ...(selectedStatus && { status: selectedStatus }),
        ...(selectedSite && { site_id: selectedSite }),
        ...(selectedType && { equipment_type: selectedType }),
        sort_by: sortBy
      };
      const [eqData, sitesData] = await Promise.all([
        equipmentService.getEquipment(params),
        siteService.getSites()
      ]);
      setEquipmentList(eqData);
      setSites(sitesData);
    } catch (err) {
      setError('Failed to load equipment directory.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [selectedStatus, selectedSite, selectedType, sortBy]);

  const openDetailModal = async (item) => {
    setDetailLoading(true);
    setShowDetailModal(true);
    try {
      const details = await equipmentService.getEquipmentDetails(item.id);
      setDetailedEquipment(details);
    } catch (err) {
      addToast('Failed to load full equipment details', 'error');
    } finally {
      setDetailLoading(false);
    }
  };

  const handleCreateEquipment = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        ...formData,
        site_id: formData.site_id ? parseInt(formData.site_id) : null,
        engine_hours: parseFloat(formData.engine_hours),
        idle_hours: parseFloat(formData.idle_hours),
        fuel_usage: parseFloat(formData.fuel_usage)
      };
      await equipmentService.createEquipment(payload);
      addToast(`Machine ${formData.equipment_id} added to fleet directory`, 'success');
      setShowAddModal(false);
      setFormData({
        equipment_id: '',
        equipment_type: 'Hydraulic Excavator',
        model: '',
        site_id: '',
        engine_hours: 0,
        idle_hours: 0,
        fuel_usage: 0
      });
      loadData();
    } catch (err) {
      addToast(err.response?.data?.detail || 'Error adding machine', 'error');
    }
  };

  const getUtilizationBadge = (util) => {
    if (util >= 75) return { label: 'High (≥75%)', style: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' };
    if (util >= 50) return { label: 'Medium (50-74%)', style: 'bg-amber-500/10 text-amber-400 border-amber-500/30' };
    return { label: 'Low (<50%)', style: 'bg-rose-500/10 text-rose-400 border-rose-500/30' };
  };

  const columns = [
    {
      header: 'Equipment ID / Tag',
      accessor: 'equipment_id',
      render: (item) => (
        <div className="flex items-center gap-2.5 font-mono font-bold text-cat-500">
          <button
            onClick={() => {
              setSelectedItemForQR(item);
              setShowQRModal(true);
            }}
            title="Scan QR Tag"
            className="p-1.5 rounded bg-slate-900 border border-slate-800 text-slate-400 hover:text-cat-500 transition"
          >
            <QrCode className="w-4 h-4" />
          </button>
          <span>{item.equipment_id}</span>
        </div>
      )
    },
    {
      header: 'Category & Model',
      render: (item) => (
        <div>
          <div className="font-semibold text-white">{item.model}</div>
          <div className="text-xs text-slate-400 font-mono">{item.equipment_type}</div>
        </div>
      )
    },
    {
      header: 'Status',
      render: (item) => <StatusBadge status={item.status} />
    },
    {
      header: 'Location / Site',
      render: (item) => (
        <div className="flex items-center gap-1.5 text-xs text-slate-300">
          <MapPin className="w-3.5 h-3.5 text-cat-500 shrink-0" />
          <span>{item.site_name}</span>
        </div>
      )
    },
    {
      header: 'Operator',
      render: (item) => (
        <div className="flex items-center gap-1.5 text-xs text-slate-300">
          <HardHat className="w-3.5 h-3.5 text-slate-400 shrink-0" />
          <span>{item.operator_name}</span>
        </div>
      )
    },
    {
      header: 'Engine / Idle Hrs',
      render: (item) => (
        <div className="font-mono text-xs text-slate-300">
          <div><strong className="text-white">{item.engine_hours}</strong> eng</div>
          <div className="text-slate-400">{item.idle_hours} idle</div>
        </div>
      )
    },
    {
      header: 'Fuel Rate',
      render: (item) => (
        <span className="font-mono text-xs text-slate-300">{item.fuel_usage} L/hr</span>
      )
    },
    {
      header: 'Utilization',
      accessor: 'utilization',
      render: (item) => {
        const badge = getUtilizationBadge(item.utilization);
        return (
          <div className="space-y-1">
            <div className="flex items-center gap-2 font-mono">
              <div className="w-16 bg-slate-800 h-2 rounded-full overflow-hidden">
                <div
                  className={`h-full ${
                    item.utilization >= 75
                      ? 'bg-emerald-500'
                      : item.utilization >= 50
                      ? 'bg-amber-500'
                      : 'bg-rose-500'
                  }`}
                  style={{ width: `${item.utilization}%` }}
                />
              </div>
              <span className="text-xs font-bold text-white">{item.utilization}%</span>
            </div>
            <span className={`inline-block px-1.5 py-0.2 rounded text-[10px] border ${badge.style}`}>
              {badge.label}
            </span>
          </div>
        );
      }
    },
    {
      header: 'Actions',
      render: (item) => (
        <button
          onClick={() => openDetailModal(item)}
          className="flex items-center gap-1 px-3 py-1.5 rounded bg-slate-900 hover:bg-slate-800 border border-slate-700 text-xs font-semibold text-slate-200 transition"
        >
          <Info className="w-3.5 h-3.5 text-cat-500" />
          Details
        </button>
      )
    }
  ];

  const types = [
    'Hydraulic Excavator',
    'Off-Highway Haul Truck',
    'Articulated Haul Truck',
    'Track Dozer',
    'Wheel Loader',
    'Motor Grader',
    'Soil Compactor'
  ];

  return (
    <MainLayout title="Heavy Equipment Directory">
      {/* Search, Multi-Filters & Sorting Controls */}
      <div className="bg-industrial-card border border-industrial-border rounded-xl p-4 space-y-4 shadow-lg">
        <div className="flex flex-wrap items-center justify-between gap-4">
          {/* Status Filter Buttons */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1 mr-1">
              <Filter className="w-3.5 h-3.5 text-cat-500" /> Status:
            </span>
            {['', 'AVAILABLE', 'RENTED', 'ACTIVE', 'IDLE', 'OVERDUE', 'MAINTENANCE'].map((st) => (
              <button
                key={st}
                onClick={() => setSelectedStatus(st)}
                className={`px-3 py-1 rounded-lg text-xs font-semibold uppercase tracking-wider transition ${
                  selectedStatus === st
                    ? 'bg-cat-500 text-black font-bold shadow-md shadow-cat-500/20'
                    : 'bg-industrial-bg border border-industrial-border text-slate-400 hover:text-white'
                }`}
              >
                {st === '' ? 'All Statuses' : st}
              </button>
            ))}
          </div>

          {isManager && (
            <button
              onClick={() => setShowAddModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-cat-500 hover:bg-cat-600 text-black font-extrabold text-xs uppercase tracking-wider rounded-xl shadow transition"
            >
              <Plus className="w-4 h-4" />
              Add Fleet Machine
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-3 border-t border-industrial-border/60">
          {/* Site Filter */}
          <div>
            <label className="block text-[11px] font-mono text-slate-400 uppercase mb-1">Filter by Site</label>
            <select
              value={selectedSite}
              onChange={(e) => setSelectedSite(e.target.value)}
              className="w-full p-2 bg-industrial-bg border border-industrial-border rounded-lg text-xs text-white focus:border-cat-500 focus:outline-none"
            >
              <option value="">All Mining / Project Sites</option>
              {sites.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.site_code} - {s.site_name}
                </option>
              ))}
            </select>
          </div>

          {/* Equipment Type Filter */}
          <div>
            <label className="block text-[11px] font-mono text-slate-400 uppercase mb-1">Filter by Machine Type</label>
            <select
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value)}
              className="w-full p-2 bg-industrial-bg border border-industrial-border rounded-lg text-xs text-white focus:border-cat-500 focus:outline-none"
            >
              <option value="">All Equipment Categories</option>
              {types.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>

          {/* Sorting Control */}
          <div>
            <label className="block text-[11px] font-mono text-slate-400 uppercase mb-1 flex items-center gap-1">
              <ArrowUpDown className="w-3 h-3 text-cat-500" /> Sort Equipment By
            </label>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="w-full p-2 bg-industrial-bg border border-industrial-border rounded-lg text-xs text-white focus:border-cat-500 focus:outline-none"
            >
              <option value="equipment_id">Equipment ID (A-Z)</option>
              <option value="utilization">Highest Utilization %</option>
              <option value="engine_hours">Highest Engine Hours</option>
              <option value="model">Model Name</option>
            </select>
          </div>
        </div>
      </div>

      {loading ? (
        <LoadingSpinner label="Querying heavy machinery directory..." />
      ) : error ? (
        <ErrorState message={error} onRetry={loadData} />
      ) : (
        <DataTable
          columns={columns}
          data={equipmentList}
          searchPlaceholder="Search Machine ID, category, model, operator..."
        />
      )}

      {/* Equipment Detailed Overview Modal */}
      <Modal
        isOpen={showDetailModal}
        onClose={() => setShowDetailModal(false)}
        title={`Asset Intelligence: ${detailedEquipment?.equipment_id || 'Machine Details'}`}
        maxWidth="max-w-4xl"
      >
        {detailLoading ? (
          <LoadingSpinner label="Fetching telemetry history & health scoring..." />
        ) : detailedEquipment ? (
          <div className="space-y-6">
            {/* Header Machine Banner & Health Badge */}
            <div className="p-5 bg-slate-900 border border-slate-800 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono font-bold text-cat-500 uppercase">{detailedEquipment.equipment_id}</span>
                  <StatusBadge status={detailedEquipment.status} />
                </div>
                <h3 className="text-xl font-extrabold text-white mt-1">{detailedEquipment.model}</h3>
                <p className="text-xs text-slate-400 font-mono">{detailedEquipment.equipment_type}</p>
              </div>

              {/* Health Score Summary Box */}
              <div
                className={`p-4 rounded-xl border flex items-center gap-3 ${
                  detailedEquipment.health_status === 'CRITICAL'
                    ? 'bg-rose-950/60 border-rose-500/40 text-rose-200'
                    : detailedEquipment.health_status === 'ATTENTION'
                    ? 'bg-amber-950/60 border-amber-500/40 text-amber-200'
                    : 'bg-emerald-950/60 border-emerald-500/40 text-emerald-200'
                }`}
              >
                {detailedEquipment.health_status === 'CRITICAL' && <ShieldAlert className="w-8 h-8 text-rose-400 shrink-0" />}
                {detailedEquipment.health_status === 'ATTENTION' && <AlertTriangle className="w-8 h-8 text-amber-400 shrink-0" />}
                {detailedEquipment.health_status === 'HEALTHY' && <CheckCircle2 className="w-8 h-8 text-emerald-400 shrink-0" />}
                <div>
                  <div className="text-xs font-mono font-bold uppercase tracking-wider">
                    Equipment Health: {detailedEquipment.health_status}
                  </div>
                  <ul className="text-[11px] mt-0.5 space-y-0.5 opacity-90">
                    {detailedEquipment.health_reasons?.map((reason, idx) => (
                      <li key={idx}>• {reason}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>

            {/* KPI Cards Row */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="p-4 bg-industrial-bg border border-industrial-border rounded-xl">
                <span className="text-[10px] text-slate-400 uppercase font-mono">Engine Hours</span>
                <div className="text-xl font-extrabold text-white font-mono mt-1">{detailedEquipment.engine_hours} hrs</div>
              </div>
              <div className="p-4 bg-industrial-bg border border-industrial-border rounded-xl">
                <span className="text-[10px] text-slate-400 uppercase font-mono">Idle Hours</span>
                <div className="text-xl font-extrabold text-amber-400 font-mono mt-1">{detailedEquipment.idle_hours} hrs</div>
              </div>
              <div className="p-4 bg-industrial-bg border border-industrial-border rounded-xl">
                <span className="text-[10px] text-slate-400 uppercase font-mono">Fuel Burn Rate</span>
                <div className="text-xl font-extrabold text-white font-mono mt-1">{detailedEquipment.fuel_usage} L/hr</div>
              </div>
              <div className="p-4 bg-industrial-bg border border-industrial-border rounded-xl">
                <span className="text-[10px] text-slate-400 uppercase font-mono">Utilization %</span>
                <div className="text-xl font-extrabold text-cat-500 font-mono mt-1">{detailedEquipment.utilization}%</div>
              </div>
            </div>

            {/* Recharts Telemetry Hours Trend */}
            {detailedEquipment.recent_logs?.length > 0 && (
              <div className="bg-industrial-bg border border-industrial-border rounded-xl p-4">
                <h4 className="text-xs font-bold text-white uppercase tracking-wider mb-3 flex items-center gap-2">
                  <Activity className="w-4 h-4 text-cat-500" />
                  Telemetry Hours History
                </h4>
                <div className="h-44 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={[...detailedEquipment.recent_logs].reverse()}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1E293B" />
                      <XAxis dataKey="timestamp" stroke="#64748B" fontSize={10} tickFormatter={(t) => new Date(t).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} />
                      <YAxis stroke="#64748B" fontSize={10} />
                      <Tooltip contentStyle={{ backgroundColor: '#0F172A', borderColor: '#1E293B', color: '#FFF' }} />
                      <Line type="monotone" dataKey="engine_hours" stroke="#3B82F6" strokeWidth={2} name="Engine Hours" />
                      <Line type="monotone" dataKey="idle_hours" stroke="#F59E0B" strokeWidth={2} name="Idle Hours" />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}

            {/* Active Rental & Location Details */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 bg-industrial-bg border border-industrial-border rounded-xl space-y-2 text-xs">
                <h4 className="font-bold text-white uppercase mb-2">Location & Assignment</h4>
                <div className="flex justify-between"><span className="text-slate-400">Current Site:</span><span className="text-white font-semibold">{detailedEquipment.site_name}</span></div>
                <div className="flex justify-between"><span className="text-slate-400">Assigned Operator:</span><span className="text-white font-semibold">{detailedEquipment.operator_name}</span></div>
                <div className="flex justify-between"><span className="text-slate-400">GPS Position:</span><span className="text-cat-500 font-mono">{detailedEquipment.latitude.toFixed(4)}, {detailedEquipment.longitude.toFixed(4)}</span></div>
              </div>

              <div className="p-4 bg-industrial-bg border border-industrial-border rounded-xl space-y-2 text-xs">
                <h4 className="font-bold text-white uppercase mb-2">Active Rental Contract</h4>
                {detailedEquipment.active_rental ? (
                  <>
                    <div className="flex justify-between"><span className="text-slate-400">Checkout Time:</span><span className="text-slate-200 font-mono">{new Date(detailedEquipment.active_rental.checkout_time).toLocaleDateString()}</span></div>
                    <div className="flex justify-between"><span className="text-slate-400">Expected Return:</span><span className="text-slate-200 font-mono">{new Date(detailedEquipment.active_rental.expected_return_time).toLocaleDateString()}</span></div>
                    <div className="flex justify-between"><span className="text-slate-400">Contract Status:</span><StatusBadge status={detailedEquipment.active_rental.status} /></div>
                  </>
                ) : (
                  <span className="text-slate-500 italic">No active rental contract. Machine available at depot.</span>
                )}
              </div>
            </div>
          </div>
        ) : null}
      </Modal>

      {/* Add Equipment Modal */}
      <Modal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        title="Commission New Heavy Machine"
      >
        <form onSubmit={handleCreateEquipment} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold uppercase text-slate-300 mb-1">Equipment ID</label>
              <input
                type="text"
                required
                placeholder="CAT-EXC-999"
                value={formData.equipment_id}
                onChange={(e) => setFormData({ ...formData, equipment_id: e.target.value })}
                className="w-full p-2.5 bg-industrial-bg border border-industrial-border rounded-lg text-sm text-white font-mono focus:border-cat-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase text-slate-300 mb-1">Category</label>
              <select
                value={formData.equipment_type}
                onChange={(e) => setFormData({ ...formData, equipment_type: e.target.value })}
                className="w-full p-2.5 bg-industrial-bg border border-industrial-border rounded-lg text-sm text-white focus:border-cat-500 focus:outline-none"
              >
                {types.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase text-slate-300 mb-1">Model Name & Series</label>
            <input
              type="text"
              required
              placeholder="CAT 349 Next Gen"
              value={formData.model}
              onChange={(e) => setFormData({ ...formData, model: e.target.value })}
              className="w-full p-2.5 bg-industrial-bg border border-industrial-border rounded-lg text-sm text-white focus:border-cat-500 focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold uppercase text-slate-300 mb-1">Engine Hrs</label>
              <input
                type="number"
                step="0.1"
                min="0"
                value={formData.engine_hours}
                onChange={(e) => setFormData({ ...formData, engine_hours: e.target.value })}
                className="w-full p-2.5 bg-industrial-bg border border-industrial-border rounded-lg text-sm text-white font-mono focus:border-cat-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase text-slate-300 mb-1">Idle Hrs</label>
              <input
                type="number"
                step="0.1"
                min="0"
                value={formData.idle_hours}
                onChange={(e) => setFormData({ ...formData, idle_hours: e.target.value })}
                className="w-full p-2.5 bg-industrial-bg border border-industrial-border rounded-lg text-sm text-white font-mono focus:border-cat-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase text-slate-300 mb-1">Fuel Rate</label>
              <input
                type="number"
                step="0.1"
                min="0"
                value={formData.fuel_usage}
                onChange={(e) => setFormData({ ...formData, fuel_usage: e.target.value })}
                className="w-full p-2.5 bg-industrial-bg border border-industrial-border rounded-lg text-sm text-white font-mono focus:border-cat-500 focus:outline-none"
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-industrial-border">
            <button
              type="button"
              onClick={() => setShowAddModal(false)}
              className="px-4 py-2 bg-slate-800 text-slate-300 rounded-lg text-xs font-bold uppercase hover:bg-slate-700"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 bg-cat-500 hover:bg-cat-600 text-black font-extrabold text-xs uppercase rounded-lg shadow"
            >
              Save Machine
            </button>
          </div>
        </form>
      </Modal>

      {/* QR Code Tag Modal */}
      <Modal
        isOpen={showQRModal}
        onClose={() => setShowQRModal(false)}
        title={`Asset Tag: ${selectedItemForQR?.equipment_id}`}
        maxWidth="max-w-sm"
      >
        {selectedItemForQR && (
          <div className="flex flex-col items-center justify-center p-6 text-center space-y-4">
            <div className="p-4 bg-white rounded-2xl shadow-xl">
              <div className="w-48 h-48 bg-slate-950 p-2 rounded flex flex-col justify-between">
                <div className="flex justify-between">
                  <div className="w-12 h-12 border-4 border-white bg-slate-950" />
                  <div className="w-12 h-12 border-4 border-white bg-slate-950" />
                </div>
                <div className="text-center font-mono text-[10px] text-cat-500 font-bold tracking-widest uppercase">
                  {selectedItemForQR.equipment_id}
                </div>
                <div className="flex justify-between">
                  <div className="w-12 h-12 border-4 border-white bg-slate-950" />
                  <div className="w-6 h-6 bg-white" />
                </div>
              </div>
            </div>
            <p className="text-xs text-slate-400 font-mono">
              Scan asset tag for quick field operator dispatch.
            </p>
          </div>
        )}
      </Modal>
    </MainLayout>
  );
};
