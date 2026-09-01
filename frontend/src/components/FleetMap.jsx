import React from 'react';
import { MapContainer, TileLayer, Marker, Popup, Circle } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { StatusBadge } from './StatusBadge';
import { Truck, MapPin, Gauge, Fuel, HardHat } from 'lucide-react';

// Fix default Leaflet icon paths in React Vite environment
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

// Custom colored HTML Leaflet markers for Caterpillar machinery status
const createCustomMarker = (status, code) => {
  let color = '#3B82F6'; // Default ACTIVE blue
  if (status === 'AVAILABLE') color = '#10B981'; // Green
  else if (status === 'IDLE') color = '#F59E0B'; // Amber
  else if (status === 'OVERDUE') color = '#F43F5E'; // Red
  else if (status === 'MAINTENANCE') color = '#F97316'; // Orange

  const html = `
    <div style="
      background-color: ${color};
      color: #000;
      font-weight: 800;
      font-family: monospace;
      font-size: 10px;
      padding: 3px 6px;
      border-radius: 6px;
      border: 2px solid #000;
      box-shadow: 0 4px 10px rgba(0,0,0,0.5);
      white-space: nowrap;
      display: flex;
      align-items: center;
      gap: 4px;
    ">
      <span style="width: 6px; height: 6px; border-radius: 50%; background: #000;"></span>
      ${code}
    </div>
  `;

  return L.divIcon({
    html: html,
    className: 'custom-cat-marker',
    iconSize: [80, 24],
    iconAnchor: [40, 12]
  });
};

export const FleetMap = ({ equipment = [], sites = [], center = [39.7392, -104.9903], zoom = 5 }) => {
  return (
    <div className="bg-industrial-card border border-industrial-border rounded-2xl overflow-hidden shadow-2xl relative h-[450px] w-full">
      <MapContainer
        center={center}
        zoom={zoom}
        scrollWheelZoom={true}
        style={{ height: '100%', width: '100%', backgroundColor: '#0B0F17' }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {/* Render Site Boundaries */}
        {sites.map((site) => (
          <React.Fragment key={site.id}>
            <Circle
              center={[site.latitude, site.longitude]}
              radius={4000} // 4.0 km geofence radius
              pathOptions={{ color: '#F59E0B', fillColor: '#F59E0B', fillOpacity: 0.08, dashArray: '4, 4' }}
            />
            <Marker position={[site.latitude, site.longitude]}>
              <Popup className="cat-map-popup">
                <div className="p-2 font-sans text-xs">
                  <div className="font-bold text-slate-900 flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5 text-amber-600" />
                    {site.site_name}
                  </div>
                  <div className="text-[10px] text-slate-600 font-mono mt-0.5">{site.site_code} - {site.location}</div>
                  <div className="mt-1 text-[11px] font-semibold text-amber-800">
                    Geofenced Zone (4.0 km Radius)
                  </div>
                </div>
              </Popup>
            </Marker>
          </React.Fragment>
        ))}

        {/* Render Equipment Position Pins */}
        {equipment.map((item) => (
          <Marker
            key={item.id}
            position={[item.latitude, item.longitude]}
            icon={createCustomMarker(item.status, item.equipment_id)}
          >
            <Popup className="cat-map-popup">
              <div className="p-3 font-sans text-xs w-56 space-y-2">
                <div className="flex items-center justify-between border-b pb-1.5">
                  <span className="font-mono font-bold text-amber-600">{item.equipment_id}</span>
                  <StatusBadge status={item.status} />
                </div>

                <div>
                  <div className="font-bold text-slate-900">{item.model}</div>
                  <div className="text-[10px] text-slate-600 font-mono">{item.equipment_type}</div>
                </div>

                <div className="space-y-1 text-[11px] pt-1">
                  <div className="flex justify-between"><span className="text-slate-600">Site:</span><span className="font-semibold text-slate-900">{item.site_name}</span></div>
                  <div className="flex justify-between"><span className="text-slate-600">Operator:</span><span className="font-semibold text-slate-900">{item.operator_name}</span></div>
                  <div className="flex justify-between"><span className="text-slate-600">Engine Hrs:</span><span className="font-mono text-slate-900">{item.engine_hours} hrs</span></div>
                  <div className="flex justify-between"><span className="text-slate-600">Utilization:</span><span className="font-mono font-bold text-amber-600">{item.utilization}%</span></div>
                </div>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
};
