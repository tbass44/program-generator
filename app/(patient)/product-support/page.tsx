'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import liff from '@line/liff';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { SectionHeader } from '@/components/patient';
import {
  Apple,
  ChevronRight,
  Dumbbell,
  Moon,
  ShoppingBag,
  Sparkles,
  Star,
} from 'lucide-react';

const NEXT_PATH_STORAGE_KEY = 'patientNextPath';

type Tab = 'recommended' | 'purchase_requested' | 'all';

type ProductSupportProduct = {
  id: string;
  name: string;
  category: string;
  description: string | null;
  price: number | null;
  inventory_count: number | null;
  product_url: string | null;
  status: string;
};

type ProductSupportProgram = {
  id: string;
  summary: string | null;
  created_at: string;
};

type ProductSupportItem = {
  id: string;
  patient_id: string;
  program_id: string | null;
  product_id: string | null;
  category: string | null;
  reason: string | null;
  status: string;
  created_at: string;
  updated_at: string;
  product: ProductSupportProduct | null;
  program: ProductSupportProgram | null;
};

type ProductSupportResponse = {
  patient?: {
    id: string;
    name: string;
  };
  productSupport?: ProductSupportItem[];
  debug?: {
    patientId?: string;
    patientName?: string;
    recommendationsCount?: number;
    recommendedCount?: number;
    purchaseRequestedCount?: number;
  };
  error?: string;
  detail?: unknown;
};

type CategoryKey = 'physical_sleep' | 'nutrition' | 'exercise' | 'skincare';

const categoryMeta: Record<
  CategoryKey,
  {
    label: string;
    icon: typeof Moon;
    iconClassName: string;
    iconWrapClassName: string;
  }
> = {
  physical_sleep: {
    label: '物理療法（睡眠）',
    icon: Moon,
    iconClassName: 'text-blue-700',
    iconWrapClassName: 'bg-blue-100',
  },
  nutrition: {
    label: '栄養療法',
    icon: Apple,
    iconClassName: 'text-green-700',
    iconWrapClassName: 'bg-green-100',
  },
  exercise: {
    label: '運動療法',
    icon: Dumbbell,
    iconClassName: 'text-amber-700',
    iconWrapClassName: 'bg-amber-100',
  },
  skincare: {
    label: 'スキンケア',
    icon: Sparkles,
    iconClassName: 'text-pink-700',
    iconWrapClassName: 'bg-pink-100',
  },
};

