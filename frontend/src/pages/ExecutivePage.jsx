import React, { useState, useEffect } from 'react';
import { MainLayout } from '../layouts/MainLayout';
import { ExecutiveKpiCards } from '../components/ExecutiveKpiCards';
import { CostImpactPanel } from '../components/CostImpactPanel';
import { OptimizationOpportunityPanel } from '../components/OptimizationOpportunityPanel';
import { MaintenanceRiskPanel } from '../components/MaintenanceRiskPanel';
import { FuelEfficiencyPanel } from '../components/FuelEfficiencyPanel';
import { AssumptionsModal } from '../components/AssumptionsModal';
import { WhatIfModal } from '../components/WhatIfModal';
import businessService from '../services/businessService';
import { equipmentService } from '../services/equipmentService';
import { siteService } from '../services/siteService';
import { useToast } from '../context/ToastContext';
import { Info, Sparkles, RefreshCw } from 'lucide-react';

export const ExecutivePage = () => {
  const [summary, setSummary] = useState(null);
  const [costsData, setCostsData] = useState(null);
  const [idleData, setIdleData] = useState(null);
  const [fuelData, setFuelData] = useState(null);
  const [risksData, setRisksData] = useState(null);
  const [oppsData, setOppsData] = useState(null);
  const [config, setConfig] = useState(null);
  const [loading, setLoading] = useState(true);

  const [assumptionsOpen, setAssumptionsOpen] = useState(false);
  const [whatIfOpen, setWhatIfOpen] = useState(false);
  const [selectedOpp, setSelectedOpp] = useState(null);
  const [equipmentList, setEquipmentList] = useState([]);
  const [sitesList, setSitesList] = useState([]);

  const { addToast } = useToast();

  const loadData = async () => {
    setLoading(true);
    try {
      const [sumRes, costsRes, idleRes, fuelRes, risksRes, oppsRes, cfgRes, eqRes, siteRes] = await Promise.all([
        businessService.getExecutiveSummary(),
        businessService.getAssetCosts(),
        businessService.getIdleImpact(),
        businessService.getFuelEfficiency(),
        businessService.getMaintenanceRisk(),
        businessService.getOptimizationOpportunities(),
        businessService.getConfigAssumptions(),
        equipmentService.getEquipment(),
        siteService.getSites()
      ]);

      setSummary(sumRes);
      setCostsData(costsRes);
      setIdleData(idleRes);
      setFuelData(fuelRes);
      setRisksData(risksRes);
      setOppsData(oppsRes);
      setConfig(cfgRes);
      setEquipmentList(eqRes);
      setSitesList(siteRes);
    } catch (e) {
      console.error(e);
      addToast('Error loading executive intelligence data', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleSelectWhatIf = (opp) => {
    setSelectedOpp(opp);
    setWhatIfOpen(true);
  };

  return (
    <MainLayout title="Executive Fleet Intelligence">
      <div className="space-y-6">
        {/* Header Bar */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-slate-900 border border-industrial-border rounded-2xl p-5 shadow-xl">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-black text-white tracking-tight">Executive Fleet Intelligence</h1>
              <span className="px-2.5 py-0.5 rounded text-[10px] font-bold uppercase font-mono bg-cat-500/20 text-cat-400 border border-cat-500/30">
                MANAGER EXCLUSIVE
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Fleet cost intelligence, idle business impact, carbon insights & 0–100 optimization scoring.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setAssumptionsOpen(true)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-950 hover:bg-slate-800 border border-slate-800 text-xs font-mono font-bold text-slate-300 transition"
            >
              <Info className="w-4 h-4 text-cat-400" />
              Assumptions
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

        {/* Executive KPI Cards */}
        <ExecutiveKpiCards summary={summary} />

        {/* Top Optimization Opportunities */}
        <OptimizationOpportunityPanel
          opportunities={oppsData ? oppsData.opportunities : []}
          onSelectWhatIf={handleSelectWhatIf}
        />

        {/* Fleet Cost & Idle Impact Panel */}
        <CostImpactPanel costsData={costsData} idleData={idleData} />

        {/* Maintenance Risk & Fuel Efficiency Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <MaintenanceRiskPanel risksData={risksData} />
          <FuelEfficiencyPanel fuelData={fuelData} />
        </div>
      </div>

      {/* Assumptions Modal */}
      <AssumptionsModal
        isOpen={assumptionsOpen}
        onClose={() => setAssumptionsOpen(false)}
        config={config}
      />

      {/* What-If Simulator Modal */}
      <WhatIfModal
        isOpen={whatIfOpen}
        onClose={() => setWhatIfOpen(false)}
        equipmentList={equipmentList}
        sitesList={sitesList}
      />
    </MainLayout>
  );
};
