# forklift-ar-mock

フォークリフトARシステムのフロントエンドモック。Next.js + TypeScript + Tailwind CSS。実際の WebSocket サーバー不要で、Gemini API をフロントから直接呼ぶ構成。

## 技術スタック
- Next.js (App Router) + TypeScript (`strict: true`)
- Tailwind CSS
- Google Generative AI SDK（`@google/generative-ai`）
- Lucide React（アイコン）

## コマンド
```bash
npm install
npm run dev      # 開発サーバー（http://localhost:3000）
npm run build    # プロダクションビルド
npm run lint     # ESLint
```

## アーキテクチャ
```
src/app/         — App Router ページ・レイアウト
src/components/  — UIコンポーネント
public/          — 静的ファイル
```

## 注意事項
- `NEXT_PUBLIC_GEMINI_API_KEY` は `.env.local` で管理する（`.gitignore` 済み）
- `NEXT_PUBLIC_` プレフィックスはクライアントに露出する。本番では使わない設計
- UI の変更は preview で必ず視覚確認すること（`~/.claude/rules/ui-verification.md` 参照）
- Next.js は `node_modules/next/dist/docs/` の最新ドキュメントを優先する
