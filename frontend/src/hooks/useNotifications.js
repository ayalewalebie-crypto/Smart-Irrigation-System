import { useState, useEffect, useCallback } from 'react';
import { historyApi, sensorApi } from '../services/api';

/**
 * useNotifications
 * Polls the backend every 15 s for:
 *  - warning / danger events from history (low moisture, high temp, node offline)
 *  - offline sensor nodes
 * Returns: { notifications, unreadCount, markAllRead, refresh }
 */
export function useNotifications() {
  const [notifications, setNotifications] = useState([]);
  const [readIds, setReadIds]             = useState(() => {
    try { return new Set(JSON.parse(localStorage.getItem('sis_read_notifs') || '[]')); }
    catch { return new Set(); }
  });

  const fetchAlerts = useCallback(async () => {
    try {
      // Last 3 days of warning/danger history events
      const today   = new Date().toISOString().split('T')[0];
      const ago3    = new Date(Date.now() - 3 * 86400000).toISOString().split('T')[0];

      const [warnings, dangers, sensors] = await Promise.all([
        historyApi.getAll({ from: ago3, to: today, type: 'warning', limit: 20 }),
        historyApi.getAll({ from: ago3, to: today, type: 'danger',  limit: 20 }),
        sensorApi.getAll(),
      ]);

      // Build offline-node alerts from sensor list
      const offlineAlerts = sensors
        .filter(s => !s.online)
        .map(s => ({
          id:      `offline-${s.id}`,
          event:   'Device Offline',
          details: `${s.id} (${s.type}) is not responding`,
          zone:    s.zone || '—',
          type:    'danger',
          date:    s.lastSeen ? new Date(s.lastSeen).toISOString().split('T')[0] : today,
          time:    s.lastSeen ? new Date(s.lastSeen).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : '—',
        }));

      const all = [...offlineAlerts, ...dangers, ...warnings]
        // Sort newest first (by date+time string)
        .sort((a, b) => {
          const ta = new Date(`${a.date}T${a.time || '00:00'}`);
          const tb = new Date(`${b.date}T${b.time || '00:00'}`);
          return tb - ta;
        })
        .slice(0, 30);

      setNotifications(all);
    } catch (_) {
      // Silently ignore — backend may be offline
    }
  }, []);

  // Initial fetch + polling every 15 s
  useEffect(() => {
    fetchAlerts();
    const id = setInterval(fetchAlerts, 15000);
    return () => clearInterval(id);
  }, [fetchAlerts]);

  const unreadCount = notifications.filter(n => !readIds.has(String(n.id))).length;

  const markAllRead = () => {
    const all = new Set(notifications.map(n => String(n.id)));
    setReadIds(all);
    localStorage.setItem('sis_read_notifs', JSON.stringify([...all]));
  };

  const markRead = (id) => {
    const next = new Set(readIds);
    next.add(String(id));
    setReadIds(next);
    localStorage.setItem('sis_read_notifs', JSON.stringify([...next]));
  };

  return { notifications, unreadCount, markAllRead, markRead, refresh: fetchAlerts };
}
