import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { HardHat, Gauge, Fuel, Clock, MapPin, CheckCircle, Plus, Send, AlertTriangle, ShieldAlert, QrCode, Receipt, FileText } from 'lucide-react';
import { MainLayout } from '../layouts/MainLayout';
import { StatusBadge } from '../components/StatusBadge';
import { Modal } from '../components/Modal';
import { QRScannerModal } from '../components/QRScannerModal';
import { EquipmentQRModal } from '../components/EquipmentQRModal';
import { LoadingSpinner, EmptyState } from '../components/StateViews';
import { RentalIntelligenceCard } from '../components/RentalIntelligenceCard';
import { rentalService } from '../services/rentalService';
import { equipmentService } from '../services/equipmentService';
import { siteService } from '../services/siteService';
import { alertService } from '../services/alertService';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';

export const OperatorView = () => {
  const [activeRental, setActiveRental] = useState(null);
  const [equipmentDetail, setEquipmentDetail] = useState(null);
  const [availableEquipment, setAvailableEquipment] = useState([]);
  const [sites, setSites] = useState([]);
  const [myRentals, setMyRentals] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  // Modal States
  const [showCheckoutModal, setShowCheckoutModal] = useState(false);
  const [showCheckinConfirmModal, setShowCheckinConfirmModal] = useState(false);
  const [showIssueModal, setShowIssueModal] = useState(false);
  const [showScannerModal, setShowScannerModal] = useState(false);
  const [showQRModal, setShowQRModal] = useState(false);

  // Forms
  const [logForm, setLogForm] = useState({
    engine_hours: '',
    idle_hours: '',
    fuel_usage: '',
    operating_status: 'ACTIVE'
  });

  const [checkoutData, setCheckoutData] = useState({
    equipment_id: '',
    site_id: '',
    expected_return_days: 7
  });

  const [issueData, setIssueData] = useState({
    issue_type: 'ENGINE_WARNING',
    severity: 'WARNING',
    description: ''
  });

  const { user } = useAuth();
  const { addToast } = useToast();

  const loadOperatorData = async () => {
    setLoading(true);
    try {
      const [rental, availableEq, sitesData, rentalsList] = await Promise.all([
        rentalService.getMyActiveRental(),
        equipmentService.getEquipment({ status: 'AVAILABLE' }),
        siteService.getSites(),
        rentalService.getRentals()
      ]);
      setActiveRental(rental);
      setAvailableEquipment(availableEq);
      setSites(sitesData);
      setMyRentals(rentalsList);

      if (rental && rental.equipment_id) {
        const eq = await equipmentService.getEquipmentById(rental.equipment_id);
        setEquipmentDetail(eq);
        setLogForm({
          engine_hours: eq.engine_hours,
          idle_hours: eq.idle_hours,
          fuel_usage: eq.fuel_usage,
          operating_status: eq.status === 'IDLE' ? 'IDLE' : 'ACTIVE'
        });
      } else {
        setEquipmentDetail(null);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadOperatorData();
  }, []);

  const handleLogSubmit = async (e) => {
    e.preventDefault();
    if (!equipmentDetail) return;

    const eng = parseFloat(logForm.engine_hours);
    const idle = parseFloat(logForm.idle_hours);
    const fuel = parseFloat(logForm.fuel_usage);

    if (eng < 0 || idle < 0 || fuel < 0) {
      addToast('Engine hours, idle hours, and fuel usage values cannot be negative', 'warning');
      return;
    }

    if (eng < equipmentDetail.engine_hours) {
      addToast(`Engine hours cannot be less than existing recorded meter (${equipmentDetail.engine_hours} hrs)`, 'warning');
      return;
    }

    try {
      await equipmentService.submitUsageLog({
        equipment_id: equipmentDetail.id,
        engine_hours: eng,
        idle_hours: idle,
        fuel_usage: fuel,
        latitude: equipmentDetail.latitude,
        longitude: equipmentDetail.longitude,
        operating_status: logForm.operating_status
      });
      addToast('Telematics & engine hours updated successfully', 'success');
      loadOperatorData();
    } catch (err) {
      addToast(err.response?.data?.detail || 'Failed to record telematics log', 'error');
    }
  };

  const handleCheckout = async (e) => {
    e.preventDefault();
    if (!checkoutData.equipment_id || !checkoutData.site_id) {
      addToast('Please select both a machine and target site', 'warning');
      return;
    }
    try {
      await rentalService.checkout({
        equipment_id: parseInt(checkoutData.equipment_id),
        site_id: parseInt(checkoutData.site_id),
        operator_id: user.id,
        expected_return_days: parseInt(checkoutData.expected_return_days)
      });
      addToast('Machine checked out and assigned to your shift', 'success');
      setShowCheckoutModal(false);
      loadOperatorData();
    } catch (err) {
      addToast(err.response?.data?.detail || 'Failed to check out machine', 'error');
    }
  };

  const confirmCheckin = async () => {
    if (!activeRental) return;
    try {
      const updated = await rentalService.checkin(activeRental.id);
      addToast('Machine checked in & tax invoice generated successfully!', 'success');
      setShowCheckinConfirmModal(false);
      await loadOperatorData();
      navigate(`/billing?rental_id=${activeRental.id}`);
    } catch (err) {
      addToast('Failed to check in machine', 'error');
    }
  };

  const handleReportIssue = async (e) => {
    e.preventDefault();
    if (!equipmentDetail || !issueData.description) {
      addToast('Please enter an issue description', 'warning');
      return;
    }
    try {
      await alertService.reportIssue({
        equipment_id: equipmentDetail.id,
        issue_type: issueData.issue_type,
        severity: issueData.severity,
        description: issueData.description
      });
      addToast('Issue report submitted to Fleet Management', 'success');
      setShowIssueModal(false);
      setIssueData({ issue_type: 'ENGINE_WARNING', severity: 'WARNING', description: '' });
    } catch (err) {
      addToast('Failed to submit issue report', 'error');
    }
  };

  if (loading) {
    return (
      <MainLayout title="Operator Machine Control Panel">
        <LoadingSpinner label="Loading operator assignment details..." />
      </MainLayout>
    );
  }

  return (
    <MainLayout title="Operator Machine Control Panel">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h3 className="text-base font-extrabold text-white flex items-center gap-2">
            <HardHat className="w-5 h-5 text-cat-500" />
            Field Operator Portal
          </h3>
          <p className="text-xs text-slate-400">Operator: <strong className="text-white">{user?.name}</strong> ({user?.email})</p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowScannerModal(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-cat-500 hover:bg-cat-600 text-black font-extrabold text-xs uppercase tracking-wider rounded-xl shadow-lg shadow-cat-500/20 transition"
          >
            <QrCode className="w-4 h-4" />
            Scan QR Code
          </button>

          {!equipmentDetail && (
            <button
              onClick={() => setShowCheckoutModal(true)}
              className="flex items-center gap-2 px-4 py-2.5 bg-slate-900 hover:bg-slate-800 border border-slate-700 text-white font-extrabold text-xs uppercase tracking-wider rounded-xl transition"
            >
              <Plus className="w-4 h-4 text-cat-500" />
              Depot Checkout
            </button>
          )}
        </div>
      </div>

      {equipmentDetail ? (
        <div className="space-y-6">
          {/* Main Machine Banner Card */}
          <div className="bg-industrial-card border border-industrial-border rounded-2xl p-6 shadow-xl relative overflow-hidden">
            <div className="absolute top-0 right-0 w-48 h-48 bg-cat-500/10 rounded-full blur-3xl pointer-events-none" />

            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-b border-industrial-border pb-5">
              <div>
                <span className="text-xs font-mono text-cat-500 font-bold uppercase tracking-widest">
                  {equipmentDetail.equipment_id}
                </span>
                <h2 className="text-2xl font-extrabold text-white mt-1">{equipmentDetail.model}</h2>
                <p className="text-xs text-slate-400 font-mono mt-0.5">{equipmentDetail.equipment_type}</p>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <StatusBadge status={equipmentDetail.status} />

                <button
                  onClick={() => setShowQRModal(true)}
                  className="flex items-center gap-1.5 px-3 py-2 bg-slate-900 hover:bg-slate-800 border border-slate-700 text-cat-500 text-xs font-bold uppercase rounded-xl transition"
                >
                  <QrCode className="w-4 h-4" />
                  View Asset QR
                </button>

                <button
                  onClick={() => setShowIssueModal(true)}
                  className="flex items-center gap-1.5 px-3 py-2 bg-amber-950/60 hover:bg-amber-900 border border-amber-500/40 text-amber-200 text-xs font-bold uppercase rounded-xl transition"
                >
                  <AlertTriangle className="w-4 h-4 text-amber-400" />
                  Report Issue
                </button>

                <button
                  onClick={() => setShowCheckinConfirmModal(true)}
                  className="flex items-center gap-2 px-4 py-2 bg-emerald-950/60 hover:bg-emerald-900 border border-emerald-500/40 text-emerald-200 text-xs font-extrabold uppercase tracking-wider rounded-xl shadow transition"
                >
                  <CheckCircle className="w-4 h-4 text-emerald-400" />
                  Check In Machine
                </button>
              </div>
            </div>

            {/* Quick Metrics */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-5">
              <div className="p-4 bg-slate-900/80 border border-slate-800 rounded-xl">
                <span className="text-[10px] text-slate-400 uppercase font-mono">Engine Meter</span>
                <div className="text-xl font-bold text-white font-mono mt-1">{equipmentDetail.engine_hours} hrs</div>
              </div>
              <div className="p-4 bg-slate-900/80 border border-slate-800 rounded-xl">
                <span className="text-[10px] text-slate-400 uppercase font-mono">Idle Hours</span>
                <div className="text-xl font-bold text-amber-400 font-mono mt-1">{equipmentDetail.idle_hours} hrs</div>
              </div>
              <div className="p-4 bg-slate-900/80 border border-slate-800 rounded-xl">
                <span className="text-[10px] text-slate-400 uppercase font-mono">Fuel Burn Rate</span>
                <div className="text-xl font-bold text-white font-mono mt-1">{equipmentDetail.fuel_usage} L/hr</div>
              </div>
              <div className="p-4 bg-slate-900/80 border border-slate-800 rounded-xl">
                <span className="text-[10px] text-slate-400 uppercase font-mono">Utilization Score</span>
                <div className="text-xl font-bold text-cat-500 font-mono mt-1">{equipmentDetail.utilization}%</div>
              </div>
            </div>

            {/* Active Rental Intelligence Card for Operator */}
            {activeRental && (
              <div className="mt-5">
                <RentalIntelligenceCard rental={activeRental} isOperator={true} />
              </div>
            )}
          </div>

          {/* Telematics Logging Form */}
          <div className="bg-industrial-card border border-industrial-border rounded-2xl p-6 shadow-xl max-w-2xl">
            <h4 className="text-sm font-bold text-white uppercase tracking-wider mb-1 flex items-center gap-2">
              <Gauge className="w-4 h-4 text-cat-500" />
              Log Shift Telematics & Hours
            </h4>
            <p className="text-xs text-slate-400 mb-4">Submit updated hour meter readings and fuel usage.</p>

            <form onSubmit={handleLogSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold uppercase text-slate-300 mb-1">
                    Current Engine Meter (Hours)
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    required
                    value={logForm.engine_hours}
                    onChange={(e) => setLogForm({ ...logForm, engine_hours: e.target.value })}
                    className="w-full p-2.5 bg-industrial-bg border border-industrial-border rounded-lg text-sm text-white font-mono focus:border-cat-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase text-slate-300 mb-1">
                    Current Idle Meter (Hours)
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    required
                    value={logForm.idle_hours}
                    onChange={(e) => setLogForm({ ...logForm, idle_hours: e.target.value })}
                    className="w-full p-2.5 bg-industrial-bg border border-industrial-border rounded-lg text-sm text-white font-mono focus:border-cat-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold uppercase text-slate-300 mb-1">
                    Fuel Burn Rate (L/hr)
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    required
                    value={logForm.fuel_usage}
                    onChange={(e) => setLogForm({ ...logForm, fuel_usage: e.target.value })}
                    className="w-full p-2.5 bg-industrial-bg border border-industrial-border rounded-lg text-sm text-white font-mono focus:border-cat-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase text-slate-300 mb-1">
                    Operating Status Mode
                  </label>
                  <select
                    value={logForm.operating_status}
                    onChange={(e) => setLogForm({ ...logForm, operating_status: e.target.value })}
                    className="w-full p-2.5 bg-industrial-bg border border-industrial-border rounded-lg text-sm text-white focus:border-cat-500 focus:outline-none"
                  >
                    <option value="ACTIVE">ACTIVE OPERATING</option>
                    <option value="IDLE">IDLE / STANDBY</option>
                    <option value="MAINTENANCE">INSPECTION / REPAIR</option>
                  </select>
                </div>
              </div>

              <button
                type="submit"
                className="flex items-center gap-2 px-5 py-2.5 bg-cat-500 hover:bg-cat-600 text-black font-extrabold text-xs uppercase tracking-wider rounded-xl shadow transition"
              >
                <Send className="w-4 h-4" />
                Submit Shift Log
              </button>
            </form>
          </div>
        </div>
      ) : (
        <EmptyState
          title="No Machine Currently Assigned"
          description="You do not have an active equipment rental assignment. Click 'Check Out Available Machine' to claim a machine from depot."
          actionLabel="Check Out Machine"
          onAction={() => setShowCheckoutModal(true)}
        />
      )}

      {/* My Rental & Billing History Section */}
      <div className="bg-industrial-card border border-industrial-border rounded-2xl p-6 shadow-xl space-y-4">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
            <FileText className="w-4 h-4 text-cat-500" />
            My Rental History & Billing Records
          </h4>
          <button
            onClick={() => navigate('/billing')}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 hover:bg-slate-800 border border-slate-700 text-cat-500 text-xs font-extrabold uppercase rounded-lg transition"
          >
            <Receipt className="w-4 h-4" />
            View All Invoices
          </button>
        </div>

        {myRentals.length === 0 ? (
          <p className="text-xs text-slate-400 font-mono">No rental history records found for your account.</p>
        ) : (
          <div className="divide-y divide-industrial-border border border-industrial-border rounded-xl overflow-hidden bg-slate-950/40">
            {myRentals.map((r) => (
              <div key={r.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs font-mono">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-white text-sm">{r.equipment_code}</span>
                    <span className="text-slate-400">({r.equipment_model})</span>
                    <StatusBadge status={r.status} />
                  </div>
                  <div className="text-[11px] text-slate-400 mt-1">
                    Checkout: {new Date(r.checkout_time).toLocaleDateString()} | Site: {r.site_name}
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {r.status === 'COMPLETED' ? (
                    <button
                      onClick={() => navigate(`/billing?rental_id=${r.id}`)}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-cat-500/10 hover:bg-cat-500/20 border border-cat-500/40 text-cat-500 font-bold rounded-lg text-xs transition"
                    >
                      <Receipt className="w-3.5 h-3.5" />
                      View Invoice
                    </button>
                  ) : (
                    <span className="text-emerald-400 font-semibold text-[11px] uppercase">Active Shift Assignment</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Operator Checkout Modal */}
      <Modal
        isOpen={showCheckoutModal}
        onClose={() => setShowCheckoutModal(false)}
        title="Check Out Available Equipment"
      >
        <form onSubmit={handleCheckout} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold uppercase text-slate-300 mb-1">
              Select Available Depot Machine
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
              Destination Site Location
            </label>
            <select
              required
              value={checkoutData.site_id}
              onChange={(e) => setCheckoutData({ ...checkoutData, site_id: e.target.value })}
              className="w-full p-2.5 bg-industrial-bg border border-industrial-border rounded-lg text-sm text-white focus:border-cat-500 focus:outline-none"
            >
              <option value="">-- Choose Site --</option>
              {sites.map((site) => (
                <option key={site.id} value={site.id}>
                  {site.site_code} - {site.site_name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase text-slate-300 mb-1">
              Rental Duration (Days)
            </label>
            <input
              type="number"
              min="1"
              max="180"
              value={checkoutData.expected_return_days}
              onChange={(e) => setCheckoutData({ ...checkoutData, expected_return_days: e.target.value })}
              className="w-full p-2.5 bg-industrial-bg border border-industrial-border rounded-lg text-sm text-white font-mono focus:border-cat-500 focus:outline-none"
            />
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
              Confirm Checkout & Claim
            </button>
          </div>
        </form>
      </Modal>

      {/* Checkin Confirmation Modal */}
      <Modal
        isOpen={showCheckinConfirmModal}
        onClose={() => setShowCheckinConfirmModal(false)}
        title="Confirm Machine Return"
        maxWidth="max-w-md"
      >
        <div className="space-y-4">
          <p className="text-xs text-slate-300">
            Are you sure you want to check in <strong className="text-cat-500">{equipmentDetail?.equipment_id}</strong>? This will release the machine back to the depot as AVAILABLE.
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
              Confirm Machine Return
            </button>
          </div>
        </div>
      </Modal>

      {/* Report Issue Modal */}
      <Modal
        isOpen={showIssueModal}
        onClose={() => setShowIssueModal(false)}
        title="Report Machine Issue / Breakdown"
      >
        <form onSubmit={handleReportIssue} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold uppercase text-slate-300 mb-1">Issue Category</label>
            <select
              value={issueData.issue_type}
              onChange={(e) => setIssueData({ ...issueData, issue_type: e.target.value })}
              className="w-full p-2.5 bg-industrial-bg border border-industrial-border rounded-lg text-sm text-white focus:border-cat-500 focus:outline-none"
            >
              <option value="ENGINE_WARNING">Engine Performance / Overheat</option>
              <option value="HYDRAULIC_LEAK">Hydraulic Pressure / Fluid Leak</option>
              <option value="BRAKE_SYSTEM">Brake & Steering Fault</option>
              <option value="TIRE_TRACK_DAMAGE">Track / Tire Wear Damage</option>
              <option value="OTHER_FAULT">Other Electrical / Structural Fault</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase text-slate-300 mb-1">Severity Level</label>
            <select
              value={issueData.severity}
              onChange={(e) => setIssueData({ ...issueData, severity: e.target.value })}
              className="w-full p-2.5 bg-industrial-bg border border-industrial-border rounded-lg text-sm text-white focus:border-cat-500 focus:outline-none"
            >
              <option value="CRITICAL">CRITICAL (Halt Operation)</option>
              <option value="WARNING">WARNING (Attention Required)</option>
              <option value="INFO">INFO (Minor Maintenance Request)</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase text-slate-300 mb-1">Description & Symptoms</label>
            <textarea
              rows="3"
              required
              placeholder="Describe machine behavior, noise, error codes, or leaks..."
              value={issueData.description}
              onChange={(e) => setIssueData({ ...issueData, description: e.target.value })}
              className="w-full p-2.5 bg-industrial-bg border border-industrial-border rounded-lg text-sm text-white focus:border-cat-500 focus:outline-none"
            />
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-industrial-border">
            <button
              type="button"
              onClick={() => setShowIssueModal(false)}
              className="px-4 py-2 bg-slate-800 text-slate-300 rounded-lg text-xs font-bold uppercase hover:bg-slate-700"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 bg-rose-500 hover:bg-rose-600 text-white font-extrabold text-xs uppercase rounded-lg shadow"
            >
              Submit Issue Alert
            </button>
          </div>
        </form>
      </Modal>

      {/* QR/RFID Scanner Modal */}
      <QRScannerModal
        isOpen={showScannerModal}
        onClose={() => setShowScannerModal(false)}
        onOperationSuccess={() => {
          loadOperatorData();
        }}
      />

      {/* Equipment Scannable QR Tag Modal */}
      <EquipmentQRModal
        isOpen={showQRModal}
        onClose={() => setShowQRModal(false)}
        equipment={equipmentDetail}
      />
    </MainLayout>
  );
};
