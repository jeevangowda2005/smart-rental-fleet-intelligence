import React, { useState, useEffect } from 'react';
import { Bell, AlertTriangle, Info, CheckCircle2, ShieldAlert } from 'lucide-react';
import { incidentService } from '../services/incidentService';

export const NotificationCenter = () => {
  const [notifications, setNotifications] = useState([]);
  const [isOpen, setIsOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  const fetchNotifications = async () => {
    try {
      const data = await incidentService.getNotifications();
      setNotifications(data.notifications || []);
      setUnreadCount(data.unread_count || 0);
    } catch (e) {
      // Non-blocking catch
    }
  };

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 10000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="relative font-mono">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 text-slate-400 hover:text-white transition rounded-xl bg-slate-900 border border-slate-800"
        title="Incident Notification Center"
      >
        <Bell className="w-5 h-5 text-cat-400" />
        {unreadCount > 0 && (
          <span className="absolute -top-1.5 -right-1.5 bg-rose-600 text-white text-[10px] font-black rounded-full w-5 h-5 flex items-center justify-center border-2 border-slate-950 animate-pulse">
            {unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-slate-950 border border-industrial-border rounded-2xl shadow-2xl z-50 overflow-hidden">
          <div className="p-3.5 bg-slate-900 border-b border-slate-800 flex items-center justify-between">
            <span className="text-xs font-black text-white uppercase flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-rose-400" /> Incident Notifications
            </span>
            <span className="text-[10px] bg-slate-800 text-slate-300 font-bold px-2 py-0.5 rounded">
              {unreadCount} Unread
            </span>
          </div>

          <div className="max-h-80 overflow-y-auto divide-y divide-slate-800/60">
            {notifications.length === 0 ? (
              <div className="p-6 text-center text-xs text-slate-500 font-mono">
                No active notifications.
              </div>
            ) : (
              notifications.map((n) => (
                <div key={n.id} className={`p-3.5 hover:bg-slate-900/60 transition ${!n.is_read ? 'bg-slate-900/30' : ''}`}>
                  <div className="flex items-start gap-2.5">
                    {n.type === 'CRITICAL' ? (
                      <ShieldAlert className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                    ) : (
                      <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                    )}
                    <div className="flex-1">
                      <p className="text-xs text-slate-200 font-mono leading-snug">{n.message}</p>
                      <span className="text-[9px] text-slate-500 mt-1 block">
                        {n.created_at ? new Date(n.created_at).toLocaleTimeString() : ''}
                      </span>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default NotificationCenter;
