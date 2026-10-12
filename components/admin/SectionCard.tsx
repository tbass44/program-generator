'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

interface SectionCardProps {
  title?: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
  actions?: React.ReactNode;
}

type PatientPurchase = {
  id: string;
  purchasedAt: string;
  quantity: number;
  unitPrice: number | null;
  totalPrice: number | null;
  note: string | null;
  product: {
    id: string;
    name: string;
    category: string;
    price: number | null;
  } | null;
};

type PatientPurchasesResponse = {
  purchases?: PatientPurchase[];
  error?: string;
  detail?: unknown;
};

const categoryLabels: Record<string, string> = {
  physical_sleep: '物理療法（睡眠）',
  nutrition: '栄養療法',
  exercise: '運動療法',
  skincare: 'スキンケア',
};

function getPatientPurchaseInfo(pathname: string, title?: string) {
  if (title !== '購入希望・購入関連の商品') {
    return null;
  }

  const match = pathname.match(/^\/admin\/patients\/([^/]+)$/);

  if (!match?.[1]) {
    return null;
  }

  const patientId = match[1];

  return {
    patientId,
    createHref: `/admin/patients/${patientId}/purchases/new`,
  };
}

function formatDate(value: string | null | undefined) {
  if (!value) {
    return '未設定';
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleDateString('ja-JP');
}

function formatPrice(value: number | null | undefined) {
  if (typeof value !== 'number') {
    return '金額未設定';
  }

  return `${value.toLocaleString('ja-JP')}円`;
}

function getCategoryLabel(value: string | null | undefined) {
  if (!value) {
    return 'カテゴリ未設定';
  }

  return categoryLabels[value] ?? value;
}

function PatientPurchaseHistoryInline({ patientId }: { patientId: string }) {
  const [purchases, setPurchases] = useState<PatientPurchase[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    const fetchPurchases = async () => {
      try {
        setIsLoading(true);
        setErrorMessage(null);

        const response = await fetch(`/api/admin/patients/${patientId}/purchases`, {
          cache: 'no-store',
        });
        const data = (await response.json()) as PatientPurchasesResponse;

        if (!response.ok || !data.purchases) {
          const detail = data.detail ? ` ${String(data.detail)}` : '';
          setErrorMessage(`購入履歴を取得できませんでした。${detail}`);
          setPurchases([]);
          return;
        }

        setPurchases(data.purchases);
      } catch (error) {
        console.error(error);
        setErrorMessage(`購入履歴の取得中にエラーが発生しました。${String(error)}`);
        setPurchases([]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchPurchases();
  }, [patientId]);

  return (
    <div className="mt-5 border-t pt-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium">購入履歴</p>
          <p className="text-xs text-muted-foreground">
            商品マスタから直接追加した購入記録もここに表示されます。
          </p>
        </div>
      </div>

      {isLoading && <p className="text-sm text-muted-foreground">購入履歴を読み込み中です...</p>}
      {!isLoading && errorMessage && <p className="text-sm text-destructive">{errorMessage}</p>}
      {!isLoading && !errorMessage && purchases.length === 0 && (
        <p className="text-sm text-muted-foreground">購入履歴はまだありません。</p>
      )}
      {!isLoading && !errorMessage && purchases.length > 0 && (
        <div className="space-y-3">
          {purchases.map((purchase) => {
            const productName = purchase.product?.name ?? '商品情報なし';
            const category = getCategoryLabel(purchase.product?.category);

            return (
              <div key={purchase.id} className="rounded-lg border p-4">
                <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium">{productName}</p>
                      <Badge variant="secondary">{category}</Badge>
                      <Badge>購入済み</Badge>
                    </div>
                    <p className="mt-2 text-sm text-muted-foreground">
                      購入日: {formatDate(purchase.purchasedAt)} / 数量: {purchase.quantity}
                      {typeof purchase.totalPrice === 'number'
                        ? ` / 合計: ${formatPrice(purchase.totalPrice)}`
                        : ''}
                    </p>
                    {purchase.note && (
                      <p className="mt-2 text-sm text-muted-foreground whitespace-pre-wrap">
                        {purchase.note}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function SectionCard({
  title,
  description,
  children,
  className,
  actions,
}: SectionCardProps) {
  const pathname = usePathname();
  const purchaseInfo = getPatientPurchaseInfo(pathname, title);

  return (
    <Card className={className}>
      {(title || actions || purchaseInfo) && (
        <CardHeader className="pb-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              {title && <CardTitle className="text-lg">{title}</CardTitle>}
              {description && <CardDescription className="mt-1">{description}</CardDescription>}
            </div>
            {(actions || purchaseInfo) && (
              <div className="flex shrink-0 items-center gap-2">
                {actions}
                {purchaseInfo && (
                  <Link href={purchaseInfo.createHref}>
                    <Button size="sm">購入記録を追加</Button>
                  </Link>
                )}
              </div>
            )}
          </div>
        </CardHeader>
      )}
      <CardContent className={title || actions || purchaseInfo ? 'pt-0' : ''}>
        {children}
        {purchaseInfo && <PatientPurchaseHistoryInline patientId={purchaseInfo.patientId} />}
      </CardContent>
    </Card>
  );
}
