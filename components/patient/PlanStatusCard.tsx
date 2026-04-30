'use client';

import { Card, CardContent } from '@/components/ui/card';
import { Ticket, Calendar } from 'lucide-react';

interface PlanStatusCardProps {
  type: 'ticket' | 'subscription';
  remaining?: number;
  expiresAt?: string;
}

export function PlanStatusCard({ type, remaining, expiresAt }: PlanStatusCardProps) {
  return (
    <Card className="bg-gradient-to-br from-teal-50 to-cyan-50 border-teal-200">
      <CardContent className="p-5">
        <div className="flex items-center gap-3 mb-3">
          {type === 'ticket' ? (
            <Ticket className="h-5 w-5 text-teal-600" />
          ) : (
            <Calendar className="h-5 w-5 text-teal-600" />
          )}
          <span className="text-sm text-gray-600">
            {type === 'ticket' ? '回数券' : 'サブスク'}
          </span>
        </div>
        <div className="text-center py-2">
          {type === 'ticket' ? (
            <>
              <span className="text-4xl font-bold text-teal-700">{remaining}</span>
              <span className="text-lg text-teal-600 ml-1">回</span>
              <p className="text-sm text-gray-500 mt-1">残り回数</p>
            </>
          ) : (
            <>
              <span className="text-4xl font-bold text-teal-700">{remaining}</span>
              <span className="text-lg text-teal-600 ml-1">日</span>
              <p className="text-sm text-gray-500 mt-1">
                有効期限: {expiresAt}
              </p>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
