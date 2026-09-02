import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Shield, Zap, Lock, Mail, ArrowRight, HardHat, UserCheck } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';

export const LoginPage = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const { addToast } = useToast();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email || !password) {
      addToast('Please enter both email and password', 'warning');
      return;
    }
    setLoading(true);
    try {
      const data = await login(email, password);
      addToast(`Welcome back, ${data.user.name}`, 'success');
      if (data.user.role === 'OPERATOR') {
        navigate('/operator');
      } else {
        navigate('/dashboard');
      }
    } catch (err) {
      addToast(err.response?.data?.detail || 'Authentication failed. Please check credentials.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const fillDemoAccount = (demoEmail, demoPassword) => {
    setEmail(demoEmail);
    setPassword(demoPassword);
  };

  return (
    <div className="min-h-screen bg-industrial-bg flex items-center justify-center p-4 relative overflow-hidden">
      {/* Background Industrial Accents */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-cat-500/5 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-10 left-10 w-72 h-72 bg-blue-500/5 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-md bg-industrial-card border border-industrial-border rounded-2xl shadow-2xl overflow-hidden relative z-10">
        {/* Top Caterpillar Amber Header */}
        <div className="p-8 bg-slate-900/90 border-b border-industrial-border text-center relative">
          <div className="w-14 h-14 bg-cat-500 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-xl shadow-cat-500/20 text-black">
            <Zap className="w-8 h-8 fill-current" />
          </div>
          <h1 className="text-2xl font-extrabold text-white tracking-tight uppercase">
            CAT <span className="text-cat-500">Fleet Intelligence</span>
          </h1>
          <p className="text-xs text-slate-400 mt-1 font-mono uppercase tracking-wider">
            Smart Rental Tracking & Telematics Platform
          </p>
        </div>

        {/* Login Form */}
        <form onSubmit={handleSubmit} className="p-8 space-y-5">
          <div>
            <label className="block text-xs font-semibold uppercase text-slate-300 mb-2 tracking-wider">
              Work Email Address
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="manager@catfleet.com"
                className="w-full pl-10 pr-4 py-3 bg-industrial-bg border border-industrial-border rounded-xl text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cat-500 transition"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase text-slate-300 mb-2 tracking-wider">
              Account Password
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••••"
                className="w-full pl-10 pr-4 py-3 bg-industrial-bg border border-industrial-border rounded-xl text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cat-500 transition"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 bg-cat-500 hover:bg-cat-600 active:bg-cat-700 text-black font-extrabold text-sm uppercase tracking-wider rounded-xl shadow-lg shadow-cat-500/20 flex items-center justify-center gap-2 transition duration-200 disabled:opacity-50"
          >
            {loading ? 'Authenticating...' : 'Access Telematics Platform'}
            <ArrowRight className="w-4 h-4" />
          </button>

          <div className="text-center pt-1">
            <p className="text-xs text-slate-400">
              New User?{' '}
              <Link to="/register" className="text-cat-500 font-bold hover:underline">
                Create Account
              </Link>
            </p>
          </div>
        </form>

        {/* Demo Quick Shortcuts */}
        <div className="p-6 bg-slate-900/60 border-t border-industrial-border">
          <p className="text-[11px] font-mono text-slate-400 uppercase tracking-widest text-center mb-3">
            Quick One-Click Demo Access
          </p>
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => fillDemoAccount('manager@catfleet.com', 'password123')}
              className="flex items-center justify-center gap-2 p-2.5 bg-slate-800/80 hover:bg-slate-800 border border-slate-700 rounded-lg text-xs font-bold text-slate-200 uppercase tracking-wider transition"
            >
              <UserCheck className="w-4 h-4 text-cat-500" />
              Manager Demo
            </button>
            <button
              type="button"
              onClick={() => fillDemoAccount('operator@catfleet.com', 'password123')}
              className="flex items-center justify-center gap-2 p-2.5 bg-slate-800/80 hover:bg-slate-800 border border-slate-700 rounded-lg text-xs font-bold text-slate-200 uppercase tracking-wider transition"
            >
              <HardHat className="w-4 h-4 text-emerald-400" />
              Operator Demo
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
