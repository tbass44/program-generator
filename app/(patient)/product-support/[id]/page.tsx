'use client';

import { use, useEffect, useState } from 'react';
import Link from 'next/link';
import liff from '@line/liff';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Calendar, ChevronLeft, ExternalLink, Package, ScrollText } from 'lucide-react';

type Product = {
  id: string;
  name: string;
  category: string;
  description: string | null;
  price: number | null;
  product_url: string | null;
};

type Program = {
  id: string;
  summary: string | null;
  short_term_program: string | null;
  long_term_program: string | null;
  created_at: string;
};

type ProductSupportDetailItem = {
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

type ProductSupportDetailResponse = {
  patient?: {
    id: string;
    name: string;
  };
  item?: ProductSupportDetailItem;
  debug?: {
    patientId?: string;
    patientName?: string;
    recommendationId?: string;
  };
  error?: string;
  detail?: unknown;
};

type ProductSupportDetailPageProps = {
  params: Promise<{
    id: string;
  }>;
};

const statusLabels: Record<string, string> = {
  recommended: '提案中',
  purchase_requested: '購入希望',
  rental_requested: 'レンタル希望',
  renting: 'レンタル中',
  rental_returned: 'レンタル終了',
};

const categoryLabels: Record<string, string> = {
  physical_sleep: '物理療法（睡眠）',
  nutrition: '栄養療法',
  exercise: '運動療法',
  skincare: 'スキンケア',
};

function getCurrentPath() {
  if (typeof window === 'undefined') {
    return '/product-support';
  }

  return `${window.location.pathname}${window.location.search}`;
}

function redirectToLineEntry() {
  try {
    window.sessionStorage.setItem('patientNextPath', getCurrentPath());
  } catch (error) {
    console.error(error);
  }

  window.location.href = '/line';
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

function shouldRetryLineLogin(message: string) {
  const lower = message.toLowerCase();

  return (
    lower.includes('access token revoked') ||
    lower.includes('failed to verify line id token') ||
    lower.includes('invalid token') ||
    lower.includes('expired')
  );
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
  if (value === null || value === undefined) {
    return '金額未設定';
  }

  return `${value.toLocaleString('ja-JP')}円`;
}

function getStatusLabel(status: string) {
  return statusLabels[status] ?? status;
}

function getCategoryLabel(value: string | null | undefined) {
  if (!value) {
    return 'カテゴリ未設定';
  }

  return categoryLabels[value] ?? value;
}

function getStatusClassName(status: string) {
  switch (status) {
    case 'recommended':
      return 'bg-teal-600';
    case 'purchase_requested':
      return 'bg-amber-600';
    case 'rental_requested':
      return 'bg-amber-600';
    case 'renting':
      return 'bg-teal-600';
    case 'rental_returned':
      return 'bg-gray-500';
    default:
      return 'bg-gray-500';
  }
}

export default function ProductSupportDetailPage({
  params,
}: ProductSupportDetailPageProps) {
  const { id } = use(params);
  const [patientName, setPatientName] = useState<string | null>(null);
  const [item, setItem] = useState<ProductSupportDetailItem | null>(null);
  const [debugMessage, setDebugMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [statusMessage, setStatusMessage] = useState('LINE認証を確認しています...');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    const fetchDetail = async () => {
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

        setStatusMessage('商品詳細を取得しています...');

        const response = await fetch(`/api/patient/product-support/${id}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ idToken }),
          cache: 'no-store',
        });

        const data = (await response.json()) as ProductSupportDetailResponse;

        if (!response.ok || !data.item) {
          console.error(data);
          const detail = formatDetail(data.detail);

          if (shouldRetryLineLogin(`${data.error ?? ''} ${detail}`)) {
            retryLineLogin();
            return;
          }

          if (data.error === 'Patient not linked') {
            setErrorMessage('このLINEアカウントはまだ患者データと連携されていません。');
          } else if (data.error === 'Product support detail not found') {
            setErrorMessage('指定された商品詳細が見つかりませんでした。');
          } else {
            setErrorMessage(`商品詳細を取得できませんでした。${detail ? ` ${detail}` : ''}`);
          }

          if (data.debug) {
            setDebugMessage(
              `患者ID: ${data.debug.patientId ?? '-'} / 患者名: ${data.debug.patientName ?? '-'} / 提案ID: ${data.debug.recommendationId ?? '-'}`
            );
          }

          return;
        }

        setPatientName(data.patient?.name ?? data.debug?.patientName ?? null);
        setItem(data.item);
        setStatusMessage('商品詳細を取得しました。');

        if (data.debug) {
          setDebugMessage(
            `患者ID: ${data.debug.patientId ?? '-'} / 患者名: ${data.debug.patientName ?? '-'} / 提案ID: ${data.debug.recommendationId ?? '-'}`
          );
        }
      } catch (error) {
        console.error(error);
        const message = error instanceof Error ? error.message : String(error);

        if (shouldRetryLineLogin(message)) {
          retryLineLogin();
          return;
        }

        setErrorMessage(`商品詳細の取得中にエラーが発生しました。${message ? ` ${message}` : ''}`);
      } finally {
        setIsLoading(false);
      }
    };

    fetchDetail();
  }, [id]);

  const product = item?.product ?? null;
  const category = product?.category ?? item?.category ?? null;
  const productName = product?.name ?? '商品名未設定';

  return (
    <div className="max-w-lg mx-auto px-4 py-6">
      <header className="mb-6">
        <Link href="/product-support" className="mb-3 inline-flex items-center gap-1 text-sm text-teal-600">
          <ChevronLeft className="h-4 w-4" />
          商品サポートへ戻る
        </Link>
        <h1 className="text-xl font-bold text-gray-900">商品詳細</h1>
        <p className="text-sm text-gray-500">
          {patientName ? `${patientName}さんへの提案内容` : '提案商品の詳細'}
        </p>
        {isLoading && <p className="mt-2 text-xs text-gray-400">{statusMessage}</p>}
        {errorMessage && <p className="mt-2 text-xs text-red-500">{errorMessage}</p>}
        {debugMessage && <p className="mt-2 text-[11px] text-gray-400">{debugMessage}</p>}
      </header>

      {!isLoading && !errorMessage && item && (
        <div className="space-y-4">
          <Card className="border-teal-200 bg-teal-50/50">
            <CardContent className="p-4">
              <div className="mb-3 flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs text-gray-500">{getCategoryLabel(category)}</p>
                  <h2 className="mt-1 text-lg font-bold text-gray-900">{productName}</h2>
                </div>
                <Badge className={`${getStatusClassName(item.status)} shrink-0 text-xs`}>
                  {getStatusLabel(item.status)}
                </Badge>
              </div>

              <p className="text-sm text-gray-600">
                {item.reason || product?.description || '提案理由は未登録です。'}
              </p>

              <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                <div className="rounded-lg bg-white p-3">
                  <p className="text-xs text-gray-500">金額</p>
                  <p className="mt-1 font-medium text-gray-900">{formatPrice(product?.price)}</p>
                </div>
                <div className="rounded-lg bg-white p-3">
                  <p className="text-xs text-gray-500">更新日</p>
                  <p className="mt-1 font-medium text-gray-900">{formatDate(item.updated_at || item.created_at)}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="mb-3 flex items-center gap-2">
                <Package className="h-4 w-4 text-gray-600" />
                <h3 className="font-semibold text-gray-900">商品説明</h3>
              </div>
              <p className="whitespace-pre-wrap text-sm leading-6 text-gray-600">
                {product?.description || '商品説明は未登録です。'}
              </p>

              {product?.product_url && (
                <a
                  href={product.product_url}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-4 block"
                >
                  <Button variant="outline" className="w-full">
                    商品ページを見る
                    <ExternalLink className="ml-2 h-4 w-4" />
                  </Button>
                </a>
              )}
            </CardContent>
          </Card>

          {item.program && (
            <Card>
              <CardContent className="p-4">
                <div className="mb-3 flex items-center gap-2">
                  <ScrollText className="h-4 w-4 text-gray-600" />
                  <h3 className="font-semibold text-gray-900">関連プログラム</h3>
                </div>
                <p className="text-sm font-medium text-gray-900">
                  {item.program.summary || '改善プログラム'}
                </p>
                {item.program.short_term_program && (
                  <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-gray-600">
                    {item.program.short_term_program}
                  </p>
                )}
                <Link
                  href={`/programs/${item.program.id}`}
                  className="mt-4 inline-flex items-center text-sm text-teal-600"
                >
                  関連プログラムを見る
                </Link>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardContent className="p-4 text-sm text-gray-600">
              <div className="flex items-center gap-2 text-gray-700">
                <Calendar className="h-4 w-4" />
                <span>提案日: {formatDate(item.created_at)}</span>
              </div>
              <div className="mt-2 flex items-center gap-2 text-gray-700">
                <Calendar className="h-4 w-4" />
                <span>更新日: {formatDate(item.updated_at)}</span>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
