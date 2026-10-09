# Program Generator

整体院向けの患者管理・改善プログラム管理・商品提案管理アプリです。

管理者は患者情報、改善プログラム、プラン、通院履歴、商品提案、レンタル、購入履歴を管理できます。患者側はLINE LIFF経由で本人確認を行い、自分に紐づく改善プログラム・プラン・商品提案・通院履歴などを確認できます。

## Production

```text
https://program-generator-kappa.vercel.app/
```

患者側の基本入口はLINE LIFFです。

```text
https://liff.line.me/2009994089-zOEks62y
```

初回LINE連携用ページは以下です。

```text
https://program-generator-kappa.vercel.app/line/link
```

## Project Status

2026-10時点の実装状況です。

### 管理側

実装済みです。

- 患者管理
- 患者詳細
- LINE連携コード発行
- LINE連携解除
- 改善プログラム作成・編集・詳細
- 商品マスタ管理
- 患者別の商品提案管理
- プラン管理
- 回数券使用履歴
- 通院履歴管理
- レンタル履歴管理
- 購入履歴テーブル追加
- 購入記録追加画面

### 患者側

LINE LIFF本人確認ベースで実データ表示済みです。

- `/line`
- `/line/link`
- `/dashboard`
- `/programs`
- `/programs/[id]`
- `/plans`
- `/visits`
- `/product-support`
- `/product-support/[id]`
- `/rentals`
- `/purchases`

## Concept

このアプリでは、以下を分けて扱います。

```text
商品提案 = 患者に対して商品を提案・希望・レンタル管理する状態
購入履歴 = 実際に商品を購入した実績
```

サプリや消耗品のように複数回購入される商品があるため、購入済みは商品提案ステータスではなく、`patient_product_purchases` テーブルで履歴として管理します。

## Tech Stack

- Next.js 13 App Router
- React 18
- TypeScript
- Tailwind CSS
- shadcn/ui / Radix UI
- Supabase
- Clerk
- LINE LIFF
- Vercel

## Directory Overview

```text
app/
  (admin)/admin/               管理画面
  (patient)/                   患者画面
  api/admin/                   管理側API
  api/patient/                 患者側API
  api/line/                    LINE連携API
  line/                        LINE LIFF入口
components/
  admin/                       管理画面用コンポーネント
  patient/                     患者画面用コンポーネント
lib/                           共通処理
supabase/
  schema.sql                   ベーススキーマ
  migrations/                  追加マイグレーション
```

## Main Routes

### 管理側

```text
/admin
/admin/patients
/admin/patients/[id]
/admin/patients/[id]/line-link
/admin/patients/[id]/purchases/new
/admin/programs
/admin/programs/new
/admin/programs/[id]
/admin/programs/[id]/edit
/admin/products
/admin/products/new
/admin/products/[id]/edit
/admin/plans
/admin/plans/new
/admin/plans/[id]
```

### 患者側

```text
/line
/line/link
/dashboard
/programs
/programs/[id]
/plans
/visits
/product-support
/product-support/[id]
/rentals
/purchases
```

## Authentication / Authorization

### 管理側

管理側はClerkでログインし、Supabaseの `profiles.role = 'admin'` を確認します。

管理側APIでは基本的に以下の流れです。

```text
Clerk userId取得
↓
profiles.clerk_user_id と照合
↓
role = admin を確認
↓
Supabase service roleでDB操作
```

### 患者側

患者側はClerkログインではなく、LINE LIFFのIDトークンを使って本人確認します。

```text
LIFFでIDトークン取得
↓
APIへidTokenを送信
↓
サーバー側でLINE公式APIにIDトークンを検証
↓
LINE userIdを取得
↓
patients.line_user_id と照合
↓
本人の患者データのみ返す
```

患者側ではURLの `patientId` は信用しません。

## LINE LIFF

### LIFF設定

```text
LIFF ID: 2009994089-zOEks62y
LIFF URL: https://liff.line.me/2009994089-zOEks62y
Endpoint URL: https://program-generator-kappa.vercel.app/line
```

必要なScopeです。

```text
openid
profile
```

`openid` がないと `liff.getIDToken()` がnullになり、患者本人確認ができません。

### 初回連携フロー

```text
管理側で患者詳細を開く
↓
/admin/patients/[id]/line-link で6桁コードを発行
↓
患者に /line/link を案内
↓
患者がLINE認証後に6桁コードを入力
↓
patients.line_user_id にLINE userIdを保存
↓
連携完了後、患者画面へ進む
```

### 通常利用フロー

```text
患者がLIFF URLまたは /line を開く
↓
LINE IDトークン検証
↓
patients.line_user_id から患者特定
↓
/dashboard へ進む
```

