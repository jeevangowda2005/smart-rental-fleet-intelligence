import React, { useState, useEffect } from 'react';
import { MainLayout } from '../layouts/MainLayout';
import { MaintenanceRiskOverview } from '../components/MaintenanceRiskOverview';
import { MaintenancePriorityTable } from '../components/MaintenancePriorityTable';
import { EarlyWarningPanel } from '../components/EarlyWarningPanel';
import { MaintenanceWhatIfModal } from '../components/MaintenanceWhatIfModal';
import { PredictiveAlertFeed } from '../components/PredictiveAlertFeed';
import predictiveMaintenanceService from '../services/predictiveMaintenanceService';
import { equipmentService } from '../services/equipmentService';
import { useToast } from '../context/ToastContext';
import { RefreshCw, Wrench, ShieldAlert } from 'lucide-react';

export const PredictiveMaintenancePage = () => {
  const [riskData, setRiskData] = useState(null);
  const [priorities, setPriorities] = useState([]);
  const [earlyWarnings, setEarlyWarnings] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [equipmentList, setEquipmentList] = useState([]);
  const [loading, setLoading] = useState(true);

  const [whatIfOpen, setWhatIfOpen] = useState(false);
  const [selectedEq, setSelectedEq] = useState(null);

  const { addToast } = useToast();

  const loadData = async () => {
    setLoading(true);
    try {
      const [riskRes, prioRes, warnRes, alertRes, eqRes] = await Promise.all([
        predictiveMaintenanceService.getFleetRisk(),
        predictiveMaintenanceService.getPriorities(),
        predictiveMaintenanceService.getEarlyWarnings(),
        predictiveMaintenanceService.getPredictiveAlerts(),
        equipmentService.getEquipment()
      ]);

      setRiskData(riskRes);
      setPriorities(prioRes.priorities || []);
      setEarlyWarnings(warnRes.early_warnings || []);
      setAlerts(alertRes.predictive_alerts || []);
      setEquipmentList(eqRes || []);
    } catch (e) {
      console.error(e);
      addToast('Error loading predictive maintenance intelligence', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleSelectWhatIf = (item) => {
    setSelectedEq(item);
    setWhatIfOpen(true);
  };

  return (
    <MainLayout title="Predictive Maintenance Command Center">
      <div className="space-y-6">
        {/* Header Bar */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-slate-900 border border-industrial-border rounded-2xl p-5 shadow-xl">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-black text-white tracking-tight">Predictive Maintenance Command Center</h1>
              <span className="px-2.5 py-0.5 rounded text-[10px] font-bold uppercase font-mono bg-cat-500/20 text-cat-400 border border-cat-500/30">
                MANAGER EXCLUSIVE
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Early warning signal detection, 0–100 risk scoring, trend tracking & predictive service prioritization.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => { setSelectedEq(null); setWhatIfOpen(true); }}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-950 hover:bg-slate-800 border border-slate-800 text-xs font-mono font-bold text-slate-300 transition"
            >
              <Wrench className="w-4 h-4 text-cat-400" />
              Service What-If
            </button>

            <button
              onClick={loadData}
              disabled={loading}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-cat-500 hover:bg-cat-400 text-black font-extrabold text-xs font-mono uppercase tracking-wider transition"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>
        </div>

        {/* Overview Cards */}
        <MaintenanceRiskOverview riskData={riskData} />

        {/* Ranked Maintenance Priority Table */}
        <MaintenancePriorityTable
          priorities={priorities}
          onSelectWhatIf={handleSelectWhatIf}
        />

        {/* Early Warning Signals & Predictive Alerts Feed */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <EarlyWarningPanel earlyWarnings={earlyWarnings} />
          <PredictiveAlertFeed alerts={alerts} />
        </div>
      </div>

      {/* What-If Modal */}
      <MaintenanceWhatIfModal
        isOpen={whatIfOpen}
        onClose={() => setWhatIfOpen(false)}
        equipmentList={equipmentList}
        defaultEquipment={selectedEq}
      />
    </MainLayout>
  );
};
