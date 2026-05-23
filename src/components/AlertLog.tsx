"use client";
import { Zap } from "lucide-react";
import type { AlertEntry, RiskLevel } from "@/types";

const LEVEL_STYLE: Record<RiskLevel, string> = {
  critical: "text-red-400 bg-red-950/50 border-red-800/50",
  warning:  "text-amber-400 bg-amber-950/50 border-amber-800/50",
  safe:     "text-emerald-400 bg-emerald-950/50 border-emerald-800/50",
  info:     "text-indigo-400 bg-indigo-950/50 border-indigo-800/50",
};

const LEVEL_LABEL: Record<RiskLevel, string> = {
  critical: "緊急",
  warning:  "警告",
  safe:     "安全",
  info:     "情報",
};

export function AlertLog({ alerts }: { alerts: AlertEntry[] }) {
  return (
    <div className="flex-1 min-h-0 overflow-y-auto space-y-1.5 pr-1">
      {alerts.length === 0 ? (
        <p className="text-xs text-gray-700 text-center py-4">アラートなし</p>
      ) : (
        alerts.map((a) => (
          <div
            key={a.id}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs animate-fade-in ${LEVEL_STYLE[a.level]}`}
          >
            <Zap size={10} className="shrink-0" />
            <span className="font-semibold shrink-0">{LEVEL_LABEL[a.level]}</span>
            <span className="text-gray-400 flex-1 truncate">{a.message}</span>
            <span className="font-mono text-gray-600 shrink-0">{a.time}</span>
          </div>
        ))
      )}
    </div>
  );
}