## Environment Variables

Vercel / local `.env.local` に設定します。

```bash
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=
CLERK_SECRET_KEY=

NEXT_PUBLIC_LIFF_ID=2009994089-zOEks62y
LINE_CHANNEL_ID=2009994089
```

注意点です。

- `NEXT_PUBLIC_LIFF_ID` はブラウザ側で使うため公開前提です。
- `LINE_CHANNEL_ID` はLIFFが所属するLINEログインチャンネルのChannel IDです。
- Messaging APIのChannel IDと取り違えないようにしてください。
- `SUPABASE_SERVICE_ROLE_KEY` と `CLERK_SECRET_KEY` は公開しないでください。
- Vercelで環境変数を変更したらProduction Redeployが必要です。

## Database

主なテーブルです。

```text
profiles
patients
programs
products
patient_product_recommendations
patient_product_purchases
plans
ticket_usages
visits
```

### 商品提案ステータス

`patient_product_recommendations.status` は、商品提案やレンタル状態を管理します。

```text
recommended         提案中
purchase_requested  購入希望
rental_requested    レンタル希望
renting             レンタル中
rental_returned     レンタル終了
```

### 購入履歴

購入済みは `patient_product_recommendations.status` では管理しません。

実際の購入実績は `patient_product_purchases` に保存します。

```text
patient_product_purchases
  id
  patient_id
  product_id
  recommendation_id
  program_id
  purchased_at
  quantity
  unit_price
  total_price
  note
  created_at
  updated_at
```

これにより、同じ患者が同じサプリを複数回購入した場合も、履歴として複数件保存できます。

## Supabase Migrations

追加マイグレーションは `supabase/migrations` に置いています。

```text
20260522_add_patient_kana_phone.sql
20260926_add_rental_returned_status.sql
20261004_create_patient_product_purchases.sql
```

本番DBで未適用の場合は、Supabase SQL Editorで実行してください。

特に購入履歴機能を使うには以下が必要です。

```text
supabase/migrations/20261004_create_patient_product_purchases.sql
```

未実行の場合、`/purchases` や購入記録追加APIで以下のようなエラーになります。

```text
relation "patient_product_purchases" does not exist
```

## Development

### Install

```bash
npm install
```

### Start dev server

```bash
npm run dev
```

### Build

```bash
npm run build
```

### Type check

```bash
npm run typecheck
```

### Lint

```bash
npm run lint
```

## Local Workflow

変更確認の基本コマンドです。

```bash
cd ~/program-generator && git status && git diff --check && git diff
```

コミット前は必要に応じて以下を実行します。

```bash
npm run typecheck
npm run build
```

UIだけの軽微な修正では、`git diff --check` を優先し、構文リスクがある場合やAPI・型定義を大きく触った場合は `npm run build` まで確認します。

## Current Feature Notes

### 改善プログラム

`programs.today_task` カラムはDB上に残っていますが、画面・API上では「今日やること」は使わない方針です。

管理画面・患者画面ともに表示しません。

### 商品詳細

患者側の商品詳細は以下です。

```text
/product-support/[recommendationId]
```

商品サポート、レンタル、購入希望から同じ詳細ページへ遷移します。

### レンタル

レンタルは `patient_product_recommendations` のステータスで管理します。

```text
rental_requested
renting
rental_returned
```

患者側 `/rentals` では、レンタル希望・レンタル中・レンタル終了に分けて表示します。

### 購入希望と購入履歴

患者側 `/purchases` は以下の2つを表示します。

```text
購入希望   patient_product_recommendations.status = purchase_requested
購入履歴   patient_product_purchases
```

管理側では以下から購入記録を追加できます。

```text
/admin/patients/[id]/purchases/new
```

## Known Operational Notes

- 患者側ページを直接開くと、LINE WebViewやLIFFのリダイレクト条件により400になることがあります。
- 基本入口は `/line` または LIFF URLに寄せます。
- 一部ページでは、直接URLアクセス時に `sessionStorage` に遷移先を保存し、`/line` 経由で戻るようにしています。
- 今後、患者側全ページの直接URLログイン導線を共通化すると保守しやすくなります。

## Next Tasks

今後の候補です。

```text
1. 患者詳細ページに「購入記録を追加」ボタンを分かりやすく配置
2. 管理側で購入履歴一覧を患者詳細に表示
3. 購入履歴の編集・削除APIを追加
4. 患者側全ページのLINE認証導線を共通フック化
5. ダッシュボードに購入履歴の要約を追加
6. Notion設計書へ購入履歴テーブル追加を反映
```
