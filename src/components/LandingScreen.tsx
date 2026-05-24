"use client";
import React from "react";
import { Play, Cpu, Eye, Navigation, ShieldCheck } from "lucide-react";

interface Props {
  onStart: () => void;
}

const FEATURES = [
  {
    icon: <Eye size={18} className="text-indigo-400" />,
    title: "Gemini Vision 解析",
    desc: "全フレームを事前解析しゼロラグで誘導",
  },
  {
    icon: <Navigation size={18} className="text-emerald-400" />,
    title: "リアルタイムナビ",
    desc: "積荷フェーズに応じた進行方向を自動判定",
  },
  {
    icon: <ShieldCheck size={18} className="text-amber-400" />,
    title: "オペレータ監視",
    desc: "疲労・PPE・注意スコアを継続モニタリング",
  },
];

export function LandingScreen({ onStart }: Props) {
  return (
    <div className="relative flex flex-col items-center justify-center h-screen bg-[#070b14] overflow-hidden select-none">

      {/* ── 背景グリッド ── */}
      <svg
        className="absolute inset-0 w-full h-full opacity-[0.035] pointer-events-none"
        aria-hidden
      >
        <defs>
          <pattern id="land-grid" width="72" height="72" patternUnits="userSpaceOnUse">
            <path d="M 72 0 L 0 0 0 72" fill="none" stroke="#6366f1" strokeWidth="0.6" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#land-grid)" />
      </svg>

      {/* ── 放射状グロー ── */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse 70% 55% at 50% 50%, rgba(99,102,241,0.08) 0%, transparent 70%)",
        }}
      />

      {/* ── コーナーブラケット ── */}
      {(["top-6 left-6", "top-6 right-6 rotate-90", "bottom-6 right-6 rotate-180", "bottom-6 left-6 -rotate-90"] as const).map(
        (cls, i) => (
          <div
            key={i}
            className={`absolute ${cls} w-8 h-8 border-l-2 border-t-2 border-indigo-500/30`}
          />
        )
      )}

      {/* ── 中央コンテンツ ── */}
      <div className="relative z-10 flex flex-col items-center gap-8 px-6 text-center max-w-2xl">

        {/* ロゴ行 */}
        <div className="flex items-center gap-3">
          <div className="relative">
            <span className="text-5xl filter drop-shadow-[0_0_16px_rgba(99,102,241,0.6)]">🚛</span>
          </div>
          <div className="text-left">
            <p className="text-[10px] font-mono tracking-[0.35em] text-indigo-400/70 uppercase">
              AR Safety System
            </p>
            <h1 className="text-2xl font-bold tracking-widest text-gray-100 leading-none">
              FORKLIFT AR ASSIST
            </h1>
          </div>
        </div>

        {/* キャッチコピー */}
        <div className="space-y-1">
          <p className="text-gray-300 text-base font-light leading-relaxed">
            Gemini 2.5 Flash が動画全体を事前解析し、<br />
            ゼロラグのリアルタイム安全誘導を提供します。
          </p>
          <p className="text-[11px] text-gray-600 font-mono tracking-wider">
            Powered by Gemini 2.5 Flash · Computer Vision · FastAPI
          </p>
        </div>

        {/* フィーチャーカード */}
        <div className="grid grid-cols-3 gap-3 w-full">
          {FEATURES.map((f) => (
            <div
              key={f.title}
              className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-3.5 text-left backdrop-blur-sm"
            >
              <div className="mb-2">{f.icon}</div>
              <p className="text-xs font-semibold text-gray-200 mb-1">{f.title}</p>
              <p className="text-[10px] text-gray-500 leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>

        {/* 解析開始ボタン */}
        <button
          onClick={onStart}
          className="
            group relative flex items-center gap-3
            px-10 py-4 rounded-2xl
            bg-indigo-600 hover:bg-indigo-500
            border border-indigo-400/40 hover:border-indigo-300/60
            text-white font-bold text-base tracking-wide
            transition-all duration-200
            shadow-[0_0_32px_rgba(99,102,241,0.35)] hover:shadow-[0_0_48px_rgba(99,102,241,0.55)]
            active:scale-95
          "
        >
          {/* パルスリング */}
          <span className="absolute inset-0 rounded-2xl border border-indigo-400/30 animate-ping opacity-40 pointer-events-none" />

          <Play
            size={18}
            className="fill-white transition-transform group-hover:translate-x-0.5"
          />
          解析開始
          <Cpu size={14} className="text-indigo-300/70" />
        </button>

        {/* 注意書き */}
        <p className="text-[10px] text-gray-700 font-mono">
          ※ Gemini Vision による事前解析（約10〜30秒）が完了後、動画ストリーミングを開始します
        </p>
      </div>

      {/* ── スキャンライン装飾 ── */}
      <div
        className="absolute bottom-0 left-0 right-0 h-px pointer-events-none"
        style={{
          background:
            "linear-gradient(90deg, transparent 0%, rgba(99,102,241,0.4) 50%, transparent 100%)",
        }}
      />
    </div>
  );
}
