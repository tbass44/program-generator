'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import liff from '@line/liff';
import { redirectToLineEntry, retryLineLogin } from '@/lib/patient-line-navigation';
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
  pdf_url: string | null;
  thumbnail_url: string | null;
};

type Program = {
  id: string;
  summary: string | null;
  short_term_program: string | null;
  long_term_program: string | null;
  created_at: string;
};

type PdfDocument = {
  id: string;
  title: string;
  pdf_url: string;
  created_at: string;
};

type ProductSupportDetailItem = {
  id: string;
  patient_id: string;
  program_id: string | null;
  product_id: string | null;
  category: string | null;
  reason: string | null;
  usage_guidance: string | null;
  status: string;
  purchase_request_reviewed_at: string | null;
  created_at: string;
  updated_at: string;
  product: Product | null;
  pdfDocuments: PdfDocument[];
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

function getParamId(id: string | string[] | undefined) {
  if (Array.isArray(id)) {
    return id[0] ?? '';
  }

  return id ?? '';
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

export default function ProductSupportDetailPage() {
  const params = useParams();
  const id = getParamId(params.id);
  const [patientName, setPatientName] = useState<string | null>(null);
  const [item, setItem] = useState<ProductSupportDetailItem | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activePdfId, setActivePdfId] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState('LINE認証を確認しています...');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isRequestingPurchase, setIsRequestingPurchase] = useState(false);
  const [purchaseError, setPurchaseError] = useState<string | null>(null);

  useEffect(() => {
    const fetchDetail = async () => {
      try {
        setIsLoading(true);
        setErrorMessage(null);
        setStatusMessage('LINE認証を確認しています...');

        const liffId = process.env.NEXT_PUBLIC_LIFF_ID;

        if (!liffId) {
          setErrorMessage('NEXT_PUBLIC_LIFF_ID が設定されていません。');
          return;
        }

        if (!id) {
          setErrorMessage('商品提案IDを確認できませんでした。');
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

          return;
        }

        setPatientName(data.patient?.name ?? data.debug?.patientName ?? null);
        setItem(data.item);
        setActivePdfId(data.item.pdfDocuments?.[0]?.id ?? null);
        setStatusMessage('商品詳細を取得しました。');
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

  const handlePurchaseRequest = async () => {
    if (!item || item.status !== 'recommended' || isRequestingPurchase) return;
    if (!window.confirm('この商品の購入を希望しますか？\n※この操作で決済や購入確定は行われません。')) return;

    try {
      setIsRequestingPurchase(true);
      setPurchaseError(null);
      const idToken = liff.getIDToken();
      if (!idToken) {
        retryLineLogin();
        return;
      }
      const response = await fetch(`/api/patient/product-support/${item.id}/purchase-request`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken }),
      });
      const data = (await response.json()) as {
        requested?: boolean;
        item?: { status: string; updated_at: string };
        error?: string;
      };
      if (!response.ok || !data.requested || !data.item) {
        setPurchaseError('購入希望を送信できませんでした。時間をおいてもう一度お試しください。');
        return;
      }
      setItem((previous) => previous ? {
        ...previous,
        status: data.item?.status ?? 'purchase_requested',
        purchase_request_reviewed_at: null,
        updated_at: data.item?.updated_at ?? previous.updated_at,
      } : previous);
    } catch (error) {
      console.error(error);
      setPurchaseError('通信エラーが発生しました。通信状態を確認して再度お試しください。');
    } finally {
      setIsRequestingPurchase(false);
    }
  };

  const handleCancelPurchaseRequest = async () => {
    if (!item || item.status !== 'purchase_requested' || isRequestingPurchase) return;
    if (!window.confirm('この商品の購入希望を取り消しますか？')) return;

    try {
      setIsRequestingPurchase(true);
      setPurchaseError(null);
      const idToken = liff.getIDToken();
      if (!idToken) {
        retryLineLogin();
        return;
      }
      const response = await fetch(`/api/patient/product-support/${item.id}/purchase-request/cancel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken }),
        cache: 'no-store',
      });
      const data = (await response.json()) as {
        cancelled?: boolean;
        item?: { status: string; updated_at: string };
        error?: string;
      };
      if (!response.ok || !data.cancelled || !data.item) {
        setPurchaseError(response.status === 409
          ? '現在の状態では取り消せません。院へお問い合わせください。'
          : '購入希望を取り消せませんでした。もう一度お試しください。');
        return;
      }
      setItem((previous) => previous ? {
        ...previous,
        status: data.item?.status ?? 'recommended',
        purchase_request_reviewed_at: null,
        updated_at: data.item?.updated_at ?? previous.updated_at,
      } : previous);
    } catch (error) {
      console.error(error);
      setPurchaseError('通信エラーが発生しました。通信状態を確認して再度お試しください。');
    } finally {
      setIsRequestingPurchase(false);
    }
  };

  const product = item?.product ?? null;
  const category = product?.category ?? item?.category ?? null;
  const productName = product?.name ?? '商品名未設定';
  const pdfDocuments = item?.pdfDocuments ?? [];
  const selectedPdf = pdfDocuments.find((document) => document.id === activePdfId) ?? pdfDocuments[0];

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

              {product?.id && (
                <div className="mb-4 flex justify-center rounded-lg border bg-white p-3">
                  <img
                    src={product.thumbnail_url && /^https:\/\//i.test(product.thumbnail_url)
                      ? product.thumbnail_url
                      : `/product-thumbnails/${product.id}.webp`}
                    alt={productName}
                    loading="lazy"
                    className="max-h-56 w-auto max-w-full object-contain"
                    onError={(event) => { event.currentTarget.style.display = 'none'; }}
                  />
                </div>
              )}

              <p className="text-sm text-gray-600">
                {item.reason || product?.description || '提案理由は未登録です。'}
              </p>

              {item.usage_guidance && (
                <p className="mt-3 rounded-md border border-teal-200 bg-white p-3 text-sm text-teal-800">
                  数量・期間の目安：{item.usage_guidance}
                </p>
              )}

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

          {item.status === 'recommended' && (
            <Card>
              <CardContent className="space-y-3 p-4">
                <h3 className="font-semibold text-gray-900">商品の購入について</h3>
                <p className="text-sm text-gray-600">
                  購入をご希望の場合は、こちらからお知らせください。これは購入希望の連絡であり、
                  決済や注文確定ではありません。商品の数量や受け渡しは当院から別途ご案内します。
                </p>
                <Button className="w-full" onClick={handlePurchaseRequest} disabled={isRequestingPurchase || !product}>
                  {isRequestingPurchase ? '送信中...' : 'この商品の購入を希望する'}
                </Button>
                {purchaseError && <p role="alert" className="text-sm text-red-600">{purchaseError}</p>}
              </CardContent>
            </Card>
          )}
          {item.status === 'purchase_requested' && (
            <Card className="border-teal-200 bg-teal-50">
              <CardContent className="p-4">
                <p className="font-semibold text-teal-800">購入希望を受け付けました</p>
                <p className="mt-1 text-sm text-teal-800">
                  これは注文確定ではありません。数量や受け渡しについては当院からのご案内をご確認ください。
                </p>
                {item.purchase_request_reviewed_at ? (
                  <p className="mt-2 text-sm font-medium text-teal-800">
                    院で購入希望を確認しました（{formatDate(item.purchase_request_reviewed_at)}）。
                    注文確定や商品の確保を意味するものではありません。
                  </p>
                ) : (
                  <p className="mt-2 text-sm text-teal-800">現在、院での確認待ちです。</p>
                )}
                <Button type="button" variant="outline" className="mt-3 w-full"
                  disabled={isRequestingPurchase} onClick={handleCancelPurchaseRequest}>
                  {isRequestingPurchase ? '取り消し中...' : '購入希望を取り消す'}
                </Button>
                {purchaseError && <p role="alert" className="mt-2 text-sm text-red-600">{purchaseError}</p>}
              </CardContent>
            </Card>
          )}

          <Card>
            <CardContent className="p-4">
              <div className="mb-3 flex items-center gap-2">
                <Package className="h-4 w-4 text-gray-600" />
                <h3 className="font-semibold text-gray-900">商品説明</h3>
              </div>
              <p className="whitespace-pre-wrap text-sm leading-6 text-gray-600">
                {product?.description || '商品説明は未登録です。'}
              </p>

              {selectedPdf && (
                <div className="mt-4 space-y-3">
                  <div className="flex items-center gap-2">
                    <ScrollText className="h-4 w-4 text-gray-600" />
                    <h4 className="text-sm font-semibold text-gray-900">
                      商品資料（{pdfDocuments.length}件）
                    </h4>
                  </div>
                  {pdfDocuments.length > 1 && (
                    <div className="flex flex-wrap gap-2" aria-label="表示するPDF資料を選択">
                      {pdfDocuments.map((document) => (
                        <button
                          key={document.id}
                          type="button"
                          onClick={() => setActivePdfId(document.id)}
                          aria-pressed={selectedPdf.id === document.id}
                          className={`rounded-md border px-3 py-2 text-sm ${selectedPdf.id === document.id
                            ? 'border-teal-600 bg-teal-50 font-semibold text-teal-700'
                            : 'bg-white text-gray-700'}`}
                        >
                          {document.title}
                        </button>
                      ))}
                    </div>
                  )}
                  <p className="text-sm font-medium text-gray-900">{selectedPdf.title}</p>
                  <div className="overflow-hidden rounded-lg border bg-gray-50">
                    <iframe
                      key={selectedPdf.id}
                      src={selectedPdf.pdf_url}
                      title={`${productName} - ${selectedPdf.title}（PDFプレビュー）`}
                      className="block h-[340px] w-full sm:h-[460px]"
                      loading="lazy"
                    />
                  </div>
                  <p className="text-xs text-gray-500">
                    資料が表示されない場合は下のボタンから開いてください。
                  </p>
                  <a href={selectedPdf.pdf_url} target="_blank" rel="noopener noreferrer" className="block">
                    <Button variant="outline" className="w-full">
                      PDFを大きく表示する
                      <ExternalLink className="ml-2 h-4 w-4" />
                    </Button>
                  </a>
                </div>
              )}

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
