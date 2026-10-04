'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import liff from '@line/liff';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Calendar, ChevronRight, ExternalLink, ShoppingBag, Sparkles } from 'lucide-react';

const NEXT_PATH_STORAGE_KEY = 'patientNextPath';

type Product = {
  id: string;
  name: string;
  category: string;
  description: string | null;
  price: number | null;
  inventory_count: number | null;
  product_url: string | null;
  status: string;
};

type Program = {
  id: string;
  summary: string | null;
  created_at: string;
};

type PurchaseItem = {
  id: string;
  patient_id: string;
  program_id: string | null;
  product_id: string | null;
  category: string | null;
  reason: string | null;
  status: string;
  created_at: string;
  updated_at: string;
  product: Product | null;
  program: Program | null;
};

type PatientPurchasesResponse = {
  patient?: {
    id: string;
    name: string;
  };
  purchases?: PurchaseItem[];
  debug?: {
    patientId?: string;
    patientName?: string;
    lineUserId?: string;
    purchasesCount?: number;
  };
  error?: string;
  detail?: unknown;
};

const categoryLabels: Record<string, string> = {
  physical_sleep: '物理療法（睡眠）',
  nutrition: '栄養療法',
  exercise: '運動療法',
  skincare: 'スキンケア',
};

function getCurrentPath() {
  if (typeof window === 'undefined') {
    return '/purchases';
  }

  return `${window.location.pathname}${window.location.search}`;
}

