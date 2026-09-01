import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  Truck,
  MapPin,
  FileText,
  Wrench,
  AlertTriangle,
  HardHat,
  ShieldCheck,
  ShieldAlert,
  Zap,
  TrendingUp
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export const Sidebar = () => {
  const { isManager, isOperator, user } = useAuth();

  const managerLinks = [
    { to: '/dashboard', label: 'Fleet Executive Dashboard', icon: LayoutDashboard },
    { to: '/incidents', label: 'Incident Command', icon: ShieldAlert },
    { to: '/executive', label: 'Executive Intelligence', icon: TrendingUp },
    { to: '/predictive-maintenance', label: 'Predictive Maintenance', icon: ShieldCheck },
    { to: '/equipment', label: 'Equipment Directory', icon: Truck },
    { to: '/rentals', label: 'Rental Operations', icon: FileText },
    { to: '/sites', label: 'Mining & Project Sites', icon: MapPin },
    { to: '/maintenance', label: 'Servicing & Repairs', icon: Wrench },
    { to: '/alerts', label: 'Telematics Alerts', icon: AlertTriangle },
  ];

  const operatorLinks = [
    { to: '/operator', label: 'My Assigned Machine', icon: HardHat },
    { to: '/equipment', label: 'Available Fleet', icon: Truck },
    { to: '/rentals', label: 'Active Rentals', icon: FileText },
    { to: '/alerts', label: 'Telemetry Alerts', icon: AlertTriangle },
  ];

  const links = isManager ? managerLinks : operatorLinks;

  return (
    <aside className="w-64 bg-slate-950 border-r border-industrial-border min-h-screen flex flex-col justify-between select-none">
      {/* Brand Header */}
      <div>
        <div className="p-5 border-b border-industrial-border flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-cat-500 flex items-center justify-center text-black font-extrabold text-lg shadow-lg shadow-cat-500/20">
            <Zap className="w-5 h-5 fill-current" />
          </div>
          <div>
            <h1 className="text-base font-extrabold text-white tracking-tight flex items-center gap-1.5">
              CAT <span className="text-cat-500">FLEET</span>
            </h1>
            <p className="text-[10px] text-slate-400 font-mono uppercase tracking-widest">
              Rental & Telematics Intelligence
            </p>
          </div>
        </div>

        {/* User Role Indicator Pill */}
        <div className="px-5 py-3 bg-slate-900/60 border-b border-industrial-border flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-cat-500" />
            <span className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
              {user?.role || 'User'} Mode
            </span>
          </div>
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
        </div>

        {/* Navigation Section */}
        <nav className="p-3 space-y-1">
          {links.map((link) => {
            const Icon = link.icon;
            return (
              <NavLink
                key={link.to}
                to={link.to}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-xs font-semibold uppercase tracking-wider transition duration-150 ${
                    isActive
                      ? 'bg-cat-500/10 text-cat-500 border border-cat-500/30'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
                  }`
                }
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span>{link.label}</span>
              </NavLink>
            );
          })}
        </nav>
      </div>

      {/* System Status Footer */}
      <div className="p-4 border-t border-industrial-border bg-slate-900/40 text-[11px] text-slate-500 font-mono">
        <div className="flex items-center justify-between mb-1">
          <span>Telemetry Engine</span>
          <span className="text-emerald-400 font-semibold">ONLINE</span>
        </div>
        <div className="text-[10px] text-slate-600">v1.0.0 Enterprise Build</div>
      </div>
    </aside>
  );
};
