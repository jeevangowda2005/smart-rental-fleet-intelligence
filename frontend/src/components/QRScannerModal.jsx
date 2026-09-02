import React, { useState, useEffect, useRef } from 'react';
import {
  QrCode, Camera, Keyboard, CheckCircle, AlertTriangle, X, Search,
  MapPin, HardHat, Clock, Gauge, ShieldAlert, ArrowRight, RefreshCw, Truck
} from 'lucide-react';
import { Html5Qrcode } from 'html5-qrcode';
import { Modal } from './Modal';
import { StatusBadge } from './StatusBadge';
import { equipmentService } from '../services/equipmentService';
import { rentalService } from '../services/rentalService';
import { siteService } from '../services/siteService';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';

export const QRScannerModal = ({ isOpen, onClose, onOperationSuccess }) => {
  const [activeTab, setActiveTab] = useState('camera'); // 'camera' | 'manual'
  const [manualCode, setManualCode] = useState('');
  
  // Scanning state
  const [isScanning, setIsScanning] = useState(false);
  const [cameraError, setCameraError] = useState(null);
  
  // Equipment identification state
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [identifiedEquipment, setIdentifiedEquipment] = useState(null);
  const [sites, setSites] = useState([]);
  
  // Action form state
  const [actionLoading, setActionLoading] = useState(false);
  const [checkoutForm, setCheckoutForm] = useState({
    site_id: '',
    operator_id: '2',
    expected_return_days: 7
  });

  const { user, isOperator } = useAuth();
  const { addToast } = useToast();
  const qrScannerRef = useRef(null);

  // Quick Demo Equipment Tags
  const sampleEquipmentCodes = [
    { code: 'CAT-EXC-349', label: 'CAT-EXC-349 (Active)', status: 'ACTIVE' },
    { code: 'CAT-EXC-390', label: 'CAT-EXC-390 (Available)', status: 'AVAILABLE' },
    { code: 'CAT-TRK-745', label: 'CAT-TRK-745 (Overdue)', status: 'OVERDUE' },
    { code: 'CAT-WLD-980', label: 'CAT-WLD-980 (Available)', status: 'AVAILABLE' },
    { code: 'CAT-DOZ-D11', label: 'CAT-DOZ-D11 (Active)', status: 'ACTIVE' },
    { code: 'CAT-CMP-825', label: 'CAT-CMP-825 (Available)', status: 'AVAILABLE' },
  ];

  // Load sites when modal opens
  useEffect(() => {
    if (isOpen) {
      siteService.getSites()
        .then(setSites)
        .catch(console.error);
    } else {
      stopCameraScanner();
      resetState();
    }
  }, [isOpen]);

  // Handle Camera initialization
  useEffect(() => {
    if (isOpen && activeTab === 'camera') {
      startCameraScanner();
    } else {
      stopCameraScanner();
    }
    return () => {
      stopCameraScanner();
    };
  }, [isOpen, activeTab]);

  const resetState = () => {
    setIdentifiedEquipment(null);
    setError(null);
    setCameraError(null);
    setManualCode('');
    setCheckoutForm({
      site_id: '',
      operator_id: isOperator ? (user?.id ? String(user.id) : '2') : '2',
      expected_return_days: 7
    });
  };

  const startCameraScanner = async () => {
    setCameraError(null);
    setIsScanning(true);

    try {
      // Delay slightly for DOM element to render
      await new Promise(r => setTimeout(r, 200));

      const readerElement = document.getElementById('qr-camera-viewport');
      if (!readerElement) return;

      if (qrScannerRef.current) {
        await stopCameraScanner();
      }

      const html5QrCode = new Html5Qrcode('qr-camera-viewport');
      qrScannerRef.current = html5QrCode;

      const config = { fps: 10, qrbox: { width: 220, height: 220 } };

      await html5QrCode.start(
        { facingMode: 'environment' },
        config,
        (decodedText) => {
          handleScannedCode(decodedText);
        },
        () => {
          // ignore scan frame errors
        }
      );
    } catch (err) {
      console.warn('Camera scanner initialization notice:', err);
      setCameraError('Camera access unavailable or permission denied. Please use Manual Code Entry below.');
      setIsScanning(false);
      // Auto-switch tab to manual if camera fails
      setActiveTab('manual');
    }
  };

  const stopCameraScanner = async () => {
    if (qrScannerRef.current) {
      try {
        if (qrScannerRef.current.isScanning) {
          await qrScannerRef.current.stop();
        }
        await qrScannerRef.current.clear();
      } catch (err) {
        // ignore cleanup errors
      } finally {
        qrScannerRef.current = null;
        setIsScanning(false);
      }
    }
  };

  const handleScannedCode = (code) => {
    if (!code) return;
    const cleanCode = code.trim().replace(/^QR-/, '');
    stopCameraScanner();
    setManualCode(cleanCode);
    lookupEquipment(cleanCode);
  };

  const lookupEquipment = async (codeToSearch) => {
    const code = (codeToSearch || manualCode).trim();
    if (!code) {
      setError('Please enter or scan a valid equipment code.');
      return;
    }

    setLoading(true);
    setError(null);
    setIdentifiedEquipment(null);

    try {
      const details = await equipmentService.getEquipmentDetails(code);
      setIdentifiedEquipment(details);
      
      // Auto pre-fill default site if equipment has a site
      if (details.site_id) {
        setCheckoutForm(prev => ({ ...prev, site_id: String(details.site_id) }));
      } else if (sites.length > 0) {
        setCheckoutForm(prev => ({ ...prev, site_id: String(sites[0].id) }));
      }
    } catch (err) {
      const msg = err.response?.data?.detail || `Equipment '${code}' not found in fleet database.`;
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleManualSubmit = (e) => {
    e.preventDefault();
    lookupEquipment(manualCode);
  };

  const handleCheckoutSubmit = async (e) => {
    e.preventDefault();
    if (!identifiedEquipment) return;

    if (!checkoutForm.site_id) {
      addToast('Please select a destination project site.', 'warning');
      return;
    }

    setActionLoading(true);
    try {
      const payload = {
        equipment_id: identifiedEquipment.id,
        site_id: parseInt(checkoutForm.site_id),
        operator_id: isOperator ? (user?.id || 2) : parseInt(checkoutForm.operator_id),
        expected_return_days: parseInt(checkoutForm.expected_return_days)
      };

      await rentalService.checkout(payload);
      addToast(`CHECK-OUT SUCCESS: ${identifiedEquipment.equipment_id} dispatched to site rental!`, 'success');
      
      // Refresh identified equipment details
      const updatedDetails = await equipmentService.getEquipmentDetails(identifiedEquipment.equipment_id);
      setIdentifiedEquipment(updatedDetails);

      if (onOperationSuccess) {
        onOperationSuccess(updatedDetails);
      }
    } catch (err) {
      const msg = err.response?.data?.detail || 'Failed to complete equipment checkout.';
      addToast(msg, 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const handleCheckinSubmit = async () => {
    if (!identifiedEquipment) return;

    setActionLoading(true);
    try {
      let result;
      if (identifiedEquipment.active_rental?.id) {
        result = await rentalService.checkin(identifiedEquipment.active_rental.id);
      } else {
        result = await rentalService.checkinByEquipment(identifiedEquipment.equipment_id);
      }

      addToast(`CHECK-IN SUCCESS: ${identifiedEquipment.equipment_id} returned to depot as AVAILABLE.`, 'success');

      // Refresh identified equipment details
      const updatedDetails = await equipmentService.getEquipmentDetails(identifiedEquipment.equipment_id);
      setIdentifiedEquipment(updatedDetails);

      if (onOperationSuccess) {
        onOperationSuccess(updatedDetails);
      }
    } catch (err) {
      const msg = err.response?.data?.detail || 'Failed to complete equipment check-in.';
      addToast(msg, 'error');
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="QR / RFID Equipment Check-In & Check-Out"
      maxWidth="max-w-2xl"
    >
      <div className="space-y-5">
        {/* Mode Selector Tabs */}
        <div className="flex items-center gap-2 p-1 bg-slate-900 border border-slate-800 rounded-xl">
          <button
            onClick={() => setActiveTab('camera')}
            className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs font-extrabold uppercase tracking-wider transition ${
              activeTab === 'camera'
                ? 'bg-cat-500 text-black shadow-md shadow-cat-500/20'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Camera className="w-4 h-4" />
            Scan QR via Camera
          </button>

          <button
            onClick={() => setActiveTab('manual')}
            className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs font-extrabold uppercase tracking-wider transition ${
              activeTab === 'manual'
                ? 'bg-cat-500 text-black shadow-md shadow-cat-500/20'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Keyboard className="w-4 h-4" />
            Manual Equipment Code
          </button>
        </div>

        {/* TAB 1: Camera Scanner */}
        {activeTab === 'camera' && (
          <div className="flex flex-col items-center justify-center space-y-3">
            <div className="relative w-full max-w-sm h-64 bg-slate-950 border-2 border-cat-500/50 rounded-2xl overflow-hidden flex items-center justify-center shadow-inner">
              <div id="qr-camera-viewport" className="w-full h-full object-cover" />
              
              {/* Reticle / Target Overlay */}
              <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                <div className="w-48 h-48 border-2 border-cat-500/80 rounded-xl relative animate-pulse">
                  <div className="absolute -top-1 -left-1 w-4 h-4 border-t-4 border-l-4 border-cat-500" />
                  <div className="absolute -top-1 -right-1 w-4 h-4 border-t-4 border-r-4 border-cat-500" />
                  <div className="absolute -bottom-1 -left-1 w-4 h-4 border-b-4 border-l-4 border-cat-500" />
                  <div className="absolute -bottom-1 -right-1 w-4 h-4 border-b-4 border-r-4 border-cat-500" />
                  <div className="w-full h-0.5 bg-cat-500/80 absolute top-1/2 -translate-y-1/2 shadow-lg shadow-cat-500 animate-bounce" />
                </div>
              </div>
            </div>

            <p className="text-xs font-mono text-slate-400 text-center">
              Point camera at heavy equipment QR code tag for instant identification.
            </p>
          </div>
        )}

        {/* TAB 2: Manual Code Entry */}
        {activeTab === 'manual' && (
          <div className="space-y-4">
            <form onSubmit={handleManualSubmit} className="flex gap-2">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                <input
                  type="text"
                  required
                  placeholder="Enter Equipment ID (e.g. CAT-EXC-349)"
                  value={manualCode}
                  onChange={(e) => setManualCode(e.target.value.toUpperCase())}
                  className="w-full pl-9 pr-3 py-2.5 bg-industrial-bg border border-industrial-border rounded-xl text-sm font-mono text-white focus:border-cat-500 focus:outline-none"
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="px-5 py-2.5 bg-cat-500 hover:bg-cat-600 text-black font-extrabold text-xs uppercase tracking-wider rounded-xl shadow transition shrink-0"
              >
                {loading ? 'Searching...' : 'Scan / Identify'}
              </button>
            </form>

            {/* Quick Demo Equipment Selector Pills */}
            <div>
              <span className="block text-[11px] font-mono text-slate-400 uppercase mb-2">
                Sample Fleet QR Tags (1-Click Demo Selection):
              </span>
              <div className="flex flex-wrap gap-2">
                {sampleEquipmentCodes.map((item) => (
                  <button
                    key={item.code}
                    type="button"
                    onClick={() => {
                      setManualCode(item.code);
                      lookupEquipment(item.code);
                    }}
                    className={`px-2.5 py-1 rounded-lg text-xs font-mono font-semibold border transition ${
                      manualCode === item.code
                        ? 'bg-cat-500 text-black border-cat-500'
                        : 'bg-slate-900 border-slate-800 text-slate-300 hover:border-cat-500/50 hover:text-cat-500'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Camera Permission / Error Warning Banner */}
        {cameraError && (
          <div className="p-3 bg-amber-950/60 border border-amber-500/40 rounded-xl text-amber-200 text-xs flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
            <span>{cameraError}</span>
          </div>
        )}

        {/* Error Alert */}
        {error && (
          <div className="p-3 bg-rose-950/60 border border-rose-500/40 rounded-xl text-rose-200 text-xs flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-rose-400 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* IDENTIFIED EQUIPMENT DETAILS CARD */}
        {identifiedEquipment && (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4 shadow-xl">
            {/* Header Machine Banner */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono font-bold text-cat-500 uppercase">{identifiedEquipment.equipment_id}</span>
                  <StatusBadge status={identifiedEquipment.status} />
                </div>
                <h3 className="text-lg font-extrabold text-white mt-1">{identifiedEquipment.model}</h3>
                <p className="text-xs text-slate-400 font-mono">{identifiedEquipment.equipment_type}</p>
              </div>

              <div className="text-right sm:text-left bg-slate-950 p-2.5 rounded-xl border border-slate-800 text-xs space-y-1">
                <div className="flex justify-between gap-4"><span className="text-slate-400">Current Site:</span><span className="text-white font-semibold">{identifiedEquipment.site_name}</span></div>
                <div className="flex justify-between gap-4"><span className="text-slate-400">Operator:</span><span className="text-white font-semibold">{identifiedEquipment.operator_name}</span></div>
              </div>
            </div>

            {/* Key Telemetry Stats */}
            <div className="grid grid-cols-3 gap-3 text-xs">
              <div className="p-2.5 bg-slate-950 rounded-xl border border-slate-800 font-mono">
                <span className="text-[10px] text-slate-400 uppercase">Engine Hours</span>
                <div className="font-bold text-white mt-0.5">{identifiedEquipment.engine_hours} hrs</div>
              </div>
              <div className="p-2.5 bg-slate-950 rounded-xl border border-slate-800 font-mono">
                <span className="text-[10px] text-slate-400 uppercase">Idle Hours</span>
                <div className="font-bold text-amber-400 mt-0.5">{identifiedEquipment.idle_hours} hrs</div>
              </div>
              <div className="p-2.5 bg-slate-950 rounded-xl border border-slate-800 font-mono">
                <span className="text-[10px] text-slate-400 uppercase">Utilization</span>
                <div className="font-bold text-cat-500 mt-0.5">{identifiedEquipment.utilization}%</div>
              </div>
            </div>

            {/* ACTION SECTION 1: CHECK-OUT (If Machine Available or Idle) */}
            {(identifiedEquipment.status === 'AVAILABLE' || identifiedEquipment.status === 'IDLE') && (
              <div className="p-4 bg-cat-500/10 border border-cat-500/30 rounded-xl space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-extrabold uppercase text-cat-500 tracking-wider flex items-center gap-1.5">
                    <Truck className="w-4 h-4" />
                    Available for Rental Check-Out
                  </h4>
                  <span className="text-[10px] font-mono text-emerald-400 font-bold uppercase">Ready to Dispatch</span>
                </div>

                <form onSubmit={handleCheckoutSubmit} className="space-y-3 pt-1">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-semibold uppercase text-slate-300 mb-1">
                        Destination Project Site
                      </label>
                      <select
                        required
                        value={checkoutForm.site_id}
                        onChange={(e) => setCheckoutForm({ ...checkoutForm, site_id: e.target.value })}
                        className="w-full p-2 bg-industrial-bg border border-industrial-border rounded-lg text-xs text-white focus:border-cat-500 focus:outline-none"
                      >
                        <option value="">-- Choose Target Site --</option>
                        {sites.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.site_code} - {s.site_name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold uppercase text-slate-300 mb-1">
                        Rental Days
                      </label>
                      <input
                        type="number"
                        min="1"
                        max="365"
                        value={checkoutForm.expected_return_days}
                        onChange={(e) => setCheckoutForm({ ...checkoutForm, expected_return_days: e.target.value })}
                        className="w-full p-2 bg-industrial-bg border border-industrial-border rounded-lg text-xs font-mono text-white focus:border-cat-500 focus:outline-none"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={actionLoading}
                    className="w-full py-2.5 bg-cat-500 hover:bg-cat-600 text-black font-extrabold text-xs uppercase tracking-wider rounded-xl shadow-lg shadow-cat-500/20 transition flex items-center justify-center gap-2"
                  >
                    {actionLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                    Confirm Check-Out & Dispatch Machine
                  </button>
                </form>
              </div>
            )}

            {/* ACTION SECTION 2: CHECK-IN (If Machine Currently Rented, Active, or Overdue) */}
            {(identifiedEquipment.status === 'RENTED' || identifiedEquipment.status === 'ACTIVE' || identifiedEquipment.status === 'OVERDUE') && (
              <div className="p-4 bg-emerald-950/40 border border-emerald-500/30 rounded-xl space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-extrabold uppercase text-emerald-400 tracking-wider flex items-center gap-1.5">
                    <CheckCircle className="w-4 h-4" />
                    Currently Rented Machine (Active Assignment)
                  </h4>
                  <span className="text-[10px] font-mono text-amber-400 font-bold uppercase">Check-In Required</span>
                </div>

                {identifiedEquipment.active_rental && (
                  <div className="p-2.5 bg-slate-950 rounded-lg text-xs space-y-1 font-mono text-slate-300">
                    <div className="flex justify-between"><span className="text-slate-400">Checkout Time:</span><span>{new Date(identifiedEquipment.active_rental.checkout_time).toLocaleDateString()}</span></div>
                    <div className="flex justify-between"><span className="text-slate-400">Expected Return:</span><span>{new Date(identifiedEquipment.active_rental.expected_return_time).toLocaleDateString()}</span></div>
                    <div className="flex justify-between"><span className="text-slate-400">Assigned Site:</span><span>{identifiedEquipment.active_rental.site_name}</span></div>
                  </div>
                )}

                <button
                  type="button"
                  onClick={handleCheckinSubmit}
                  disabled={actionLoading}
                  className="w-full py-2.5 bg-emerald-500 hover:bg-emerald-600 text-black font-extrabold text-xs uppercase tracking-wider rounded-xl shadow-lg shadow-emerald-500/20 transition flex items-center justify-center gap-2"
                >
                  {actionLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                  Confirm Check-In Machine (Return to Depot)
                </button>
              </div>
            )}

            {/* ACTION SECTION 3: MAINTENANCE */}
            {identifiedEquipment.status === 'MAINTENANCE' && (
              <div className="p-4 bg-rose-950/40 border border-rose-500/30 rounded-xl text-xs text-rose-200 flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0" />
                <div>
                  <strong className="block text-white uppercase font-mono">Machine In Maintenance / Repair</strong>
                  Cannot check out machine until servicing is completed and status is set to Available.
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </Modal>
  );
};
