import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Zap, Lock, Mail, User, ArrowRight, CheckCircle, Eye, EyeOff, HardHat, Check, X } from 'lucide-react';
import { authService } from '../services/authService';
import { useToast } from '../context/ToastContext';

export const RegisterPage = () => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [countdown, setCountdown] = useState(3);

  const { addToast } = useToast();
  const navigate = useNavigate();

  // Password validation criteria
  const hasMinLength = password.length >= 8;
  const hasUppercase = /[A-Z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  const hasSpecial = /[^A-Za-z0-9]/.test(password);

  const reqCount = [hasMinLength, hasUppercase, hasNumber, hasSpecial].filter(Boolean).length;
  
  let strengthLabel = 'Weak';
  let strengthColor = 'bg-rose-500';
  let strengthTextColor = 'text-rose-400';
  if (reqCount === 4) {
    strengthLabel = 'Strong';
    strengthColor = 'bg-emerald-500';
    strengthTextColor = 'text-emerald-400';
  } else if (reqCount >= 2) {
    strengthLabel = 'Medium';
    strengthColor = 'bg-amber-500';
    strengthTextColor = 'text-amber-400';
  }

  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  const passwordsMatch = password.length > 0 && password === confirmPassword;
  const isFormValid = name.trim().length > 0 && emailValid && reqCount === 4 && passwordsMatch && acceptedTerms;

  useEffect(() => {
    let timer;
    if (success && countdown > 0) {
      timer = setTimeout(() => setCountdown((prev) => prev - 1), 1000);
    } else if (success && countdown === 0) {
      navigate('/login');
    }
    return () => clearTimeout(timer);
  }, [success, countdown, navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!isFormValid) {
      addToast('Please satisfy all registration requirements', 'warning');
      return;
    }
    setLoading(true);
    try {
      await authService.register(name.trim(), email.trim(), password);
      setSuccess(true);
      addToast('Account created successfully!', 'success');
    } catch (err) {
      const detail = err.response?.data?.detail;
      if (detail === 'Email already registered') {
        addToast('This email is already registered. Please sign in instead.', 'error');
      } else {
        addToast(detail || 'Registration failed. Please check your information.', 'error');
      }
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen bg-industrial-bg flex items-center justify-center p-4 relative overflow-hidden">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-cat-500/5 rounded-full blur-3xl pointer-events-none" />
        <div className="w-full max-w-md bg-industrial-card border border-industrial-border rounded-2xl shadow-2xl p-8 text-center relative z-10 space-y-6">
          <div className="w-16 h-16 bg-emerald-500/20 border border-emerald-500/40 rounded-full flex items-center justify-center mx-auto text-emerald-400">
            <CheckCircle className="w-10 h-10" />
          </div>
          <div>
            <h2 className="text-2xl font-extrabold text-white tracking-tight uppercase">
              Account Created Successfully
            </h2>
            <p className="text-sm text-slate-300 mt-2">
              Your Equipment Operator account has been provisioned. You can now access the telematics platform.
            </p>
          </div>
          <div className="bg-slate-900/80 p-4 rounded-xl border border-industrial-border text-xs text-slate-400 font-mono">
            Redirecting to Login page in <span className="text-cat-500 font-bold">{countdown}s</span>...
          </div>
          <button
            onClick={() => navigate('/login')}
            className="w-full py-3.5 bg-cat-500 hover:bg-cat-600 active:bg-cat-700 text-black font-extrabold text-sm uppercase tracking-wider rounded-xl shadow-lg shadow-cat-500/20 flex items-center justify-center gap-2 transition"
          >
            Continue to Login
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-industrial-bg flex items-center justify-center p-4 relative overflow-hidden my-8">
      {/* Background Industrial Accents */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-cat-500/5 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-10 left-10 w-72 h-72 bg-blue-500/5 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-md bg-industrial-card border border-industrial-border rounded-2xl shadow-2xl overflow-hidden relative z-10">
        {/* Top Caterpillar Amber Header */}
        <div className="p-6 bg-slate-900/90 border-b border-industrial-border text-center relative">
          <div className="w-12 h-12 bg-cat-500 rounded-2xl flex items-center justify-center mx-auto mb-3 shadow-xl shadow-cat-500/20 text-black">
            <Zap className="w-7 h-7 fill-current" />
          </div>
          <h1 className="text-xl font-extrabold text-white tracking-tight uppercase">
            CAT <span className="text-cat-500">Fleet Intelligence</span>
          </h1>
          <p className="text-xs text-slate-400 mt-1 font-mono uppercase tracking-wider">
            Operator Registration
          </p>
        </div>

        {/* Registration Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Role badge display (No manager selection allowed) */}
          <div className="bg-slate-900/60 p-3 rounded-xl border border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase text-slate-300 tracking-wider">
              <HardHat className="w-4 h-4 text-emerald-400" />
              <span>Assigned Role</span>
            </div>
            <span className="px-2.5 py-1 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-mono font-bold rounded-lg uppercase">
              OPERATOR
            </span>
          </div>

          {/* Full Name */}
          <div>
            <label className="block text-xs font-semibold uppercase text-slate-300 mb-1.5 tracking-wider">
              Full Name <span className="text-cat-500">*</span>
            </label>
            <div className="relative">
              <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="John Doe"
                disabled={loading}
                className="w-full pl-10 pr-4 py-2.5 bg-industrial-bg border border-industrial-border rounded-xl text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cat-500 transition disabled:opacity-50"
              />
            </div>
          </div>

          {/* Email Address */}
          <div>
            <label className="block text-xs font-semibold uppercase text-slate-300 mb-1.5 tracking-wider">
              Work Email Address <span className="text-cat-500">*</span>
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="operator@catfleet.com"
                disabled={loading}
                className={`w-full pl-10 pr-4 py-2.5 bg-industrial-bg border rounded-xl text-sm text-slate-100 placeholder-slate-500 focus:outline-none transition disabled:opacity-50 ${
                  email.length > 0 && !emailValid
                    ? 'border-rose-500 focus:border-rose-500'
                    : 'border-industrial-border focus:border-cat-500'
                }`}
              />
            </div>
            {email.length > 0 && !emailValid && (
              <p className="text-[11px] text-rose-400 mt-1">Please enter a valid email address format.</p>
            )}
          </div>

          {/* Password */}
          <div>
            <label className="block text-xs font-semibold uppercase text-slate-300 mb-1.5 tracking-wider">
              Password <span className="text-cat-500">*</span>
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type={showPassword ? 'text' : 'password'}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••••"
                disabled={loading}
                className="w-full pl-10 pr-10 py-2.5 bg-industrial-bg border border-industrial-border rounded-xl text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cat-500 transition disabled:opacity-50"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>

            {/* Strength Meter Bar */}
            {password.length > 0 && (
              <div className="mt-2 space-y-1.5">
                <div className="flex items-center justify-between text-[11px] font-mono">
                  <span className="text-slate-400">Strength:</span>
                  <span className={`font-bold ${strengthTextColor}`}>{strengthLabel}</span>
                </div>
                <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden flex gap-1">
                  <div className={`h-full transition-all duration-300 ${reqCount >= 1 ? strengthColor : 'bg-transparent'}`} style={{ width: '25%' }} />
                  <div className={`h-full transition-all duration-300 ${reqCount >= 2 ? strengthColor : 'bg-transparent'}`} style={{ width: '25%' }} />
                  <div className={`h-full transition-all duration-300 ${reqCount >= 3 ? strengthColor : 'bg-transparent'}`} style={{ width: '25%' }} />
                  <div className={`h-full transition-all duration-300 ${reqCount === 4 ? strengthColor : 'bg-transparent'}`} style={{ width: '25%' }} />
                </div>
              </div>
            )}

            {/* Simple Requirements List */}
            <div className="mt-2 p-2.5 bg-slate-900/70 rounded-lg border border-slate-800/80 grid grid-cols-2 gap-x-2 gap-y-1 text-[11px]">
              <div className={`flex items-center gap-1.5 ${hasMinLength ? 'text-emerald-400' : 'text-slate-500'}`}>
                {hasMinLength ? <Check className="w-3 h-3 shrink-0" /> : <X className="w-3 h-3 shrink-0" />}
                <span>At least 8 characters</span>
              </div>
              <div className={`flex items-center gap-1.5 ${hasUppercase ? 'text-emerald-400' : 'text-slate-500'}`}>
                {hasUppercase ? <Check className="w-3 h-3 shrink-0" /> : <X className="w-3 h-3 shrink-0" />}
                <span>One uppercase letter</span>
              </div>
              <div className={`flex items-center gap-1.5 ${hasNumber ? 'text-emerald-400' : 'text-slate-500'}`}>
                {hasNumber ? <Check className="w-3 h-3 shrink-0" /> : <X className="w-3 h-3 shrink-0" />}
                <span>At least one number</span>
              </div>
              <div className={`flex items-center gap-1.5 ${hasSpecial ? 'text-emerald-400' : 'text-slate-500'}`}>
                {hasSpecial ? <Check className="w-3 h-3 shrink-0" /> : <X className="w-3 h-3 shrink-0" />}
                <span>One special character</span>
              </div>
            </div>
          </div>

          {/* Confirm Password */}
          <div>
            <label className="block text-xs font-semibold uppercase text-slate-300 mb-1.5 tracking-wider">
              Confirm Password <span className="text-cat-500">*</span>
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type={showConfirmPassword ? 'text' : 'password'}
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="••••••••••••"
                disabled={loading}
                className={`w-full pl-10 pr-10 py-2.5 bg-industrial-bg border rounded-xl text-sm text-slate-100 placeholder-slate-500 focus:outline-none transition disabled:opacity-50 ${
                  confirmPassword.length > 0 && !passwordsMatch
                    ? 'border-rose-500 focus:border-rose-500'
                    : 'border-industrial-border focus:border-cat-500'
                }`}
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200"
              >
                {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {confirmPassword.length > 0 && !passwordsMatch && (
              <p className="text-[11px] text-rose-400 mt-1">Passwords do not match.</p>
            )}
          </div>

          {/* Terms & Authorization Checkbox */}
          <div className="flex items-start gap-2.5 pt-1">
            <input
              type="checkbox"
              id="terms"
              checked={acceptedTerms}
              onChange={(e) => setAcceptedTerms(e.target.checked)}
              disabled={loading}
              className="mt-0.5 rounded bg-industrial-bg border-industrial-border text-cat-500 focus:ring-cat-500 focus:ring-offset-0 cursor-pointer"
            />
            <label htmlFor="terms" className="text-xs text-slate-300 leading-snug cursor-pointer select-none">
              I confirm that the information provided is accurate and I agree to use the fleet system responsibly.
            </label>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading || !isFormValid}
            className="w-full py-3.5 bg-cat-500 hover:bg-cat-600 active:bg-cat-700 text-black font-extrabold text-sm uppercase tracking-wider rounded-xl shadow-lg shadow-cat-500/20 flex items-center justify-center gap-2 transition duration-200 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {loading ? 'Creating Account...' : 'Register Operator Account'}
            <ArrowRight className="w-4 h-4" />
          </button>
        </form>

        {/* Footer link to Login */}
        <div className="p-4 bg-slate-900/60 border-t border-industrial-border text-center">
          <p className="text-xs text-slate-400">
            Already have an account?{' '}
            <Link to="/login" className="text-cat-500 font-bold hover:underline">
              Sign In
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
};
