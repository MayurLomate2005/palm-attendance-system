import { Bell, RefreshCw } from "lucide-react";
import { useAuth } from "../context/AuthContext";

export default function Navbar({ title, onRefresh, loading }) {
  const { user } = useAuth();
  return (
    <header className="h-16 border-b border-white/5 bg-surface/80 backdrop-blur-sm
                       flex items-center justify-between px-6 sticky top-0 z-20">
      <div>
        <h2 className="text-lg font-semibold text-white">{title}</h2>
        <p className="text-xs text-slate-500">
          {new Date().toLocaleDateString("en-IN", {
            weekday: "long", year: "numeric", month: "long", day: "numeric",
          })}
        </p>
      </div>
      <div className="flex items-center gap-3">
        {onRefresh && (
          <button onClick={onRefresh} className="btn-icon" title="Refresh">
            <RefreshCw size={15} className={loading ? "animate-spin" : ""} />
          </button>
        )}
        <div className="btn-icon relative">
          <Bell size={15} />
          <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 bg-brand-500
                           rounded-full animate-pulse" />
        </div>
        <div className="flex items-center gap-2 pl-2 border-l border-white/10">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-brand-500 to-violet-600
                          flex items-center justify-center text-xs font-bold text-white">
            {user?.name?.charAt(0).toUpperCase()}
          </div>
          <span className="text-sm font-medium text-slate-300 hidden sm:block">
            {user?.name}
          </span>
        </div>
      </div>
    </header>
  );
}
