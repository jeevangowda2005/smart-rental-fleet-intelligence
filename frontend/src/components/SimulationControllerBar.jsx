import React, { useState, useEffect } from 'react';
import { Play, Pause, FastForward, Radio, ShieldAlert, Cpu } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import api from '../services/api';

export const SimulationControllerBar = ({ connectionStatus }) => {
  const [isRunning, setIsRunning] = useState(true);
  const [speed, setSpeed] = useState(1);
  const [loading, setLoading] = useState(false);

  const { isManager } = useAuth();
  const { addToast } = useToast();

  const fetchStatus = async () => {
    try {
      const resp = await api.get('/api/simulation/status');
      setIsRunning(resp.data.is_running);
      setSpeed(resp.data.speed);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchStatus();
  }, []);

  const toggleStartPause = async () => {
    if (!isManager) return;
    setLoading(true);
    try {
      if (isRunning) {
        await api.post('/api/simulation/pause');
        setIsRunning(false);
        addToast('Demo telemetry simulation paused', 'warning');
      } else {
        await api.post('/api/simulation/start');
        setIsRunning(true);
        addToast('Demo telemetry simulation resumed', 'success');
      }
    } catch (e) {
      addToast('Error toggling simulation state', 'error');
    } finally {
      setLoading(false);
    }
  };

  const changeSpeed = async (newSpeed) => {
    if (!isManager) return;
    setLoading(true);
    try {
      await api.post('/api/simulation/speed', { speed: newSpeed });
      setSpeed(newSpeed);
      addToast(`Simulation speed set to ${newSpeed}x`, 'info');
    } catch (e) {
      addToast('Error setting simulation speed', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-slate-900 border border-industrial-border rounded-2xl p-4 shadow-xl flex flex-col md:flex-row items-center justify-between gap-4">
      {/* Label Banner */}
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-xl bg-cat-500/10 border border-cat-500/30 text-cat-500">
          <Cpu className="w-5 h-5" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-extrabold text-white uppercase tracking-wider font-mono">
              DEMO LIVE SIMULATION
            </span>
            <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase font-mono bg-amber-500/20 text-amber-300 border border-amber-500/30">
              NOT LIVE HARDWARE DATA
            </span>
          </div>
          <p className="text-[11px] text-slate-400">IoT Telemetry & GPS Stream Emulator</p>
        </div>
      </div>

      {/* Connection & Manager Simulation Controls */}
      <div className="flex items-center gap-4">
        {/* WebSocket Connection State Pill */}
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-800 text-xs font-mono">
          <Radio
            className={`w-3.5 h-3.5 ${
              connectionStatus === 'LIVE'
                ? 'text-emerald-400 animate-pulse'
                : connectionStatus === 'RECONNECTING'
                ? 'text-amber-400 animate-spin'
                : 'text-rose-400'
            }`}
          />
          <span
            className={`font-bold ${
              connectionStatus === 'LIVE'
                ? 'text-emerald-400'
                : connectionStatus === 'RECONNECTING'
                ? 'text-amber-400'
                : 'text-rose-400'
            }`}
          >
            WS: {connectionStatus}
          </span>
        </div>

        {/* Manager Simulation Controls */}
        {isManager && (
          <div className="flex items-center gap-2 pl-3 border-l border-slate-800">
            <button
              onClick={toggleStartPause}
              disabled={loading}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-extrabold uppercase tracking-wider transition ${
                isRunning
                  ? 'bg-amber-950/60 hover:bg-amber-900 border border-amber-500/40 text-amber-300'
                  : 'bg-emerald-950/60 hover:bg-emerald-900 border border-emerald-500/40 text-emerald-300'
              }`}
            >
              {isRunning ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
              {isRunning ? 'Pause Stream' : 'Resume Stream'}
            </button>

            <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800">
              {[1, 2, 5].map((s) => (
                <button
                  key={s}
                  onClick={() => changeSpeed(s)}
                  disabled={loading}
                  className={`px-2 py-1 rounded text-[11px] font-mono font-bold transition ${
                    speed === s
                      ? 'bg-cat-500 text-black shadow'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {s}x
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
