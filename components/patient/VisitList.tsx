'use client';

import { Card, CardContent } from '@/components/ui/card';

interface VisitItem {
  id: string;
  date: string;
  memo: string;
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
            <p className="text-sm text-gray-700">{visit.memo}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
