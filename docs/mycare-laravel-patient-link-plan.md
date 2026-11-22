# MyCare v2.0 / Laravel患者ID連携の実装前提（2026-11-22）

## 何を追加したか

`supabase/migrations/20261122_create_patient_external_ids.sql` は、MyCare `patients.id`（UUID）とLaravel `users.id`（整数）を結ぶ対応表を追加する**未適用のSQL**。患者の自動照合・移行は行わない。

- 同じLaravel患者IDを同時に複数のMyCare患者へ紐付けできない
- MyCare患者1人に複数の有効なLaravel患者IDを割り当てない
- `verified` と `revoked` の履歴を保持
- 行レベルセキュリティ（RLS）を有効化し、匿名・通常認証ユーザーにはアクセスを許可しない
- 管理者が本人確認した日時・方法・ClerkユーザーIDを監査できる
- **MyCareログイン済みであるだけではLaravel患者IDを確定できない**。管理者側で既存Laravelユーザーの同一人物確認が必要

## 未実装のため本番へ流さない

- Laravel側の患者照会API（サーバー間認証付き）と患者実在確認
- 管理者が照合結果を確認して明示的に確定させるAPI/画面
- 誤紐付けを解除・監査する管理画面
- MyCareのLINE認証済み患者に限定したLaravelへのチケット発行
- Laravel側の一回限りチケット受信・予約専用セッション・再予約画面

`patient_external_ids` の行が作られても、その情報だけで予約を許可してはいけない。管理者確認のほか、Laravel側で本人の有効なIDを再確認する。

## 予約枠の書き込み経路の追加調査

Laravel側の `chirothird` 作業ブランチ `fix/mycare-booking-slot-atomic` を確認した。

| 処理 | 現状 | 判断 |
| --- | --- | --- |
| `ReserveController::process` | `BookingSlotGuard` を呼ぶ | PHPUnit + 隔離MySQLの順次/別プロセス競合試験成功（PR #105、未マージ） |
| `Admin/EventController::store` | 重複確認後に別処理で`events`保存 | 同時書き込みを防ぐ同じロックは未使用 |
| `Admin/EventController::update` | 自分を除外して重複確認後、イベントを更新 | 同じロック未使用。自イベントを除く条件の共通化が必要 |
| `SpReserveController::process` | 予約人数をチェック後に登録 | 同時申込時の定員超過を防ぐ行ロックが未確認 |
| `ReservationService::createReservation` | DBトランザクションはあるが行ロックなし | 同時の定員計算・登録の競合に注意 |
| `DateReserveController` | 既存コードはイベント作成を含む | ルートはコメントアウト。再有効化前に修正必要 |

**重要：PR #105の排他制御は通常予約Controllerにのみ適用されており、すべての予約経路の排他が保証されたわけではない。** MyCareの再予約入口を公開する前に、管理者イベント登録と通常予約が同じロックを使用すること、イベント予約の人数ロックを別途確認する。

## 開発順序

1. Laravel側に管理者専用の本人照合API（ユーザーの存在と基本情報、表示最小限）を実装する。サーバー間の署名または強い認証が必要。
2. MyCare管理側に確認済み対応付け・取消しAPIを作り、本人確認手順・重複拒否を実装する。
3. 予約チケットの発行・一回消費・専用セッションを整える。ブラウザ指定の `user_id` を信用しない。
4. 専用Laravel再予約画面に既存カレンダーを組み込み、通常予約と同じ重複防止処理で保存する。
5. 管理者イベント・イベント予約との競合、通知、キャンセル、冪等性を隔離MySQLで検証する。

## 現在の状態

- 本ファイルとSQLはGitHubの提案のみ。Supabaseへの適用、本番連携、本番予約データへの変更は未実施。
- APIと画面はまだ作成していない。本人確認ができない患者は再予約不可にする。
