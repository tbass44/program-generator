'use client';

import { Card, CardContent } from '@/components/ui/card';
import { ChevronRight } from 'lucide-react';
import Link from 'next/link';

interface SupportItem {
  name: string;
  href: string;
}

interface SupportCategoryCardProps {
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
  recommendedSupport: string;
  relatedProgramId?: string;
  relatedProgramTitle?: string;
  supportItems?: SupportItem[];
}

export function SupportCategoryCard({
  href,
  icon: Icon,
  title,
  description,
  recommendedSupport,
  relatedProgramId,
  relatedProgramTitle,
  supportItems,
}: SupportCategoryCardProps) {
  return (
    <Link href={href}>
      <Card className="hover:shadow-md transition-shadow cursor-pointer border-gray-200">
        <CardContent className="p-4">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 rounded-lg bg-teal-100">
              <Icon className="h-5 w-5 text-teal-700" />
            </div>
            <div className="flex-1">
              <h3 className="font-medium text-gray-900">{title}</h3>
              <p className="text-xs text-gray-500">{description}</p>
            </div>
            <ChevronRight className="h-5 w-5 text-gray-400 flex-shrink-0" />
          </div>

          <div className="ml-1 space-y-2">
            <div className="flex items-start gap-2">
              <span className="text-xs text-teal-600 font-medium mt-0.5 flex-shrink-0">おすすめ</span>
              <p className="text-sm text-gray-700">{recommendedSupport}</p>
            </div>

            {relatedProgramId && relatedProgramTitle && (
              <Link
                href={`/programs/${relatedProgramId}`}
                className="flex items-center gap-1 text-xs text-teal-600 hover:underline"
                onClick={(e) => e.stopPropagation()}
              >
                関連プログラム: {relatedProgramTitle}
              </Link>
            )}

            {supportItems && supportItems.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-1">
                {supportItems.map((item) => (
                  <Link
                    key={item.name}
                    href={item.href}
                    className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded-full hover:bg-gray-200"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {item.name}
                  </Link>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
