'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import liff from '@line/liff';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Calendar, ChevronRight, ExternalLink, ReceiptText, ShoppingBag, Sparkles } from 'lucide-react';

const NEXT_PATH_STORAGE_KEY = 'patientNextPath';

type Product = {
  id: string;
  name: string;
  category: string;
  description: string | null;
  price: number | null;
  inventory_count?: number | null;
  product_url: string | null;
  status?: string;
};

type Program = {
  id: string;
  summary: string | null;
  created_at?: string;
};

type PurchaseRequestItem = {
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

type PurchaseHistoryItem = {
  id: string;
  patient_id: string;
  product_id: string | null;
  recommendation_id: string | null;
  program_id: string | null;
  purchased_at: string;
  quantity: number;
  unit_price: number | null;
  total_price: number | null;
  note: string | null;
  created_at: string;
  updated_at: string;
  product: Product | null;
  program: Program | null;
  recommendation: PurchaseRequestItem | null;
};

type PatientPurchasesResponse = {
  patient?: {
    id: string;
    name: string;
  };
  purchaseRequests?: PurchaseRequestItem[];
  purchaseHistory?: PurchaseHistoryItem[];
  debug?: {
    patientId?: string;
    patientName?: string;
    lineUserId?: string;
    purchaseRequestsCount?: number;
    purchaseHistoryCount?: number;
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

function PurchaseRequestCard({ item }: { item: PurchaseRequestItem }) {
  const productName = item.product?.name ?? '商品名未設定';
  const category = item.product?.category ?? item.category;
  const reason = item.reason || item.product?.description || '購入希望理由は未登録です。';

  return (
    <Link href={`/product-support/${item.id}`} className="block">
      <Card className="border-amber-200 bg-amber-50/40 transition-shadow hover:shadow-md">
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

              {item.program?.summary && (
                <p className="mt-2 rounded-md bg-white/70 px-2 py-1 text-xs text-gray-500">
                  関連プログラム: {item.program.summary}
                </p>
              )}

              <div className="mt-3 flex items-center justify-between gap-3 text-xs text-gray-500">
                <span className="flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  {formatDate(item.updated_at || item.created_at)}
                </span>
                <span className="font-medium text-gray-700">
                  {formatPrice(item.product?.price)}
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

function PurchaseHistoryCard({ item }: { item: PurchaseHistoryItem }) {
  const productName = item.product?.name ?? '商品名未設定';
  const category = item.product?.category ?? item.recommendation?.category;
  const detailHref = item.recommendation_id ? `/product-support/${item.recommendation_id}` : null;

  const card = (
    <Card className="border-teal-200 bg-teal-50/40 transition-shadow hover:shadow-md">
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <div className="rounded-lg bg-teal-100 p-2">
            <ReceiptText className="h-4 w-4 text-teal-700" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="mb-1 flex items-start justify-between gap-3">
              <div>
                <p className="text-xs text-gray-500">{getCategoryLabel(category)}</p>
                <p className="font-medium text-gray-900">{productName}</p>
              </div>
              <Badge className="shrink-0 bg-teal-600 text-xs">購入済み</Badge>
            </div>

            <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
              <div className="rounded-md bg-white/70 px-2 py-2">
                <p className="text-xs text-gray-500">購入日</p>
                <p className="font-medium text-gray-900">{formatDate(item.purchased_at)}</p>
              </div>
              <div className="rounded-md bg-white/70 px-2 py-2">
                <p className="text-xs text-gray-500">数量</p>
                <p className="font-medium text-gray-900">{item.quantity}</p>
              </div>
              <div className="rounded-md bg-white/70 px-2 py-2">
                <p className="text-xs text-gray-500">単価</p>
                <p className="font-medium text-gray-900">{formatPrice(item.unit_price)}</p>
              </div>
              <div className="rounded-md bg-white/70 px-2 py-2">
                <p className="text-xs text-gray-500">合計</p>
                <p className="font-medium text-gray-900">{formatPrice(item.total_price)}</p>
              </div>
            </div>

            {item.note && (
              <p className="mt-3 whitespace-pre-wrap text-sm text-gray-600">{item.note}</p>
            )}

            {item.program?.summary && (
              <p className="mt-2 rounded-md bg-white/70 px-2 py-1 text-xs text-gray-500">
                関連プログラム: {item.program.summary}
              </p>
            )}

            {detailHref && (
              <div className="mt-3 flex items-center justify-end text-xs font-medium text-teal-600">
                提案詳細を見る
                <ChevronRight className="h-3 w-3" />
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );

  if (!detailHref) {
    return card;
  }

  return (
    <Link href={detailHref} className="block">
      {card}
    </Link>
  );
}

export default function PurchasesPage() {
  const [patientName, setPatientName] = useState<string | null>(null);
  const [purchaseRequests, setPurchaseRequests] = useState<PurchaseRequestItem[]>([]);
  const [purchaseHistory, setPurchaseHistory] = useState<PurchaseHistoryItem[]>([]);
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

        setStatusMessage('購入情報を取得しています...');

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
            setErrorMessage(`購入情報を取得できませんでした。${detail ? ` ${detail}` : ''}`);
          }

          if (data.debug) {
            setDebugMessage(
              `患者ID: ${data.debug.patientId ?? '-'} / 患者名: ${data.debug.patientName ?? '-'} / 購入希望: ${data.debug.purchaseRequestsCount ?? '-'} / 購入履歴: ${data.debug.purchaseHistoryCount ?? '-'}`
            );
          }

          return;
        }

        setPatientName(data.patient?.name ?? data.debug?.patientName ?? null);
        setPurchaseRequests(data.purchaseRequests ?? []);
        setPurchaseHistory(data.purchaseHistory ?? []);
        setStatusMessage('購入情報を取得しました。');

        if (data.debug) {
          setDebugMessage(
            `患者ID: ${data.debug.patientId ?? '-'} / 患者名: ${data.debug.patientName ?? '-'} / 購入希望: ${data.debug.purchaseRequestsCount ?? data.purchaseRequests?.length ?? 0} / 購入履歴: ${data.debug.purchaseHistoryCount ?? data.purchaseHistory?.length ?? 0}`
          );
        }
      } catch (error) {
        console.error(error);
        const message = error instanceof Error ? error.message : String(error);

        if (shouldRetryLineLogin(message)) {
          retryLineLogin();
          return;
        }

        setErrorMessage(`購入情報の取得中にエラーが発生しました。${message ? ` ${message}` : ''}`);
      } finally {
        setIsLoading(false);
      }
    };

    fetchPurchases();
  }, []);

  const hasNoPurchaseData = purchaseRequests.length === 0 && purchaseHistory.length === 0;

  return (
    <div className="mx-auto max-w-lg px-4 py-6">
      <header className="mb-6">
        <Link href="/dashboard" className="mb-3 inline-block text-sm text-teal-600">
          ダッシュボードへ戻る
        </Link>
        <h1 className="text-xl font-bold text-gray-900">購入</h1>
        <p className="text-sm text-gray-500">
          {patientName ? `${patientName}さんの購入希望・購入履歴` : '商品の購入希望・購入履歴'}
        </p>
        {isLoading && <p className="mt-2 text-xs text-gray-400">{statusMessage}</p>}
        {errorMessage && <p className="mt-2 text-xs text-red-500">{errorMessage}</p>}
        {debugMessage && <p className="mt-2 text-[11px] text-gray-400">{debugMessage}</p>}
      </header>

      {!isLoading && !errorMessage && hasNoPurchaseData && (
        <div className="rounded-lg border bg-white p-4 text-sm text-gray-500">
          購入希望・購入履歴はまだありません。
        </div>
      )}

      {purchaseRequests.length > 0 && (
        <section className="mb-6">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-semibold text-gray-900">購入希望</h2>
            <Badge variant="secondary">{purchaseRequests.length}件</Badge>
          </div>
          <div className="space-y-3">
            {purchaseRequests.map((item) => (
              <PurchaseRequestCard key={item.id} item={item} />
            ))}
          </div>
        </section>
      )}

      {purchaseHistory.length > 0 && (
        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-semibold text-gray-900">購入履歴</h2>
            <Badge variant="secondary">{purchaseHistory.length}件</Badge>
          </div>
          <div className="space-y-3">
            {purchaseHistory.map((item) => (
              <PurchaseHistoryCard key={item.id} item={item} />
            ))}
          </div>
        </section>
      )}

      <div className="mt-6 rounded-lg border bg-white p-4 text-sm text-gray-600">
        <div className="flex items-start gap-2">
          <Sparkles className="mt-0.5 h-4 w-4 text-teal-600" />
          <p>
            購入履歴は、院側で購入記録を追加したものが表示されます。サプリなどは複数回購入として記録できます。
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
