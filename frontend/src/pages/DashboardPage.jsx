import React, { useEffect, useState } from 'react';
import {
  Truck, Activity, Fuel, AlertTriangle, TrendingUp, BarChart2,
  PieChart as PieChartIcon, Bot, Zap, Brain, ChevronRight
} from 'lucide-react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, PieChart, Pie, Cell } from 'recharts';

import { MainLayout } from '../layouts/MainLayout';
import { MetricCard } from '../components/MetricCard';
import { StatusBadge } from '../components/StatusBadge';
import { LoadingSpinner, ErrorState } from '../components/StateViews';
import { FleetMap } from '../components/FleetMap';
import { TelemetryEventLog } from '../components/TelemetryEventLog';
import { SimulationControllerBar } from '../components/SimulationControllerBar';
import { SmartRecommendationPanel } from '../components/SmartRecommendationPanel';
import { AIFleetAssistantDrawer } from '../components/AIFleetAssistantDrawer';

import { dashboardService } from '../services/dashboardService';
import { alertService } from '../services/alertService';
import { equipmentService } from '../services/equipmentService';
import { siteService } from '../services/siteService';
import { aiService } from '../services/aiService';
import { useWebSocket } from '../hooks/useWebSocket';
import { useAuth } from '../context/AuthContext';

const STATUS_COLORS = {
  AVAILABLE: '#10B981',
  RENTED: '#6366F1',
  ACTIVE: '#3B82F6',
  IDLE: '#F59E0B',
  OVERDUE: '#F43F5E',
  MAINTENANCE: '#F97316'
};

