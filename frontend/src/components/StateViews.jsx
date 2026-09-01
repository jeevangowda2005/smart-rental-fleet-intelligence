import React from 'react';
import { Loader2, Inbox, AlertTriangle, RefreshCw } from 'lucide-react';

export const LoadingSpinner = ({ label = 'Loading telemetry & fleet status...' }) => (
  <div className="flex flex-col items-center justify-center p-12 space-y-4">
    <div className="relative">
      <div className="w-12 h-12 rounded-full border-2 border-slate-800 border-t-cat-500 animate-spin" />
      <Loader2 className="w-6 h-6 text-cat-500 absolute inset-0 m-auto animate-spin" />
    </div>
    <span className="text-sm font-medium text-slate-400 font-mono tracking-wide">{label}</span>
  </div>
);

export const EmptyState = ({
  title = 'No records found',
  description = 'There are currently no items to display under this view.',
  actionLabel,
  onAction
}) => (
  <div className="flex flex-col items-center justify-center p-12 text-center bg-industrial-card border border-industrial-border rounded-xl">
    <div className="p-4 bg-slate-900/80 rounded-2xl border border-slate-800 text-slate-500 mb-4">
      <Inbox className="w-10 h-10 text-cat-500" />
    </div>
    <h4 className="text-base font-bold text-white mb-1">{title}</h4>
    <p className="text-sm text-slate-400 max-w-md mb-6">{description}</p>
    {actionLabel && onAction && (
      <button
        onClick={onAction}
        className="px-4 py-2 bg-cat-500 hover:bg-cat-600 text-black font-bold text-xs rounded-lg uppercase tracking-wider transition"
      >
        {actionLabel}
      </button>
    )}
  </div>
);

export const ErrorState = ({
  title = 'Failed to load telemetry data',
  message = 'An unexpected network error occurred while connecting to the fleet API backend.',
  onRetry
}) => (
  <div className="flex flex-col items-center justify-center p-10 bg-rose-950/20 border border-rose-500/30 rounded-xl text-center">
    <AlertTriangle className="w-10 h-10 text-rose-400 mb-3" />
    <h4 className="text-base font-bold text-rose-200 mb-1">{title}</h4>
    <p className="text-sm text-rose-300/80 max-w-md mb-5">{message}</p>
    {onRetry && (
      <button
        onClick={onRetry}
        className="flex items-center gap-2 px-4 py-2 bg-rose-900/40 hover:bg-rose-900/80 border border-rose-700 text-rose-100 rounded-lg text-xs font-semibold uppercase tracking-wider transition"
      >
        <RefreshCw className="w-3.5 h-3.5" />
        Retry Connection
      </button>
    )}
  </div>
);
