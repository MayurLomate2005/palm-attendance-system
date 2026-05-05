import clsx from "clsx";
import { TrendingUp, TrendingDown } from "lucide-react";

export default function StatCard({ title, value, subtitle, icon: Icon, color = "brand", trend }) {
  const colorMap = {
    brand:   "from-brand-500/20 to-brand-600/5 border-brand-500/20 text-brand-400",
    emerald: "from-emerald-500/20 to-emerald-600/5 border-emerald-500/20 text-emerald-400",
    red:     "from-red-500/20 to-red-600/5 border-red-500/20 text-red-400",
    amber:   "from-amber-500/20 to-amber-600/5 border-amber-500/20 text-amber-400",
    violet:  "from-violet-500/20 to-violet-600/5 border-violet-500/20 text-violet-400",
    blue:    "from-blue-500/20 to-blue-600/5 border-blue-500/20 text-blue-400",
  };
  const [from, , , border, text] = colorMap[color]?.split(" ") || colorMap.brand.split(" ");

  return (
    <div className={clsx(
      "card-sm bg-gradient-to-br border animate-fade-in",
      colorMap[color]
    )}>
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <p className="text-xs text-slate-500 uppercase tracking-wider font-semibold mb-1">
            {title}
          </p>
          <p className="text-3xl font-bold text-white tabular-nums">{value ?? "—"}</p>
          {subtitle && (
            <p className="text-xs text-slate-500 mt-1 truncate">{subtitle}</p>
          )}
        </div>
        {Icon && (
          <div className={clsx("w-10 h-10 rounded-xl flex items-center justify-center",
                               "bg-surface-200 shrink-0 ml-3", colorMap[color].split(" ").pop())}>
            <Icon size={20} />
          </div>
        )}
      </div>
      {trend !== undefined && (
        <div className={clsx(
          "flex items-center gap-1 mt-2 text-xs font-medium",
          trend >= 0 ? "text-emerald-400" : "text-red-400"
        )}>
          {trend >= 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
          {Math.abs(trend)}% vs yesterday
        </div>
      )}
    </div>
  );
}