export const DashboardPage = () => {
  const [stats, setStats] = useState(null);
  const [charts, setCharts] = useState(null);
  const [alerts, setAlerts] = useState([]);
  const [equipmentList, setEquipmentList] = useState([]);
  const [sites, setSites] = useState([]);
  const [aiData, setAiData] = useState({ recommendations: [], anomalies: [], underutilized: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [assistantOpen, setAssistantOpen] = useState(false);

  const { connectionStatus, lastMessage, eventFeed } = useWebSocket();
  const { isManager } = useAuth();

  const loadDashboardData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [statsData, chartsData, alertsData, eqData, sitesData] = await Promise.all([
        dashboardService.getStats(),
        dashboardService.getCharts(),
        alertService.getAlerts({ is_resolved: false }),
        equipmentService.getEquipment(),
        siteService.getSites()
      ]);
      setStats(statsData);
      setCharts(chartsData);
      setAlerts(alertsData);
      setEquipmentList(eqData);
      setSites(sitesData);

      // Load AI intelligence data for managers
      if (isManager) {
        const [recs, anomalies, underutil] = await Promise.all([
          aiService.getRecommendations().catch(() => ({ recommendations: [] })),
          aiService.getAnomalies().catch(() => ({ anomalies: [] })),
          aiService.getUnderutilized().catch(() => ({ under_utilized: [] })),
        ]);
        setAiData({
          recommendations: recs.recommendations || [],
          anomalies: anomalies.anomalies || [],
          underutilized: underutil.under_utilized || [],
        });
      }
    } catch (err) {
      setError('Unable to load fleet command center data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDashboardData();
  }, []);

  // Targeted state updates on WebSocket telemetry frames (no full page reload)
  useEffect(() => {
    if (lastMessage && lastMessage.type === 'TELEMETRY_UPDATE') {
      setEquipmentList((prev) =>
        prev.map((eq) =>
          eq.equipment_id === lastMessage.equipment_id
            ? { ...eq, latitude: lastMessage.latitude, longitude: lastMessage.longitude,
                engine_hours: lastMessage.engine_hours, idle_hours: lastMessage.idle_hours,
                fuel_usage: lastMessage.fuel_usage, utilization: lastMessage.utilization,
                status: lastMessage.status }
            : eq
        )
      );
    }
  }, [lastMessage]);

  if (loading) {
    return (
      <MainLayout title="Fleet Operations Command Center">
        <LoadingSpinner label="Connecting to telemetry stream & loading AI intelligence layer..." />
      </MainLayout>
    );
  }

  if (error) {
    return (
      <MainLayout title="Fleet Operations Command Center">
        <ErrorState message={error} onRetry={loadDashboardData} />
      </MainLayout>
    );
  }

  return (
    <MainLayout title="Fleet Operations Command Center">
      {/* AI Fleet Assistant Drawer */}
      <AIFleetAssistantDrawer isOpen={assistantOpen} onClose={() => setAssistantOpen(false)} />

      {/* Simulation Controller Bar */}
      <SimulationControllerBar connectionStatus={connectionStatus} />

      {/* Top Fleet KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <MetricCard
          title="Total Managed Fleet"
          value={stats.total_equipment}
          unit="units"
          icon={Truck}
          subtitle={`${stats.available_count} Available | ${stats.active_count} Active`}
          trend="+12% Fleet Growth"
          trendType="positive"
        />
        <MetricCard
          title="Avg Fleet Utilization"
          value={stats.avg_utilization}
          unit="%"
          icon={TrendingUp}
          subtitle="Engine / Total Hours"
          trend="+4.2% Efficiency"
          trendType="positive"
        />
        <MetricCard
          title="Avg Fuel Consumption"
          value={stats.avg_fuel_usage}
          unit="L / hr"
          icon={Fuel}
          subtitle="Heavy Machinery Fleet"
          trend="Nominal Burn Rate"
          trendType="neutral"
        />
        <MetricCard
          title="Active Fleet Alerts"
          value={stats.active_alerts}
          unit="alerts"
          icon={AlertTriangle}
          subtitle={`${stats.overdue_count} Overdue | ${stats.maintenance_count} Maintenance`}
          trend={stats.active_alerts > 0 ? "Attention Required" : "Fleet Nominal"}
          trendType={stats.active_alerts > 0 ? "negative" : "positive"}
        />
      </div>

      {/* AI Fleet Intelligence Strip (Manager only) */}
      {isManager && (
        <div className="bg-slate-900 border border-cat-500/20 rounded-2xl p-5 shadow-xl">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-cat-500/10 border border-cat-500/30">
                <Brain className="w-5 h-5 text-cat-500" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white uppercase tracking-wider">AI Fleet Intelligence</h3>
                <p className="text-xs text-cat-400 font-mono">AI PREDICTED / ESTIMATED · Analyze → Predict → Explain → Recommend</p>
              </div>
            </div>
            <button
              onClick={() => setAssistantOpen(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-cat-500/10 hover:bg-cat-500/20 border border-cat-500/30 text-cat-400 text-xs font-bold transition"
            >
              <Bot className="w-4 h-4" />
              Open AI Assistant
            </button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            {[
              { label: 'Analyzed Assets', value: equipmentList.length, color: 'text-slate-200' },
              { label: 'Under-Utilized', value: aiData.underutilized.length, color: 'text-amber-400' },
              { label: 'AI Anomalies', value: aiData.anomalies.length, color: 'text-rose-400' },
              { label: 'High-Demand Sites', value: 4, color: 'text-blue-400' },
              { label: 'Smart Recommendations', value: aiData.recommendations.length, color: 'text-emerald-400' },
            ].map((kpi) => (
              <div key={kpi.label} className="bg-slate-800/60 border border-slate-700 rounded-xl p-3 text-center">
                <div className={`text-2xl font-mono font-black ${kpi.color}`}>{kpi.value}</div>
                <div className="text-[10px] text-slate-400 mt-0.5 leading-tight">{kpi.label}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Main Command Center: Map & Live Feed */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <Activity className="w-4 h-4 text-cat-500" />
              Live Interactive Machinery Map
            </h3>
            <span className="text-xs text-slate-400 font-mono">Simulated GPS Markers</span>
          </div>
          <FleetMap equipment={equipmentList} sites={sites} />
        </div>
        <TelemetryEventLog events={eventFeed} />
      </div>

      {/* AI Recommendations & Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Smart Recommendations */}
        {isManager && (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-cat-500" />
              <h3 className="text-sm font-bold text-white uppercase tracking-wider">Smart Reallocation Recommendations</h3>
            </div>
            <SmartRecommendationPanel
              recommendations={aiData.recommendations}
              sites={sites}
            />
          </div>
        )}

        {/* Status & Site Performance Charts */}
        <div className="space-y-5">
          {/* Status Pie */}
          <div className="bg-industrial-card border border-industrial-border rounded-2xl p-5 shadow-xl">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2 mb-4">
              <PieChartIcon className="w-4 h-4 text-cat-500" />
              Equipment Status Distribution
            </h3>
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={charts.status_distribution} cx="50%" cy="50%" innerRadius={40} outerRadius={72} paddingAngle={4} dataKey="value">
                    {charts.status_distribution.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={STATUS_COLORS[entry.name] || '#64748B'} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ backgroundColor: '#0F172A', borderColor: '#1E293B', color: '#FFF' }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="grid grid-cols-3 gap-2 text-[11px] pt-3 border-t border-industrial-border">
              {charts.status_distribution.map((item) => (
                <div key={item.name} className="flex items-center gap-1.5 font-mono">
                  <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: STATUS_COLORS[item.name] || '#64748B' }} />
                  <span className="text-slate-300">{item.name}: {item.value}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Site Utilization Bar Chart */}
          <div className="bg-industrial-card border border-industrial-border rounded-2xl p-5 shadow-xl">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2 mb-4">
              <BarChart2 className="w-4 h-4 text-cat-500" />
              Site Utilization (%)
            </h3>
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={charts.site_performance}>
                  <XAxis dataKey="site_code" stroke="#64748B" fontSize={10} />
                  <YAxis stroke="#64748B" fontSize={10} unit="%" />
                  <Tooltip contentStyle={{ backgroundColor: '#0F172A', borderColor: '#1E293B', color: '#FFF' }} />
                  <Bar dataKey="avg_utilization" fill="#F59E0B" radius={[4, 4, 0, 0]} name="Avg Util %" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </div>

      {/* Active Alerts Table */}
      <div className="bg-industrial-card border border-industrial-border rounded-2xl shadow-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-400" />
            Active Fleet Telematics & Geofence Alerts
          </h3>
        </div>
        {alerts.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-900/60 text-xs uppercase text-slate-400 border-b border-industrial-border">
                <tr>
                  <th className="py-3 px-4">Equipment ID</th>
                  <th className="py-3 px-4">Alert Type</th>
                  <th className="py-3 px-4">Severity</th>
                  <th className="py-3 px-4">Message</th>
                  <th className="py-3 px-4">Logged Time</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-industrial-border/60">
                {alerts.slice(0, 6).map((alert) => (
                  <tr key={alert.id} className="hover:bg-slate-900/40">
                    <td className="py-3 px-4 font-mono font-bold text-cat-500">{alert.equipment_code}</td>
                    <td className="py-3 px-4 text-slate-200 font-mono text-xs">{alert.alert_type}</td>
                    <td className="py-3 px-4"><StatusBadge status={alert.severity} /></td>
                    <td className="py-3 px-4 text-slate-300 max-w-xs truncate">{alert.message}</td>
                    <td className="py-3 px-4 text-slate-400 text-xs font-mono">{new Date(alert.created_at).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-8 text-center text-slate-400 text-sm">
            All equipment operating nominal. No active alerts reported.
          </div>
        )}
      </div>
    </MainLayout>
  );
};
