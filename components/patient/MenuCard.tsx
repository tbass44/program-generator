'use client';

import { Card, CardContent } from '@/components/ui/card';
import Link from 'next/link';

interface MenuCardProps {
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
}

export function MenuCard({ href, icon: Icon, title, description }: MenuCardProps) {
  return (
    <Link href={href}>
      <Card className="hover:shadow-md transition-shadow cursor-pointer border-gray-200">
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-teal-100">
              <Icon className="h-5 w-5 text-teal-700" />
            </div>
            <div>
              <p className="font-medium text-gray-900">{title}</p>
              <p className="text-xs text-gray-500">{description}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