function getCurrentPath() {
  if (typeof window === 'undefined') {
    return '/product-support';
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

function getCategoryMeta(value: string | null | undefined) {
  if (value && value in categoryMeta) {
    return categoryMeta[value as CategoryKey];
  }

  return {
    label: '商品サポート',
    icon: Sparkles,
    iconClassName: 'text-gray-700',
    iconWrapClassName: 'bg-gray-100',
  };
}

function getStatusLabel(status: string) {
  const labels: Record<string, string> = {
    recommended: '提案中',
    purchase_requested: '購入希望',
  };

  return labels[status] ?? status;
}

function getStatusClassName(status: string) {
  switch (status) {
    case 'purchase_requested':
      return 'bg-teal-600';
    case 'recommended':
      return 'bg-amber-600';
    default:
      return 'bg-gray-500';
  }
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
    return '価格未設定';
  }

  return `${value.toLocaleString('ja-JP')}円`;
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

function ProductSupportCard({ item }: { item: ProductSupportItem }) {
  const category = item.product?.category ?? item.category;
  const meta = getCategoryMeta(category);
  const Icon = meta.icon;
  const productName = item.product?.name ?? '商品名未設定';
  const reason = item.reason || item.product?.description || '提案理由は未登録です。';

  return (
    <Link href={`/product-support/${item.id}`} className="block">
      <Card className="border-gray-200 hover:shadow-sm transition-shadow">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <div className={`rounded-lg p-2 ${meta.iconWrapClassName}`}>
              <Icon className={`h-4 w-4 ${meta.iconClassName}`} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="mb-1 flex items-start justify-between gap-3">
                <p className="text-xs text-gray-500">{meta.label}</p>
                <Badge className={`text-xs ${getStatusClassName(item.status)}`}>
                  {getStatusLabel(item.status)}
                </Badge>
              </div>
              <p className="font-medium text-gray-900">{productName}</p>
              <p className="mt-1 text-xs text-gray-600">{reason}</p>

              {item.program?.summary && (
                <p className="mt-2 rounded-md bg-gray-50 px-2 py-1 text-xs text-gray-500">
                  関連プログラム: {item.program.summary}
                </p>
              )}

              <div className="mt-3 flex items-center justify-between gap-3 text-xs text-gray-500">
                <span>{formatDate(item.updated_at)}</span>
                <span className="font-medium text-gray-700">
                  {formatPrice(item.product?.price)}
                </span>
              </div>

              <div className="mt-3 flex justify-end text-xs font-medium text-teal-600">
                <span className="inline-flex items-center gap-0.5">
                  詳細を見る
                  <ChevronRight className="h-3 w-3" />
                </span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

export default function ProductSupportPage() {
  const [activeTab, setActiveTab] = useState<Tab>('recommended');
  const [patientName, setPatientName] = useState<string | null>(null);
  const [items, setItems] = useState<ProductSupportItem[]>([]);
  const [debugMessage, setDebugMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [statusMessage, setStatusMessage] = useState('LINE認証を確認しています...');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const recommendedItems = useMemo(
    () => items.filter((item) => item.status === 'recommended'),
    [items]
  );
  const purchaseRequestedItems = useMemo(
    () => items.filter((item) => item.status === 'purchase_requested'),
    [items]
  );

  const visibleItems = useMemo(() => {
    if (activeTab === 'recommended') {
      return recommendedItems;
    }

    if (activeTab === 'purchase_requested') {
      return purchaseRequestedItems;
    }

    return items;
  }, [activeTab, items, purchaseRequestedItems, recommendedItems]);

  const tabs: { key: Tab; label: string; icon: typeof ShoppingBag; count: number }[] = [
    { key: 'recommended', label: '提案中', icon: Star, count: recommendedItems.length },
    {
      key: 'purchase_requested',
      label: '購入希望',
      icon: ShoppingBag,
      count: purchaseRequestedItems.length,
    },
    { key: 'all', label: 'すべて', icon: Sparkles, count: items.length },
  ];

  useEffect(() => {
    const fetchProductSupport = async () => {
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

        setStatusMessage('商品サポート情報を取得しています...');

        const response = await fetch('/api/patient/product-support', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ idToken }),
          cache: 'no-store',
        });

        const data = (await response.json()) as ProductSupportResponse;

        if (!response.ok) {
          const detail = formatDetail(data.detail);

          if (shouldRetryLineLogin(`${data.error ?? ''} ${detail}`)) {
            retryLineLogin();
            return;
          }

          if (data.error === 'Patient not linked') {
            setErrorMessage('このLINEアカウントはまだ患者データと連携されていません。');
          } else {
            setErrorMessage(
              `商品サポート情報を取得できませんでした。${detail ? ` ${detail}` : ''}`
            );
          }

          if (data.debug) {
            setDebugMessage(
              `患者ID: ${data.debug.patientId ?? '-'} / 患者名: ${data.debug.patientName ?? '-'} / 件数: ${data.debug.recommendationsCount ?? '-'}`
            );
          }

          return;
        }

        setPatientName(data.patient?.name ?? data.debug?.patientName ?? null);
        setItems(data.productSupport ?? []);
        setStatusMessage('商品サポート情報を取得しました。');

        if (data.debug) {
          setDebugMessage(
            `患者ID: ${data.debug.patientId ?? '-'} / 患者名: ${data.debug.patientName ?? '-'} / 提案中: ${data.debug.recommendedCount ?? 0} / 購入希望: ${data.debug.purchaseRequestedCount ?? 0} / 合計: ${data.debug.recommendationsCount ?? 0}`
          );
        }
      } catch (error) {
        console.error(error);
        const message = error instanceof Error ? error.message : String(error);

        if (shouldRetryLineLogin(message)) {
          retryLineLogin();
          return;
        }

        setErrorMessage(
          `商品サポート情報の取得中にエラーが発生しました。${message ? ` ${message}` : ''}`
        );
      } finally {
        setIsLoading(false);
      }
    };

    fetchProductSupport();
  }, []);

  return (
    <div className="mx-auto max-w-lg px-4 py-6">
      <header className="mb-6">
        <Link href="/dashboard" className="mb-3 inline-block text-sm text-teal-600">
          ダッシュボードへ戻る
        </Link>
        <h1 className="text-xl font-bold text-gray-900">商品サポート</h1>
        <p className="text-sm text-gray-500">
          {patientName ? `${patientName}さんへの商品提案` : 'あなたに合った商品とサポート'}
        </p>
        {isLoading && <p className="mt-2 text-xs text-gray-400">{statusMessage}</p>}
        {errorMessage && <p className="mt-2 text-xs text-red-500">{errorMessage}</p>}
        {debugMessage && <p className="mt-2 text-[11px] text-gray-400">{debugMessage}</p>}
      </header>

      <div className="mb-6 flex gap-2">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
              activeTab === tab.key ? 'bg-teal-600 text-white' : 'bg-gray-100 text-gray-600'
            }`}
          >
            <tab.icon className="h-4 w-4" />
            {tab.label}
            <span className="text-xs opacity-80">{tab.count}</span>
          </button>
        ))}
      </div>

      {!isLoading && !errorMessage && items.length === 0 && (
        <div className="rounded-lg border bg-white p-4 text-sm text-gray-500">
          現在表示できる商品提案はありません。
        </div>
      )}

      {!isLoading && !errorMessage && items.length > 0 && visibleItems.length === 0 && (
        <div className="rounded-lg border bg-white p-4 text-sm text-gray-500">
          この分類の商品提案はまだありません。
        </div>
      )}

      {visibleItems.length > 0 && (
        <div className="space-y-3">
          <SectionHeader
            title={
              activeTab === 'recommended'
                ? '提案中の商品'
                : activeTab === 'purchase_requested'
                  ? '購入希望の商品'
                  : 'すべての商品提案'
            }
          />
          {visibleItems.map((item) => (
            <ProductSupportCard key={item.id} item={item} />
          ))}
        </div>
      )}
    </div>
  );
}
