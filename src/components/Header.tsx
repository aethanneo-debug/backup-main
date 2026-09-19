import React, { useState, useEffect, useRef } from "react";
import { User, Notification } from "../types";
import { apiCall } from "../utils";
import { 
  Bell, 
  Clock, 
  HelpCircle, 
  ShieldAlert,
  Server,
  BellRing,
  X,
  BookOpen,
  ShieldCheck
} from "lucide-react";

interface HeaderProps {
  user: User;
  onOpenHelp: () => void;
}

export default function Header({ user, onOpenHelp }: HeaderProps) {
  const [time, setTime] = useState(new Date());
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const fetchNotifications = async () => {
    try {
      const res = await apiCall("/api/notifications");
      if (res.status === "success" && res.data) {
        setNotifications(res.data || []);
      }
    } catch (err: any) {
      if (err?.message === "Failed to fetch" || err?.message?.includes("fetch") || err?.toString()?.includes("Failed to fetch") || err?.message?.includes("HTML response instead of JSON")) {
        console.warn("Desk notifications momentarily unreachable:", err?.message || err);
      } else {
        console.error("Failed to fetch desk notifications", err);
      }
    }
  };

  useEffect(() => {
    fetchNotifications();
    const timer = setInterval(fetchNotifications, 15000);
    return () => clearInterval(timer);
  }, [user]);

  // Close dropdown on clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleMarkAsRead = async (id: string) => {
    try {
      await apiCall(`/api/notifications/${id}/read`, { method: "POST" });
      setNotifications(prev => 
        prev.map(n => n.id === id ? { ...n, isRead: true } : n)
      );
    } catch (err) {
      console.error("Failed to mark alert as read", err);
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await apiCall("/api/notifications/read-all", { method: "POST" });
      setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
    } catch (err) {
      console.error("Failed to clear desk notifications", err);
    }
  };

  const getNotifIcon = (type: string) => {
    switch (type) {
      case "urgent":
        return <ShieldAlert size={14} className="text-rose-600 shrink-0" />;
      case "warning":
        return <ShieldAlert size={14} className="text-amber-500 shrink-0" />;
      case "success":
        return <Server size={14} className="text-emerald-500 shrink-0" />;
      case "info":
      default:
        return <Clock size={14} className="text-blue-500 shrink-0" />;
    }
  };

  const formatTimeAgo = (timestampStr: string) => {
    try {
      const now = new Date();
      const past = new Date(timestampStr);
      const diffMs = now.getTime() - past.getTime();
      const diffMinutes = Math.floor(diffMs / 60000);
      
      if (diffMinutes < 1) return "Just now";
      if (diffMinutes < 60) return `${diffMinutes}m ago`;
      
      const diffHours = Math.floor(diffMinutes / 60);
      if (diffHours < 24) return `${diffHours}h ago`;
      
      return past.toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
    } catch {
      return "Recently";
    }
  };

  // Format time beautifully in UTC/Local format
  const formattedTime = time.toLocaleTimeString("en-US", { hour12: true });
  const formattedDate = time.toLocaleDateString("en-US", {
    weekday: "short",
    year: "numeric",
    month: "short",
    day: "numeric",
  });

  const unreadCount = notifications.filter(n => !n.isRead).length;

  return (
    <header id="ipfms-header" className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-6 shrink-0 shadow-sm relative z-40">
      {/* LEFT SECTION (PORTAL TITLE CARD) */}
      <div className="flex items-center space-x-3">
        <span className="text-xs font-semibold px-2 py-1 rounded bg-slate-100 text-slate-700 border border-slate-200 uppercase tracking-wider font-mono">
          RAB No. 1
        </span>
        <h2 className="text-sm font-semibold text-slate-800 tracking-tight hidden md:inline-block font-sans">
          HSAC Integrated Personnel & Financial Management Portal
        </h2>
      </div>

      {/* RIGHT SECTION (SYSTEM METADATA & PROFILE) */}
      <div className="flex items-center space-x-5">
        {/* GMT TIME AND DATA CLOCK CONTAINER */}
        <div className="flex items-center space-x-2 text-slate-500 font-mono text-xs border border-slate-200 px-3 py-1 bg-slate-50 rounded-lg">
          <Clock size={13} className="text-slate-400" />
          <span className="font-semibold text-slate-700">{formattedTime}</span>
          <span className="text-slate-300">|</span>
          <span className="text-slate-500 text-[11px]">{formattedDate}</span>
        </div>

        {/* DATA PRIVACY SECURITY FLAGGER */}
        <div className="flex items-center text-[10px] text-emerald-700 font-mono bg-emerald-50 border border-emerald-100 px-2 py-1 rounded">
          <Server size={11} className="mr-1 text-emerald-500 animate-pulse" />
          <span>RA 10173 SECURE</span>
        </div>

        {/* UTILITY NOTIFIER */}
        <div className="flex items-center space-x-2 border-l border-slate-200 pl-4 relative" ref={dropdownRef}>
          <button 
            id="btn-help-dialog" 
            title="System Documentation Guidelines"
            className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
            onClick={onOpenHelp}
          >
            <HelpCircle size={18} />
          </button>
          
          <button 
            id="btn-alert-notif" 
            title="System Notifications"
            className={`p-1.5 rounded-lg relative transition-colors cursor-pointer ${
              dropdownOpen 
                ? "text-blue-600 bg-blue-50" 
                : "text-slate-400 hover:text-slate-600 hover:bg-slate-100"
            }`}
            onClick={() => setDropdownOpen(!dropdownOpen)}
          >
            {unreadCount > 0 ? (
              <BellRing size={18} className="text-blue-600 animate-pulse" />
            ) : (
              <Bell size={18} />
            )}
            {unreadCount > 0 && (
              <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-rose-500 rounded-full border border-white"></span>
            )}
          </button>

          {/* NOTIFICATION CENTER DROPDOWN PANEL */}
          {dropdownOpen && (
            <div className="absolute right-0 top-11 w-80 bg-white border border-slate-200 rounded-xl shadow-xl z-50 overflow-hidden font-sans">
              {/* Header */}
              <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-700 uppercase tracking-wider font-mono">
                  Desk alerts ({unreadCount})
                </span>
                {unreadCount > 0 && (
                  <button 
                    onClick={handleMarkAllRead}
                    className="text-[11px] text-blue-600 hover:text-blue-800 hover:underline font-medium transition-all cursor-pointer"
                  >
                    Clear all
                  </button>
                )}
              </div>

              {/* List Container */}
              <div className="max-h-80 overflow-y-auto divide-y divide-slate-100">
                {notifications.length === 0 ? (
                  <div className="p-5 text-center text-slate-400 text-xs font-sans">
                    No active notifications recorded for your desk.
                  </div>
                ) : (
                  notifications.map((notif) => (
                    <div 
                      key={notif.id}
                      onClick={() => handleMarkAsRead(notif.id)}
                      className={`p-3.5 hover:bg-slate-50 transition-colors cursor-pointer flex gap-3 ${!notif.isRead ? "bg-blue-50/20" : ""}`}
                    >
                      {/* Icon based on types */}
                      <div className="shrink-0 mt-0.5">
                        {getNotifIcon(notif.type)}
                      </div>
                      
                      {/* Content text */}
                      <div className="flex-1 space-y-1 text-left">
                        <div className="flex items-start justify-between gap-1">
                          <p className={`text-xs leading-tight ${!notif.isRead ? "font-semibold text-slate-900" : "text-slate-600"}`}>
                            {notif.title}
                          </p>
                          {!notif.isRead && (
                            <span className="w-1.5 h-1.5 bg-rose-500 rounded-full shrink-0 mt-1"></span>
                          )}
                        </div>
                        <p className="text-[11px] text-slate-500 font-sans leading-normal">
                          {notif.message}
                        </p>
                        <p className="text-[9px] text-slate-400 font-mono">
                          {formatTimeAgo(notif.timestamp)}
                        </p>
                      </div>
                    </div>
                  ))
                )}
              </div>
              
              {/* Footer system status bar */}
              <div className="px-4 py-2 bg-slate-50 border-t border-slate-100 text-[10px] text-slate-500 text-center font-mono uppercase tracking-wider select-none">
                RA 10173 Audit-Secure
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

