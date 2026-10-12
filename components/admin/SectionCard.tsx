'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

interface SectionCardProps {
  title?: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
  actions?: React.ReactNode;
}

function getPatientPurchaseCreateHref(pathname: string, title?: string) {
  if (title !== '購入希望・購入関連の商品') {
    return null;
  }

  const match = pathname.match(/^\/admin\/patients\/([^/]+)$/);

  if (!match?.[1]) {
    return null;
  }

  return `/admin/patients/${match[1]}/purchases/new`;
}

export function SectionCard({
  title,
  description,
  children,
  className,
  actions,
}: SectionCardProps) {
  const pathname = usePathname();
  const purchaseCreateHref = getPatientPurchaseCreateHref(pathname, title);

  return (
    <Card className={className}>
      {(title || actions || purchaseCreateHref) && (
        <CardHeader className="pb-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              {title && <CardTitle className="text-lg">{title}</CardTitle>}
              {description && <CardDescription className="mt-1">{description}</CardDescription>}
            </div>
            {(actions || purchaseCreateHref) && (
              <div className="flex shrink-0 items-center gap-2">
                {actions}
                {purchaseCreateHref && (
                  <Link href={purchaseCreateHref}>
                    <Button size="sm">購入記録を追加</Button>
                  </Link>
                )}
              </div>
            )}
          </div>
        </CardHeader>
      )}
      <CardContent className={title || actions || purchaseCreateHref ? 'pt-0' : ''}>{children}</CardContent>
    </Card>
  );
}
