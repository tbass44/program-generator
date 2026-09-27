'use client';

import { Card, CardContent } from '@/components/ui/card';
import { ChevronRight, Clock, Calendar } from 'lucide-react';
import Link from 'next/link';

interface ProgramCardProps {
  id: string;
  title: string;
  shortTerm: string;
  longTerm: string;
}

export function ProgramCard({ id, title, shortTerm, longTerm }: ProgramCardProps) {
  return (
    <Link href={`/programs/${id}`}>
      <Card className="hover:shadow-md transition-shadow cursor-pointer border-teal-200 bg-gradient-to-br from-teal-50 to-white">
        <CardContent className="p-5">
          <div className="flex justify-between items-start mb-4">
            <h3 className="font-semibold text-gray-900">{title}</h3>
            <ChevronRight className="h-5 w-5 text-teal-600 flex-shrink-0" />
          </div>

          <div className="space-y-3">
            <div className="flex items-start gap-2.5">
              <Clock className="h-4 w-4 text-teal-600 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-xs text-gray-500">短期プログラム（3カ月）</p>
                <p className="text-sm text-gray-700">{shortTerm}</p>
              </div>
            </div>

            <div className="flex items-start gap-2.5">
              <Calendar className="h-4 w-4 text-teal-600 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-xs text-gray-500">長期プログラム</p>
                <p className="text-sm text-gray-700">{longTerm}</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
