import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Bell } from 'lucide-react';
import { io } from 'socket.io-client';
import { api } from '../lib/api';
import { useToast } from './ui';

// Real-time notifications over Socket.IO (authenticated by the HttpOnly cookie).
// If the socket cannot connect (some hosts block websockets) the badge still refreshes every 60 seconds.
const SOCKET_URL = (import.meta.env.VITE_SOCKET_URL as string | undefined) || (import.meta.env.VITE_API_URL as string | undefined) || undefined;

export function NotificationBell() {
  const [unread, setUnread] = useState(0);
  const toast = useToast();

  useEffect(() => {
    let alive = true;
    const load = () => api.get<{ unread: number }>('/notifications/unread-count').then((r) => alive && setUnread(r.unread)).catch(() => {});
    load();
    const timer = setInterval(load, 60_000);
    const socket = io(SOCKET_URL || window.location.origin, { withCredentials: true, transports: ['websocket', 'polling'], reconnectionAttempts: 5 });
    socket.on('notification', (n: { title: string }) => {
      setUnread((u) => u + 1);
      toast.ok(n.title);
    });
    const onRead = () => load();
    window.addEventListener('notifications-changed', onRead);
    return () => {
      alive = false;
      clearInterval(timer);
      window.removeEventListener('notifications-changed', onRead);
      socket.disconnect();
    };
  }, [toast]);

  return (
    <Link to="/notifications" className="relative rounded-lg p-2 text-slate-600 hover:bg-brand-50 hover:text-brand" aria-label={`Notifications${unread ? `, ${unread} unread` : ''}`}>
      <Bell className="h-5 w-5" />
      {unread > 0 && <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">{unread > 99 ? '99+' : unread}</span>}
    </Link>
  );
}
