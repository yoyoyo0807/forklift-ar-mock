"use client";
import { useEffect } from "react";
import { ArrowLeft, ClipboardList, Sparkles, Star } from "lucide-react";
import Link from "next/link";

export default function OptimizationPage() {
  useEffect(() => {
    // globals.css の overflow:hidden を上書きしてスクロール可能にする
    document.body.style.overflow = "auto";
    return () => {
      document.body.style.overflow = "";
    };
  }, []);

  return (
    <div className="min-h-screen bg-[#050a14] text-white p-6">
      <div className="max-w-6xl mx-auto space-y-6">

        {/* ヘッダー */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Sparkles className="text-indigo-400" size={20} />
            <div>
              <h1 className="text-lg font-bold text-white">最適化</h1>
              <p className="text-xs text-gray-500">
                QUBO + 量子インスパイア最適化 — 衝突回避スケジューリング
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/admin"
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-gray-800 hover:bg-gray-700 rounded-lg border border-gray-700 text-gray-300 transition-colors"
            >
              <ArrowLeft size={11} />
              モニター
            </Link>
            <Link
              href="/admin/instructions"
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-indigo-900/50 hover:bg-indigo-800/60 rounded-lg border border-indigo-700/50 text-indigo-300 transition-colors"
            >
              <ClipboardList size={11} />
              指示
            </Link>
            <Link
              href="/admin/evaluate"
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-indigo-900/50 hover:bg-indigo-800/60 rounded-lg border border-indigo-700/50 text-indigo-300 transition-colors"
            >
              <Star size={11} />
              評価
            </Link>
          </div>
        </div>

        {/* 最適化シミュレーション動画 */}
        <div className="rounded-xl border border-indigo-800/50 bg-[#0a0f1a] overflow-hidden">
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-800">
            <div>
              <p className="text-xs font-semibold text-white">最適化シミュレーション</p>
              <p className="text-[10px] text-gray-500">
                衝突回避スケジューリング適用済み・走行軌跡トラッキング
              </p>
            </div>
            <span className="text-[10px] text-indigo-400 font-mono">1280×720 / 30fps</span>
          </div>
          <video
            src="/simulation.mp4"
            controls
            autoPlay
            muted
            loop
            playsInline
            className="w-full"
            style={{ aspectRatio: "16/9", background: "#000" }}
          />
        </div>

        {/* シミュレーション情報 */}
        <div className="rounded-xl border border-gray-800 bg-[#0a0f1a] px-4 py-3 space-y-2">
          <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">
            シミュレーション情報
          </p>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[11px]">
            <span className="text-gray-500">推定完了時間</span>
            <span className="text-white font-semibold">~107.6秒</span>
            <span className="text-gray-500">衝突回避ペア数</span>
            <span className="text-yellow-400 font-semibold">33 ペア</span>
            <span className="text-gray-500">使用フォークリフト</span>
            <span className="text-emerald-400 font-semibold">5台 全稼働</span>
            <span className="text-gray-500">未対応スロット</span>
            <span className="text-red-400 font-semibold">slot5・slot10 (cyan)</span>
          </div>
        </div>

      </div>
    </div>
  );
}
