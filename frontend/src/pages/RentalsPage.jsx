import React, { useEffect, useState } from 'react';
import { FileText, Plus, CheckCircle, Clock, AlertCircle, Calendar, User, MapPin, Truck, AlertTriangle } from 'lucide-react';
import { MainLayout } from '../layouts/MainLayout';
import { DataTable } from '../components/DataTable';
import { StatusBadge } from '../components/StatusBadge';
import { Modal } from '../components/Modal';
import { LoadingSpinner, ErrorState } from '../components/StateViews';
import { rentalService } from '../services/rentalService';
import { equipmentService } from '../services/equipmentService';
import { siteService } from '../services/siteService';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';

export const RentalsPage = () => {
  const [rentals, setRentals] = useState([]);
  const [availableEquipment, setAvailableEquipment] = useState([]);
  const [sites, setSites] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Modals State
  const [showCheckoutModal, setShowCheckoutModal] = useState(false);
  const [showCheckinConfirmModal, setShowCheckinConfirmModal] = useState(false);
  const [selectedRentalForCheckin, setSelectedRentalForCheckin] = useState(null);

  const [checkoutData, setCheckoutData] = useState({
    equipment_id: '',
    site_id: '',
    operator_id: '2', // Default Operator 1
    expected_return_days: 7
  });

  const { isManager, isOperator, user } = useAuth();
  const { addToast } = useToast();

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [rentalsData, eqData, sitesData] = await Promise.all([
        rentalService.getRentals(),
        equipmentService.getEquipment({ status: 'AVAILABLE' }),
        siteService.getSites()
      ]);
      setRentals(rentalsData);
      setAvailableEquipment(eqData);
      setSites(sitesData);
    } catch (err) {
      setError('Unable to load rental contracts.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleCheckout = async (e) => {
    e.preventDefault();
    if (!checkoutData.equipment_id || !checkoutData.site_id) {
      addToast('Please select both an available machine and destination site', 'warning');
      return;
    }
    try {
      await rentalService.checkout({
        equipment_id: parseInt(checkoutData.equipment_id),
        site_id: parseInt(checkoutData.site_id),
        operator_id: isOperator ? user.id : parseInt(checkoutData.operator_id),
        expected_return_days: parseInt(checkoutData.expected_return_days)
      });
      addToast('Equipment successfully dispatched to site rental', 'success');
      setShowCheckoutModal(false);
      loadData();
    } catch (err) {
      addToast(err.response?.data?.detail || 'Failed to complete checkout', 'error');
    }
  };

  const confirmCheckin = async () => {
    if (!selectedRentalForCheckin) return;
    try {
      await rentalService.checkin(selectedRentalForCheckin.id);
      addToast(`Rental contract completed. ${selectedRentalForCheckin.equipment_code} returned to depot as AVAILABLE.`, 'success');
      setShowCheckinConfirmModal(false);
      setSelectedRentalForCheckin(null);
      loadData();
    } catch (err) {
      addToast(err.response?.data?.detail || 'Failed to check in equipment', 'error');
    }
  };

  const columns = [
    {
      header: 'Machine ID & Series',
      accessor: 'equipment_code',
      render: (item) => (
        <div>
          <div className="font-mono font-bold text-cat-500">{item.equipment_code}</div>
          <div className="text-xs text-slate-400 font-mono">{item.equipment_model}</div>
        </div>
      )
    },
    {
      header: 'Assigned Site',
      render: (item) => (
        <div className="flex items-center gap-1.5 text-xs text-slate-300">
          <MapPin className="w-3.5 h-3.5 text-cat-500 shrink-0" />
          <span>{item.site_name}</span>
        </div>
      )
    },
    {
      header: 'Assigned Operator',
      render: (item) => (
        <div className="flex items-center gap-1.5 text-xs text-slate-300">
          <User className="w-3.5 h-3.5 text-slate-400 shrink-0" />
          <span>{item.operator_name}</span>
        </div>
      )
    },
    {
      header: 'Checkout Date',
      render: (item) => (
        <span className="font-mono text-xs text-slate-300">
          {new Date(item.checkout_time).toLocaleDateString()}
        </span>
      )
    },
    {
      header: 'Expected Return',
      render: (item) => (
        <span className="font-mono text-xs text-slate-300">
          {new Date(item.expected_return_time).toLocaleDateString()}
        </span>
      )
    },
    {
      header: 'Contract Status',
      render: (item) => <StatusBadge status={item.status} />
    },
    {
      header: 'Rental Actions',
      render: (item) => (
        item.status === 'ACTIVE' || item.status === 'OVERDUE' ? (
          <button
            onClick={() => {
              setSelectedRentalForCheckin(item);
              setShowCheckinConfirmModal(true);
            }}
            className="flex items-center gap-1 px-3 py-1.5 bg-emerald-950/50 hover:bg-emerald-900/90 border border-emerald-500/40 text-emerald-300 rounded text-xs font-semibold uppercase tracking-wider transition"
          >
            <CheckCircle className="w-3.5 h-3.5" />
            Check In Machine
          </button>
        ) : (
          <span className="text-xs text-slate-500 font-mono">Completed</span>
        )
      )
    }
  ];

  return (
    <MainLayout title="Rental Contracts & Dispatch">
      {/* Header Bar */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-bold text-white uppercase tracking-wider">Active Rental Directory</h3>
          <p className="text-xs text-slate-400">Track machine check-outs, return schedules, and contract statuses</p>
        </div>

        <button
          onClick={() => setShowCheckoutModal(true)}
          className="flex items-center gap-2 px-4 py-2.5 bg-cat-500 hover:bg-cat-600 text-black font-extrabold text-xs uppercase tracking-wider rounded-xl shadow-lg shadow-cat-500/20 transition"
        >
          <Plus className="w-4 h-4" />
          Checkout Equipment
        </button>
      </div>

      {loading ? (
        <LoadingSpinner label="Loading active rental contracts..." />
      ) : error ? (
        <ErrorState message={error} onRetry={loadData} />
      ) : (
        <DataTable
          columns={columns}
          data={rentals}
          searchPlaceholder="Search machine ID, operator, site, contract status..."
        />
      )}

      {/* Checkout Modal */}
      <Modal
        isOpen={showCheckoutModal}
        onClose={() => setShowCheckoutModal(false)}
        title="Dispatch & Checkout Machine"
      >
        <form onSubmit={handleCheckout} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold uppercase text-slate-300 mb-1">
              Select Available Machine
            </label>
            <select
              required
              value={checkoutData.equipment_id}
              onChange={(e) => setCheckoutData({ ...checkoutData, equipment_id: e.target.value })}
              className="w-full p-2.5 bg-industrial-bg border border-industrial-border rounded-lg text-sm text-white focus:border-cat-500 focus:outline-none"
            >
              <option value="">-- Choose Machine --</option>
              {availableEquipment.map((eq) => (
                <option key={eq.id} value={eq.id}>
                  {eq.equipment_id} - {eq.model} ({eq.equipment_type})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase text-slate-300 mb-1">
              Destination Mining / Project Site
            </label>
            <select
              required
              value={checkoutData.site_id}
              onChange={(e) => setCheckoutData({ ...checkoutData, site_id: e.target.value })}
              className="w-full p-2.5 bg-industrial-bg border border-industrial-border rounded-lg text-sm text-white focus:border-cat-500 focus:outline-none"
            >
              <option value="">-- Choose Destination Site --</option>
              {sites.map((site) => (
                <option key={site.id} value={site.id}>
                  {site.site_code} - {site.site_name} ({site.location})
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold uppercase text-slate-300 mb-1">
                Assigned Operator ID
              </label>
              <input
                type="number"
                value={checkoutData.operator_id}
                onChange={(e) => setCheckoutData({ ...checkoutData, operator_id: e.target.value })}
                className="w-full p-2.5 bg-industrial-bg border border-industrial-border rounded-lg text-sm text-white font-mono focus:border-cat-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase text-slate-300 mb-1">
                Rental Duration (Days)
              </label>
              <input
                type="number"
                min="1"
                max="365"
                value={checkoutData.expected_return_days}
                onChange={(e) => setCheckoutData({ ...checkoutData, expected_return_days: e.target.value })}
                className="w-full p-2.5 bg-industrial-bg border border-industrial-border rounded-lg text-sm text-white font-mono focus:border-cat-500 focus:outline-none"
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-industrial-border">
            <button
              type="button"
              onClick={() => setShowCheckoutModal(false)}
              className="px-4 py-2 bg-slate-800 text-slate-300 rounded-lg text-xs font-bold uppercase hover:bg-slate-700"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 bg-cat-500 hover:bg-cat-600 text-black font-extrabold text-xs uppercase rounded-lg shadow"
            >
              Confirm Checkout & Dispatch
            </button>
          </div>
        </form>
      </Modal>

      {/* Safe Check-In Confirmation Modal */}
      <Modal
        isOpen={showCheckinConfirmModal}
        onClose={() => setShowCheckinConfirmModal(false)}
        title="Confirm Equipment Return & Check-In"
        maxWidth="max-w-md"
      >
        {selectedRentalForCheckin && (
          <div className="space-y-4">
            <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-400">Machine ID:</span>
                <span className="text-cat-500 font-mono font-bold">{selectedRentalForCheckin.equipment_code}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Model:</span>
                <span className="text-white font-semibold">{selectedRentalForCheckin.equipment_model}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Deployed Site:</span>
                <span className="text-slate-200">{selectedRentalForCheckin.site_name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Checkout Date:</span>
                <span className="text-slate-300 font-mono">{new Date(selectedRentalForCheckin.checkout_time).toLocaleDateString()}</span>
              </div>
            </div>

            <p className="text-xs text-slate-300">
              Confirming this return will mark the rental contract as <strong className="text-emerald-400 uppercase">COMPLETED</strong>, release the machine status to <strong className="text-emerald-400 uppercase">AVAILABLE</strong>, and clear operator assignments.
            </p>

            <div className="flex justify-end gap-3 pt-3 border-t border-industrial-border">
              <button
                type="button"
                onClick={() => setShowCheckinConfirmModal(false)}
                className="px-4 py-2 bg-slate-800 text-slate-300 rounded-lg text-xs font-bold uppercase hover:bg-slate-700"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmCheckin}
                className="px-5 py-2 bg-emerald-500 hover:bg-emerald-600 text-black font-extrabold text-xs uppercase rounded-lg shadow"
              >
                Confirm Return & Release
              </button>
            </div>
          </div>
        )}
      </Modal>
    </MainLayout>
  );
};
