import React, { useState } from 'react';
import { LogOut, Bell, User as UserIcon, Activity, QrCode } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { QRScannerModal } from './QRScannerModal';

export const TopNav = ({ title = 'Fleet Intelligence' }) => {
  const { user, logout } = useAuth();
  const [showScannerModal, setShowScannerModal] = useState(false);

  return (
    <header className="h-16 bg-industrial-card/80 backdrop-blur-md border-b border-industrial-border px-6 flex items-center justify-between sticky top-0 z-40">
      {/* Page Title & Breadcrumb */}
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-lg bg-slate-900 border border-slate-800 text-cat-500">
          <Activity className="w-4 h-4" />
        </div>
        <h2 className="text-base font-bold text-white uppercase tracking-wider">{title}</h2>
      </div>

      {/* Profile & Controls */}
      <div className="flex items-center gap-3">
        {/* Quick QR Scanner Launcher Button */}
        <button
          onClick={() => setShowScannerModal(true)}
          title="Scan Equipment QR Tag"
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-cat-500 hover:bg-cat-600 text-black font-extrabold text-xs uppercase tracking-wider shadow-md shadow-cat-500/20 transition"
        >
          <QrCode className="w-4 h-4" />
          <span className="hidden sm:inline">QR Scan</span>
        </button>

        {/* Notifications Mock Indicator */}
        <button
          title="Telematics Alerts"
          className="p-2 rounded-lg bg-slate-900 border border-slate-800 text-slate-400 hover:text-white hover:border-slate-700 transition relative"
        >
          <Bell className="w-4 h-4" />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-cat-500 animate-pulse" />
        </button>

        {/* User Pill */}
        <div className="flex items-center gap-3 pl-3 border-l border-slate-800">
          <div className="w-8 h-8 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center text-cat-500 font-bold text-xs font-mono">
            {user?.name ? user.name.substring(0, 2).toUpperCase() : 'US'}
          </div>
          <div className="hidden sm:block text-left">
            <div className="text-xs font-bold text-slate-200 leading-tight">{user?.name || 'Operator'}</div>
            <div className="text-[10px] text-slate-400 font-mono leading-tight">{user?.email}</div>
          </div>
        </div>

        {/* Logout Button */}
        <button
          onClick={logout}
          title="Sign Out"
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-950/40 hover:bg-rose-900/80 border border-rose-700/50 text-rose-200 text-xs font-bold uppercase tracking-wider transition"
        >
          <LogOut className="w-3.5 h-3.5" />
          <span className="hidden md:inline">Sign Out</span>
        </button>
      </div>

      <QRScannerModal
        isOpen={showScannerModal}
        onClose={() => setShowScannerModal(false)}
        onOperationSuccess={() => {
          if (window.location.reload) {
            window.location.reload();
          }
        }}
      />
    </header>
  );
};
