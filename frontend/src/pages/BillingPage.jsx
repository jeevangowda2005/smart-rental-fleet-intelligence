import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Receipt, DollarSign, Calendar, Clock, FileText, User, Truck, MapPin, CheckCircle, ShieldCheck, Download, Eye, AlertCircle } from 'lucide-react';
import { MainLayout } from '../layouts/MainLayout';
import { DataTable } from '../components/DataTable';
import { Modal } from '../components/Modal';
import { LoadingSpinner, ErrorState, EmptyState } from '../components/StateViews';
import { billingService } from '../services/billingService';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';

export const BillingPage = () => {
  const [billings, setBillings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedBill, setSelectedBill] = useState(null);
  const [searchParams] = useSearchParams();

  const { isManager, isOperator, user } = useAuth();
  const { addToast } = useToast();

  const rentalIdQuery = searchParams.get('rental_id');

  const loadBillingData = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await billingService.getBillings();
      setBillings(data);

      if (rentalIdQuery) {
        const matched = data.find(b => String(b.rental_id) === String(rentalIdQuery));
        if (matched) {
          setSelectedBill(matched);
        } else {
          // Attempt to fetch directly if not in initial list
          try {
            const single = await billingService.getBillingByRental(rentalIdQuery);
            setSelectedBill(single);
          } catch (err) {
            console.warn('Billing record not found for query:', rentalIdQuery);
          }
        }
      }
    } catch (err) {
      console.error(err);
      setError('Failed to load billing and invoice records.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadBillingData();
  }, [rentalIdQuery]);

  const columns = [
    {
      header: 'Invoice #',
      accessor: 'invoice_number',
      render: (item) => (
        <div className="flex items-center gap-2">
          <Receipt className="w-4 h-4 text-cat-500 shrink-0" />
          <button
            onClick={() => setSelectedBill(item)}
            className="font-mono font-bold text-cat-500 hover:underline text-xs"
          >
            {item.invoice_number}
          </button>
        </div>
      )
    },
    ...(isManager ? [{
      header: 'Customer / Operator',
      render: (item) => (
        <div>
          <div className="text-xs font-bold text-white">{item.operator_name || 'N/A'}</div>
          <div className="text-[10px] text-slate-400 font-mono">{item.operator_email || ''}</div>
        </div>
      )
    }] : []),
    {
      header: 'Equipment',
      render: (item) => (
        <div>
          <div className="font-mono font-bold text-xs text-white">{item.equipment_code || `EQ-${item.equipment_id}`}</div>
          <div className="text-[10px] text-slate-400 font-mono">{item.equipment_model} ({item.equipment_type})</div>
        </div>
      )
    },
    {
      header: 'Rental Period',
      render: (item) => (
        <div className="text-xs font-mono text-slate-300">
          <div>{new Date(item.rental_start).toLocaleDateString()} → {new Date(item.actual_checkin).toLocaleDateString()}</div>
          <div className="text-[10px] text-slate-400">Duration: {item.actual_duration_hours} hrs</div>
        </div>
      )
    },
    {
      header: 'Subtotal & Tax',
      render: (item) => (
        <div className="text-xs font-mono">
          <div className="text-slate-300">₹{item.subtotal?.toLocaleString('en-IN') || 0}</div>
          <div className="text-[10px] text-slate-400">Tax (18%): ₹{item.tax_amount?.toLocaleString('en-IN') || 0}</div>
        </div>
      )
    },
    {
      header: 'Total Amount',
      render: (item) => (
        <div className="text-sm font-mono font-extrabold text-emerald-400">
          ₹{item.total_amount?.toLocaleString('en-IN') || 0}
        </div>
      )
    },
    {
      header: 'Status',
      render: (item) => (
        <span className={`px-2.5 py-1 rounded-full text-[10px] font-mono font-bold uppercase tracking-wider ${
          item.status === 'PAID'
            ? 'bg-emerald-950 text-emerald-400 border border-emerald-500/30'
            : 'bg-amber-950 text-amber-400 border border-amber-500/30'
        }`}>
          {item.status}
        </span>
      )
    },
    {
      header: 'Action',
      render: (item) => (
        <button
          onClick={() => setSelectedBill(item)}
          className="flex items-center gap-1 px-3 py-1.5 bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-200 text-xs font-bold rounded-lg transition"
        >
          <Eye className="w-3.5 h-3.5 text-cat-500" />
          View Statement
        </button>
      )
    }
  ];

  return (
    <MainLayout title="Billing & Rental Invoices">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h3 className="text-base font-extrabold text-white flex items-center gap-2">
            <Receipt className="w-5 h-5 text-cat-500" />
            {isManager ? 'Fleet Billing & Financial Statements' : 'My Rental Invoices & Billing History'}
          </h3>
          <p className="text-xs text-slate-400">
            {isManager
              ? 'Comprehensive billing audit ledger generated automatically upon rental completion.'
              : `Completed rental contract statements and charges for ${user?.name}.`}
          </p>
        </div>
      </div>

      {/* Summary KPI Cards */}
      {!loading && !error && billings.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-4 bg-industrial-card border border-industrial-border rounded-xl shadow-lg">
            <span className="text-[10px] font-mono text-slate-400 uppercase tracking-widest">Total Invoices</span>
            <div className="text-2xl font-extrabold text-white font-mono mt-1">{billings.length}</div>
          </div>
          <div className="p-4 bg-industrial-card border border-industrial-border rounded-xl shadow-lg">
            <span className="text-[10px] font-mono text-slate-400 uppercase tracking-widest">Total Billed Revenue</span>
            <div className="text-2xl font-extrabold text-emerald-400 font-mono mt-1">
              ₹{billings.reduce((sum, b) => sum + (b.total_amount || 0), 0).toLocaleString('en-IN')}
            </div>
          </div>
          <div className="p-4 bg-industrial-card border border-industrial-border rounded-xl shadow-lg">
            <span className="text-[10px] font-mono text-slate-400 uppercase tracking-widest">Total Tax Accrued (GST)</span>
            <div className="text-2xl font-extrabold text-cat-500 font-mono mt-1">
              ₹{billings.reduce((sum, b) => sum + (b.tax_amount || 0), 0).toLocaleString('en-IN')}
            </div>
          </div>
        </div>
      )}

      {loading ? (
        <LoadingSpinner label="Loading billing & financial statements..." />
      ) : error ? (
        <ErrorState message={error} onRetry={loadBillingData} />
      ) : billings.length === 0 ? (
        <EmptyState
          title="No Billing Records Found"
          description={isManager
            ? "No completed rental contracts have generated billing statements yet. Check-in an active rental to produce an invoice."
            : "You do not have any completed rental invoices on record."}
        />
      ) : (
        <DataTable
          columns={columns}
          data={billings}
          searchPlaceholder="Search invoice #, machine, customer, site..."
        />
      )}

      {/* Invoice Detail Modal */}
      {selectedBill && (
        <Modal
          isOpen={!!selectedBill}
          onClose={() => setSelectedBill(null)}
          title={`Tax Invoice: ${selectedBill.invoice_number}`}
          maxWidth="max-w-2xl"
        >
          <div className="space-y-6 text-slate-100">
            {/* Header Banner */}
            <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl flex items-center justify-between">
              <div>
                <span className="text-[10px] font-mono text-cat-500 font-bold uppercase tracking-widest">CATERPILLAR FLEET INTELLIGENCE</span>
                <h3 className="text-lg font-extrabold text-white mt-0.5">{selectedBill.invoice_number}</h3>
                <p className="text-xs text-slate-400 font-mono">Issued: {new Date(selectedBill.generated_at).toLocaleString()}</p>
              </div>
              <span className={`px-3 py-1 rounded-full text-xs font-mono font-bold uppercase tracking-wider ${
                selectedBill.status === 'PAID'
                  ? 'bg-emerald-950 text-emerald-400 border border-emerald-500/40'
                  : 'bg-amber-950 text-amber-400 border border-amber-500/40'
              }`}>
                {selectedBill.status}
              </span>
            </div>

            {/* Metadata Grid */}
            <div className="grid grid-cols-2 gap-4 p-4 bg-slate-950/60 border border-industrial-border rounded-xl text-xs font-mono">
              <div>
                <span className="text-slate-400 block text-[10px] uppercase">Customer / Operator</span>
                <strong className="text-white text-sm">{selectedBill.operator_name || 'N/A'}</strong>
                <div className="text-slate-400">{selectedBill.operator_email}</div>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px] uppercase">Equipment Asset</span>
                <strong className="text-cat-500 text-sm">{selectedBill.equipment_code}</strong>
                <div className="text-slate-300">{selectedBill.equipment_model} ({selectedBill.equipment_type})</div>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px] uppercase">Deployment Site</span>
                <div className="text-slate-200 font-semibold">{selectedBill.site_name || 'Project Site'}</div>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px] uppercase">Rental Duration</span>
                <div className="text-slate-200">{selectedBill.actual_duration_hours} Operating Hours</div>
              </div>
            </div>

            {/* Itemized Line Items Table */}
            <div className="border border-industrial-border rounded-xl overflow-hidden">
              <div className="bg-slate-900 px-4 py-2 text-xs font-bold text-slate-300 uppercase tracking-wider font-mono border-b border-industrial-border flex justify-between">
                <span>Charge Description</span>
                <span>Amount (₹)</span>
              </div>
              <div className="divide-y divide-industrial-border font-mono text-xs">
                <div className="px-4 py-3 flex justify-between">
                  <div>
                    <div className="text-white font-semibold">Equipment Operating Charge</div>
                    <div className="text-[10px] text-slate-400">{selectedBill.engine_hours_at_checkin} engine hrs @ ₹{selectedBill.base_rate_per_hour}/hr</div>
                  </div>
                  <span className="text-slate-200 font-bold">₹{selectedBill.rental_charge?.toLocaleString('en-IN')}</span>
                </div>

                <div className="px-4 py-3 flex justify-between">
                  <div>
                    <div className="text-white font-semibold">Fuel Usage Cost</div>
                    <div className="text-[10px] text-slate-400">Burn rate: {selectedBill.fuel_usage_at_checkin} L/hr @ ₹95/L baseline</div>
                  </div>
                  <span className="text-slate-200 font-bold">₹{selectedBill.fuel_charge?.toLocaleString('en-IN')}</span>
                </div>

                <div className="px-4 py-3 flex justify-between">
                  <div>
                    <div className="text-white font-semibold">Engine Standby / Idle Charge</div>
                    <div className="text-[10px] text-slate-400">{selectedBill.idle_hours_at_checkin} idle hrs @ ₹500/hr idle fee</div>
                  </div>
                  <span className="text-slate-200 font-bold">₹{selectedBill.idle_charge?.toLocaleString('en-IN')}</span>
                </div>

                <div className="px-4 py-3 bg-slate-950/80 flex justify-between font-bold text-slate-300">
                  <span>Subtotal</span>
                  <span>₹{selectedBill.subtotal?.toLocaleString('en-IN')}</span>
                </div>

                <div className="px-4 py-3 bg-slate-950/80 flex justify-between text-slate-400">
                  <span>Goods & Services Tax (GST 18%)</span>
                  <span>₹{selectedBill.tax_amount?.toLocaleString('en-IN')}</span>
                </div>

                <div className="px-4 py-3.5 bg-slate-900 flex justify-between text-sm font-bold text-white border-t border-industrial-border">
                  <span className="text-cat-500 uppercase tracking-wider">Total Invoice Payable</span>
                  <span className="text-emerald-400 text-base font-extrabold">₹{selectedBill.total_amount?.toLocaleString('en-IN')}</span>
                </div>
              </div>
            </div>

            {/* Footer buttons */}
            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setSelectedBill(null)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-bold uppercase"
              >
                Close Statement
              </button>
            </div>
          </div>
        </Modal>
      )}
    </MainLayout>
  );
};
