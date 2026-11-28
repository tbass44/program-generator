'use client';

import { ExternalLink } from 'lucide-react';
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
  return (
    <div className="space-y-3">
      {visits.map((visit) => {
        const shareUrl = getTrustedShareUrl(visit.postureAnalysisUrl);
        return (
          <Card key={visit.id} className="border-gray-200">
            <CardContent className="p-4">
              <p className="mb-1 text-xs text-gray-500">{visit.date}</p>
              <p className="whitespace-pre-wrap text-sm text-gray-700">{visit.memo}</p>
              {shareUrl && (
                <div className="mt-3">
                  <a href={shareUrl} target="_blank" rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-sm font-medium text-teal-700 underline underline-offset-2">
                    <ExternalLink className="h-4 w-4" />
                    AI姿勢分析を別画面で見る
                  </a>
                  <p className="mt-1 text-xs text-gray-500">
                    Kartieの分析結果を別画面で開きます。MyCareの通院履歴はそのまま残ります。
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
