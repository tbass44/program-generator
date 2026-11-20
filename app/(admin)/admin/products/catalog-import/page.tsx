'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { PageHeader, SectionCard } from '@/components/admin';
import manifest from '@/data/catalog2026-manifest.json';

type DocumentInfo = { id: string; title: string; pdf_url: string };
type ApiResult = { documents?: DocumentInfo[]; document?: DocumentInfo; error?: string };
type LogEntry = { label: string; message: string; error: boolean };
const MAX_UPLOAD_SIZE = 4 * 1024 * 1024; // Vercel request-body limit is lower than the storage limit.
const catalogPrefix = '健美生活2026｜';

export default function CatalogImportPage() {
  const [files, setFiles] = useState<File[]>([]);
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0, added: 0, skipped: 0, failed: 0 });
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const fileMap = useMemo(() => {
    const map = new Map<number, File>();
    for (const file of files) {
      const match = /^(\d{3})_.*\.pdf$/i.exec(file.name);
      if (match) map.set(Number(match[1]), file);
    }
    return map;
  }, [files]);

  const withProducts = manifest.items.filter((item) => item.productIds.length > 0);
  const ready = withProducts.filter((item) => fileMap.has(item.itemNo));
  const oversize = ready.filter((item) => (fileMap.get(item.itemNo)?.size ?? 0) > MAX_UPLOAD_SIZE);
  const missing = withProducts.filter((item) => !fileMap.has(item.itemNo));
  const targetCount = ready.reduce((sum, item) => sum + item.productIds.length, 0);

  const startImport = async () => {
    if (running || ready.length === 0 || oversize.length > 0) return;
    if (!window.confirm(`${ready.length}種類・${targetCount}件の商品資料を本番へ登録します。既存のPDFは上書きしません。開始しますか？`))
      return;

    const state = { done: 0, total: targetCount, added: 0, skipped: 0, failed: 0 };
    const entries: LogEntry[] = [];
    setLogs([]);
    setProgress({ ...state });
    setRunning(true);
    const pushLog = (label: string, message: string, error = false) => {
      entries.push({ label, message, error });
      setLogs([...entries]);
    };

    try {
      for (const item of ready) {
        const file = fileMap.get(item.itemNo)!;
        const title = catalogPrefix + item.title;
        for (const productId of item.productIds) {
          try {
            // GET before POST makes a retry safe after navigation or an interrupted upload.
            const listResponse = await fetch(`/api/admin/products/${productId}/pdf`, { cache: 'no-store' });
            const list = await listResponse.json() as ApiResult;
            if (!listResponse.ok || !list.documents)
              throw new Error(list.error ?? `登録済みPDF確認に失敗（${listResponse.status}）`);
            if (list.documents.some((doc) => doc.title === title)) {
              state.skipped += 1;
            } else {
              const body = new FormData();
              body.append('file', file);
              body.append('title', title);
              const response = await fetch(`/api/admin/products/${productId}/pdf`, {
                method: 'POST', body,
              });
              const result = await response.json() as ApiResult;
              if (!response.ok || !result.document)
                throw new Error(result.error ?? `アップロード失敗（${response.status}）`);
              state.added += 1;
            }
          } catch (error) {
            state.failed += 1;
            pushLog(item.title, error instanceof Error ? error.message : String(error), true);
          } finally {
            state.done += 1;
            setProgress({ ...state });
          }
        }
      }
      pushLog('処理完了', `追加 ${state.added}件／登録済み ${state.skipped}件／失敗 ${state.failed}件`);
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-5">
      <PageHeader
        title="健美生活2026｜商品PDF一括登録"
        description="商品名とIDを照合済みのPDFを、既存資料を消さずに商品ごとに追加します"
        backHref="/admin/products"
      />
      <SectionCard title="1. 商品別PDFを選択">
        <p className="mb-3 text-sm text-muted-foreground">
          商品別PDF ZIPをパソコンで展開し、pdfsフォルダ内のPDF94件をすべて選択してください。
          ZIPファイルそのものではなく、展開済みのPDFを指定します。
        </p>
        <input
          type="file" accept=".pdf,application/pdf" multiple disabled={running}
          className="block w-full text-sm"
          onChange={(event) => setFiles(Array.from(event.target.files ?? []))}
        />
        <div className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
          <p>選択ファイル：<strong>{files.length}件</strong></p>
          <p>登録可能な資料：<strong>{ready.length} / {withProducts.length}種類</strong></p>
          <p>登録対象：<strong>{targetCount}件の商品PDF</strong></p>
          <p>サイズ超過：<strong>{oversize.length}件</strong></p>
        </div>
        {oversize.length > 0 && (
          <div className="mt-3 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
            4MBを超えるPDFがあります：{oversize.map((x) => x.title).join('、')}。
            サイズを小さくした登録用ZIPをご利用ください。
          </div>
        )}
        {missing.length > 0 && files.length > 0 && (
          <p className="mt-3 text-sm text-muted-foreground">
            不足：{missing.map((x) => x.title).join('、')}
          </p>
        )}
        <p className="mt-3 text-xs text-muted-foreground">
          未対応商品（PDFの該当資料なし）：フィルムノーブルオイル、
          フレッシュカバーコンパクト 専用スポンジ、ヘアートリートメント。
        </p>
      </SectionCard>
      <SectionCard title="2. 本番に登録">
        <p className="mb-3 text-sm text-muted-foreground">
          既に「健美生活2026｜商品名」という資料が登録されていればスキップします。
          エラーが発生しても他の商品は継続し、再度開始すれば未登録分だけ追加します。
        </p>
        <Button disabled={running || ready.length === 0 || oversize.length > 0}
          onClick={() => void startImport()}>
          {running ? '登録中...' : '本番へ一括登録'}
        </Button>
        {(running || progress.total > 0) && (
          <div className="mt-4 space-y-2 text-sm" aria-live="polite">
            <p>進捗：{progress.done} / {progress.total}</p>
            <progress className="w-full" max={progress.total || 1} value={progress.done} />
            <p>追加：{progress.added}件 ／ 登録済み：{progress.skipped}件 ／ 失敗：{progress.failed}件</p>
          </div>
        )}
        {logs.length > 0 && (
          <div className="mt-4 max-h-64 space-y-1 overflow-auto rounded-md bg-muted p-3 text-sm">
            {logs.map((entry, i) => (
              <p key={i} className={entry.error ? 'text-destructive' : ''}>
                {entry.label}：{entry.message}
              </p>
            ))}
          </div>
        )}
        <p className="mt-3 text-xs text-muted-foreground">
          登録が終わるまで、このタブを閉じずに開いてください。
          入力PDFはブラウザから管理API経由で直接送信され、GitHubにはアップロードされません。
        </p>
        <Link href="/admin/products" className="mt-4 block text-sm text-primary underline">商品管理一覧へ戻る</Link>
      </SectionCard>
    </div>
  );
}
