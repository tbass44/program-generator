'use client';

import { useEffect, useState } from 'react';
import { ExternalLink, X } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';

interface VisitItem {
  id: string;
  date: string;
  memo: string;
  postureAnalysisUrl?: string;
}

interface VisitListProps {
  visits: VisitItem[];
}

function getTrustedShareUrl(value: string | undefined): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' &&
      url.hostname === 'app.kartie-cloud.jp' &&
      url.pathname.startsWith('/user/') &&
      !url.username && !url.password
      ? url.href
      : null;
  } catch {
    return null;
  }
}

export function VisitList({ visits }: VisitListProps) {
  const [openReport, setOpenReport] = useState<{ url: string; date: string } | null>(null);

  useEffect(() => {
    if (!openReport) return;
    const onEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpenReport(null);
    };
    window.addEventListener('keydown', onEscape);
    return () => window.removeEventListener('keydown', onEscape);
  }, [openReport]);

  return (
    <>
      <div className="space-y-3">
        {visits.map((visit) => {
          const shareUrl = getTrustedShareUrl(visit.postureAnalysisUrl);
          return (
            <Card key={visit.id} className="border-gray-200">
              <CardContent className="p-4">
                <p className="mb-1 text-xs text-gray-500">{visit.date}</p>
                <p className="whitespace-pre-wrap text-sm text-gray-700">{visit.memo}</p>
                {shareUrl && (
                  <button type="button"
                    onClick={() => setOpenReport({ url: shareUrl, date: visit.date })}
                    className="mt-3 text-left text-sm font-medium text-teal-700 underline underline-offset-2">
                    MyCare内でAI姿勢分析を見る
                  </button>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {openReport && (
        <div className="fixed inset-0 z-[100] flex flex-col bg-white" role="dialog"
          aria-modal="true" aria-label={`AI姿勢分析の結果（${openReport.date}）`}>
          <div className="flex shrink-0 items-center justify-between gap-2 border-b bg-white px-3 py-3">
            <div className="min-w-0">
              <p className="font-semibold text-gray-900">AI姿勢分析</p>
              <p className="text-xs text-gray-500">{openReport.date} の分析結果</p>
            </div>
            <button type="button" onClick={() => setOpenReport(null)}
              aria-label="分析結果を閉じてMyCareに戻る"
              className="inline-flex items-center gap-1 rounded-md border px-3 py-2 text-sm font-medium text-gray-700">
              <X className="h-4 w-4" />閉じる
            </button>
          </div>
          <div className="min-h-0 flex-1 bg-gray-50">
            <iframe key={openReport.url} title={`AI姿勢分析の結果（${openReport.date}）`}
              src={openReport.url} className="h-full w-full border-0"
              referrerPolicy="no-referrer"
              sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
            />
          </div>
          <div className="shrink-0 border-t bg-white px-3 py-2">
            <p className="mb-1 text-xs text-gray-600">
              外部サービスの制限で表示されない場合は、別タブで開いてください。MyCareの画面は残ります。
            </p>
            <a href={openReport.url} target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-sm font-medium text-teal-700 underline">
              <ExternalLink className="h-4 w-4" />別タブで開く
            </a>
          </div>
        </div>
      )}
    </>
  );
}
