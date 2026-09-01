import React, { useEffect, useState } from 'react';
import { MapPin, Plus, Truck, Navigation, Globe, Building2 } from 'lucide-react';
import { MainLayout } from '../layouts/MainLayout';
import { Modal } from '../components/Modal';
import { LoadingSpinner, ErrorState } from '../components/StateViews';
import { siteService } from '../services/siteService';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';

export const SitesPage = () => {
  const [sites, setSites] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Modal State
  const [showAddModal, setShowAddModal] = useState(false);
  const [formData, setFormData] = useState({
    site_code: '',
    site_name: '',
    location: '',
    latitude: 39.7392,
    longitude: -104.9903
  });

  const { isManager } = useAuth();
  const { addToast } = useToast();

  const loadSites = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await siteService.getSites();
      setSites(data);
    } catch (err) {
      setError('Unable to load site locations.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSites();
  }, []);

  const handleCreateSite = async (e) => {
    e.preventDefault();
    try {
      await siteService.createSite({
        ...formData,
        latitude: parseFloat(formData.latitude),
        longitude: parseFloat(formData.longitude)
      });
      addToast(`Site ${formData.site_code} successfully created`, 'success');
      setShowAddModal(false);
      setFormData({
        site_code: '',
        site_name: '',
        location: '',
        latitude: 39.7392,
        longitude: -104.9903
      });
      loadSites();
    } catch (err) {
      addToast(err.response?.data?.detail || 'Error creating site record', 'error');
    }
  };

  return (
    <MainLayout title="Mining & Construction Sites">
      {/* Header Bar */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-bold text-white uppercase tracking-wider">Active Site Directory</h3>
          <p className="text-xs text-slate-400">Manage geofenced work zones, quarries, and depot hubs</p>
        </div>

        {isManager && (
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-cat-500 hover:bg-cat-600 text-black font-extrabold text-xs uppercase tracking-wider rounded-xl shadow-lg shadow-cat-500/20 transition"
          >
            <Plus className="w-4 h-4" />
            Add New Site
          </button>
        )}
      </div>

      {loading ? (
        <LoadingSpinner label="Loading project site coordinates & machine allocations..." />
      ) : error ? (
        <ErrorState message={error} onRetry={loadSites} />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {sites.map((site) => (
            <div
              key={site.id}
              className="bg-industrial-card border border-industrial-border rounded-xl p-5 shadow-lg relative overflow-hidden group hover:border-slate-700 transition duration-200"
            >
              {/* Amber Accent Corner */}
              <div className="absolute top-0 right-0 w-20 h-20 bg-cat-500/5 rounded-full blur-xl group-hover:bg-cat-500/10 transition" />

              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2.5">
                  <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800 text-cat-500">
                    <Building2 className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-base font-bold text-white leading-tight">{site.site_name}</h4>
                    <span className="text-xs font-mono text-cat-500 font-bold">{site.site_code}</span>
                  </div>
                </div>
              </div>

              <div className="space-y-2 py-3 border-t border-b border-industrial-border/60 text-xs my-3">
                <div className="flex items-center justify-between text-slate-300">
                  <span className="text-slate-400 flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5 text-slate-500" /> Location:
                  </span>
                  <span className="font-semibold">{site.location}</span>
                </div>
                <div className="flex items-center justify-between text-slate-300 font-mono">
                  <span className="text-slate-400 flex items-center gap-1 font-sans">
                    <Navigation className="w-3.5 h-3.5 text-slate-500" /> Coordinates:
                  </span>
                  <span>{site.latitude.toFixed(4)}, {site.longitude.toFixed(4)}</span>
                </div>
              </div>

              <div className="flex items-center justify-between pt-1 text-xs">
                <div className="flex items-center gap-1.5 text-slate-300 font-semibold">
                  <Truck className="w-4 h-4 text-cat-500" />
                  <span>{site.equipment_count} Allocated Machines</span>
                </div>
                <span className="text-[10px] font-mono text-emerald-400 font-bold uppercase bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                  Geofence Active
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add Site Modal */}
      <Modal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        title="Create Mining / Project Site"
      >
        <form onSubmit={handleCreateSite} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold uppercase text-slate-300 mb-1">
                Site Code
              </label>
              <input
                type="text"
                required
                placeholder="SITE-PIT-05"
                value={formData.site_code}
                onChange={(e) => setFormData({ ...formData, site_code: e.target.value })}
                className="w-full p-2.5 bg-industrial-bg border border-industrial-border rounded-lg text-sm text-white font-mono focus:border-cat-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase text-slate-300 mb-1">
                Site Name
              </label>
              <input
                type="text"
                required
                placeholder="South Quarry Pit"
                value={formData.site_name}
                onChange={(e) => setFormData({ ...formData, site_name: e.target.value })}
                className="w-full p-2.5 bg-industrial-bg border border-industrial-border rounded-lg text-sm text-white focus:border-cat-500 focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase text-slate-300 mb-1">
              City / Location Name
            </label>
            <input
              type="text"
              required
              placeholder="Denver, CO"
              value={formData.location}
              onChange={(e) => setFormData({ ...formData, location: e.target.value })}
              className="w-full p-2.5 bg-industrial-bg border border-industrial-border rounded-lg text-sm text-white focus:border-cat-500 focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold uppercase text-slate-300 mb-1">
                Latitude
              </label>
              <input
                type="number"
                step="0.0001"
                value={formData.latitude}
                onChange={(e) => setFormData({ ...formData, latitude: e.target.value })}
                className="w-full p-2.5 bg-industrial-bg border border-industrial-border rounded-lg text-sm text-white font-mono focus:border-cat-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase text-slate-300 mb-1">
                Longitude
              </label>
              <input
                type="number"
                step="0.0001"
                value={formData.longitude}
                onChange={(e) => setFormData({ ...formData, longitude: e.target.value })}
                className="w-full p-2.5 bg-industrial-bg border border-industrial-border rounded-lg text-sm text-white font-mono focus:border-cat-500 focus:outline-none"
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-industrial-border">
            <button
              type="button"
              onClick={() => setShowAddModal(false)}
              className="px-4 py-2 bg-slate-800 text-slate-300 rounded-lg text-xs font-bold uppercase tracking-wider hover:bg-slate-700"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 bg-cat-500 hover:bg-cat-600 text-black font-extrabold text-xs uppercase tracking-wider rounded-lg shadow"
            >
              Save Site Record
            </button>
          </div>
        </form>
      </Modal>
    </MainLayout>
  );
};