function redirectToLineEntry() {
  try {
    window.sessionStorage.setItem(NEXT_PATH_STORAGE_KEY, getCurrentPath());
  } catch (error) {
    console.error(error);
  }

  window.location.href = '/line';
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

function shouldRetryLineLogin(message: string) {
  const lower = message.toLowerCase();

  return (
    lower.includes('access token revoked') ||
    lower.includes('failed to verify line id token') ||
    lower.includes('invalid token') ||
    lower.includes('expired')
  );
}

function retryLineLogin() {
  try {
    if (liff.isLoggedIn()) {
      liff.logout();
    }
  } catch (error) {
    console.error(error);
  }

  redirectToLineEntry();
}

function formatDetail(detail: unknown) {
  if (!detail) {
    return '';
  }

  if (typeof detail === 'string') {
    return detail;
  }

  try {
    return JSON.stringify(detail);
  } catch {
    return String(detail);
  }
}

function PurchaseCard({ purchase }: { purchase: PurchaseItem }) {
  const productName = purchase.product?.name ?? '商品名未設定';
  const category = purchase.product?.category ?? purchase.category;
  const reason = purchase.reason || purchase.product?.description || '購入希望理由は未登録です。';

  return (
    <Link href={`/product-support/${purchase.id}`} className="block">
      <Card className="border-gray-200 transition-shadow hover:shadow-md">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <div className="rounded-lg bg-amber-100 p-2">
              <ShoppingBag className="h-4 w-4 text-amber-700" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="mb-1 flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs text-gray-500">{getCategoryLabel(category)}</p>
                  <p className="font-medium text-gray-900">{productName}</p>
                </div>
                <Badge className="shrink-0 bg-amber-600 text-xs">購入希望</Badge>
              </div>

              <p className="mt-2 text-sm text-gray-600">{reason}</p>

              {purchase.program?.summary && (
                <p className="mt-2 rounded-md bg-gray-50 px-2 py-1 text-xs text-gray-500">
                  関連プログラム: {purchase.program.summary}
                </p>
              )}

              <div className="mt-3 flex items-center justify-between gap-3 text-xs text-gray-500">
                <span className="flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  {formatDate(purchase.updated_at || purchase.created_at)}
                </span>
                <span className="font-medium text-gray-700">
                  {formatPrice(purchase.product?.price)}
                </span>
              </div>

              <div className="mt-3 flex items-center justify-end text-xs font-medium text-teal-600">
                詳細を見る
                <ChevronRight className="h-3 w-3" />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

export default function PurchasesPage() {
  const [patientName, setPatientName] = useState<string | null>(null);
  const [purchases, setPurchases] = useState<PurchaseItem[]>([]);
  const [debugMessage, setDebugMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [statusMessage, setStatusMessage] = useState('LINE認証を確認しています...');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    const fetchPurchases = async () => {
      try {
        setIsLoading(true);
        setErrorMessage(null);
        setDebugMessage(null);
        setStatusMessage('LINE認証を確認しています...');

        const liffId = process.env.NEXT_PUBLIC_LIFF_ID;

        if (!liffId) {
          setErrorMessage('NEXT_PUBLIC_LIFF_ID が設定されていません。');
          return;
        }

        await liff.init({ liffId });

        if (!liff.isLoggedIn()) {
          redirectToLineEntry();
          return;
        }

        const idToken = liff.getIDToken();

        if (!idToken) {
          retryLineLogin();
          return;
        }

        setStatusMessage('購入希望情報を取得しています...');

        const response = await fetch('/api/patient/purchases', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ idToken }),
          cache: 'no-store',
        });

        const data = (await response.json()) as PatientPurchasesResponse;

        if (!response.ok) {
          console.error(data);
          const detail = formatDetail(data.detail);

          if (shouldRetryLineLogin(`${data.error ?? ''} ${detail}`)) {
            retryLineLogin();
            return;
          }

          if (data.error === 'Patient not linked') {
            setErrorMessage('このLINEアカウントはまだ患者データと連携されていません。');
          } else {
            setErrorMessage(`購入希望情報を取得できませんでした。${detail ? ` ${detail}` : ''}`);
          }

          if (data.debug) {
            setDebugMessage(
              `患者ID: ${data.debug.patientId ?? '-'} / 患者名: ${data.debug.patientName ?? '-'} / 件数: ${data.debug.purchasesCount ?? '-'}`
            );
          }

          return;
        }

        setPatientName(data.patient?.name ?? data.debug?.patientName ?? null);
        setPurchases(data.purchases ?? []);
        setStatusMessage('購入希望情報を取得しました。');

        if (data.debug) {
          setDebugMessage(
            `患者ID: ${data.debug.patientId ?? '-'} / 患者名: ${data.debug.patientName ?? '-'} / 件数: ${data.debug.purchasesCount ?? data.purchases?.length ?? 0}`
          );
        }
      } catch (error) {
        console.error(error);
        const message = error instanceof Error ? error.message : String(error);

        if (shouldRetryLineLogin(message)) {
          retryLineLogin();
          return;
        }

        setErrorMessage(`購入希望情報の取得中にエラーが発生しました。${message ? ` ${message}` : ''}`);
      } finally {
        setIsLoading(false);
      }
    };

    fetchPurchases();
  }, []);

  return (
    <div className="mx-auto max-w-lg px-4 py-6">
      <header className="mb-6">
        <Link href="/dashboard" className="mb-3 inline-block text-sm text-teal-600">
          ダッシュボードへ戻る
        </Link>
        <h1 className="text-xl font-bold text-gray-900">購入希望</h1>
        <p className="text-sm text-gray-500">
          {patientName ? `${patientName}さんの購入希望商品` : '商品の購入希望・相談状況'}
        </p>
        {isLoading && <p className="mt-2 text-xs text-gray-400">{statusMessage}</p>}
        {errorMessage && <p className="mt-2 text-xs text-red-500">{errorMessage}</p>}
        {debugMessage && <p className="mt-2 text-[11px] text-gray-400">{debugMessage}</p>}
      </header>

      {!isLoading && !errorMessage && purchases.length === 0 && (
        <div className="rounded-lg border bg-white p-4 text-sm text-gray-500">
          購入希望の商品はまだありません。
        </div>
      )}

      {purchases.length > 0 && (
        <div className="space-y-3">
          {purchases.map((purchase) => (
            <PurchaseCard key={purchase.id} purchase={purchase} />
          ))}
        </div>
      )}

      <div className="mt-6 rounded-lg border bg-white p-4 text-sm text-gray-600">
        <div className="flex items-start gap-2">
          <Sparkles className="mt-0.5 h-4 w-4 text-teal-600" />
          <p>
            購入済み履歴ではなく、現在は院側へ購入希望として伝わっている商品を表示しています。
          </p>
        </div>
      </div>

      <Link href="/product-support" className="mt-4 block">
        <Button variant="outline" className="w-full">
          商品サポートを見る
          <ExternalLink className="ml-2 h-4 w-4" />
        </Button>
      </Link>
    </div>
  );
}
