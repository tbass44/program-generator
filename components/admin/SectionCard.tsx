'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

interface SectionCardProps {
  title?: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
  actions?: React.ReactNode;
}

export function SectionCard({
  title,
  description,
  children,
  className,
  actions,
}: SectionCardProps) {
  return (
    <Card className={className}>
      {(title || actions) && (
        <CardHeader className="pb-4">
          <div className="flex items-start justify-between">
            <div>
              {title && <CardTitle className="text-lg">{title}</CardTitle>}
              {description && <CardDescription className="mt-1">{description}</CardDescription>}
            </div>
            {actions && <div className="flex items-center gap-2">{actions}</div>}
          </div>
        </CardHeader>
      )}
      <CardContent className={title || actions ? 'pt-0' : ''}>{children}</CardContent>
    </Card>
  );
}
