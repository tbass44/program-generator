'use client';

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

export function VisitList({ visits }: VisitListProps) {
  return (
    <div className="space-y-3">
      {visits.map((visit) => (
        <Card key={visit.id} className="border-gray-200">
          <CardContent className="p-4">
            <p className="text-xs text-gray-500 mb-1">{visit.date}</p>
            <p className="whitespace-pre-wrap text-sm text-gray-700">{visit.memo}</p>
            {visit.postureAnalysisUrl && (
              <a href={visit.postureAnalysisUrl} target="_blank" rel="noopener noreferrer"
                className="mt-3 inline-block text-sm font-medium text-teal-700 underline underline-offset-2">
                AI姿勢分析の結果を見る
              </a>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
