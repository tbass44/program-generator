'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import liff from '@line/liff';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { SectionHeader } from '@/components/patient';
import { Calendar, Package, RotateCcw, CheckCircle2, Clock, ChevronRight } from 'lucide-react';

const NEXT_PATH_STORAGE_KEY = 'patientNextPath';

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
};

type RentalItem = {
  id: string;
  patient_id: string;
  program_id: string | null;
  product_id: string | null;
  category: string | null;
  reason: string | null;
  status: 'rental_requested' | 'renting' | 'rental_returned' | string;
  created_at: string;
  updated_at: string;
  product: Product | null;
  program: Program | null;
};

type PatientRentalsResponse = {
  patient?: {
    id: string;
    name: string;
  };
  rentals?: RentalItem[];
  debug?: {
    patientId?: string;
    patientName?: string;
    lineUserId?: string;
    rentalsCount?: number;
  };
  error?: string;
  detail?: unknown;
};

const statusLabels: Record<string, string> = {
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
    return '/rentals';
  }

  return `${window.location.pathname}${window.location.search}`;
}

function redirectToLineEntry() {
  window.sessionStorage.setItem(NEXT_PATH_STORAGE_KEY, getCurrentPath());
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
    case 'renting':
      return 'bg-teal-600';
    case 'rental_requested':
      return 'bg-amber-600';
    case 'rental_returned':
      return 'bg-gray-500';
    default:
      return 'bg-gray-500';
  }
}

function getStatusIcon(status: string) {
  switch (status) {
    case 'renting':
      return Package;
    case 'rental_requested':
      return Clock;
    case 'rental_returned':
      return CheckCircle2;
    default:
      return RotateCcw;
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

function RentalCard({ rental }: { rental: RentalItem }) {
  const Icon = getStatusIcon(rental.status);
  const productName = rental.product?.name ?? '商品名未設定';
  const category = rental.product?.category ?? rental.category;
  const reason = rental.reason || rental.product?.description || 'レンタル理由は未登録です。';

  return (
    <Link href={`/product-support/${rental.id}`} className="block">
      <Card className={rental.status === 'renting' ? 'border-teal-200 bg-teal-50/50' : 'border-gray-200'}>
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <div className="rounded-lg bg-gray-100 p-2">
              <Icon className="h-4 w-4 text-gray-600" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="mb-1 flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs text-gray-500">{getCategoryLabel(category)}</p>
                  <p className="font-medium text-gray-900">{productName}</p>
                </div>
                <Badge className={`${getStatusClassName(rental.status)} shrink-0 text-xs`}>
                  {getStatusLabel(rental.status)}
                </Badge>
              </div>

              <p className="mt-2 text-sm text-gray-600">{reason}</p>

              {rental.program && (
                <p className="mt-2 text-xs text-gray-500">
                  関連プログラム: {rental.program.summary || '改善プログラム'}
                </p>
              )}

              <div className="mt-3 flex items-center justify-between gap-3 text-xs text-gray-500">
                <span className="flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  更新日: {formatDate(rental.updated_at || rental.created_at)}
                </span>
                <span className="flex shrink-0 items-center gap-0.5 text-teal-600">
                  詳細
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

export default function RentalsPage() {
  const [patientName, setPatientName] = useState<string | null>(null);
  const [rentals, setRentals] = useState<RentalItem[]>([]);
  const [debugMessage, setDebugMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [statusMessage, setStatusMessage] = useState('LINE認証を確認しています...');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    const fetchRentals = async () => {
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

        setStatusMessage('レンタル履歴を取得しています...');

        const response = await fetch('/api/patient/rentals', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ idToken }),
          cache: 'no-store',
        });

        const data = (await response.json()) as PatientRentalsResponse;

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
            setErrorMessage(`レンタル履歴を取得できませんでした。${detail ? ` ${detail}` : ''}`);
          }

          if (data.debug) {
            setDebugMessage(
              `患者ID: ${data.debug.patientId ?? '-'} / 患者名: ${data.debug.patientName ?? '-'} / 件数: ${data.debug.rentalsCount ?? '-'}`
            );
          }

          return;
        }

        setPatientName(data.patient?.name ?? data.debug?.patientName ?? null);
        setRentals(data.rentals ?? []);
        setStatusMessage('レンタル履歴を取得しました。');

        if (data.debug) {
          setDebugMessage(
            `患者ID: ${data.debug.patientId ?? '-'} / 患者名: ${data.debug.patientName ?? '-'} / 件数: ${data.debug.rentalsCount ?? data.rentals?.length ?? 0}`
          );
        }
      } catch (error) {
        console.error(error);
        const message = error instanceof Error ? error.message : String(error);

        if (shouldRetryLineLogin(message)) {
          retryLineLogin();
          return;
        }

        setErrorMessage(`レンタル履歴の取得中にエラーが発生しました。${message ? ` ${message}` : ''}`);
      } finally {
        setIsLoading(false);
      }
    };

    fetchRentals();
  }, []);

  const rentingItems = useMemo(
    () => rentals.filter((rental) => rental.status === 'renting'),
    [rentals]
  );
  const requestedItems = useMemo(
    () => rentals.filter((rental) => rental.status === 'rental_requested'),
    [rentals]
  );
  const returnedItems = useMemo(
    () => rentals.filter((rental) => rental.status === 'rental_returned'),
    [rentals]
  );

  return (
    <div className="max-w-lg mx-auto px-4 py-6">
      <header className="mb-6">
        <Link href="/dashboard" className="mb-3 inline-block text-sm text-teal-600">
          ダッシュボードへ戻る
        </Link>
        <h1 className="text-xl font-bold text-gray-900">レンタル</h1>
        <p className="text-sm text-gray-500">
          {patientName ? `${patientName}さんのレンタル状況` : 'レンタル商品の状況'}
        </p>
        {isLoading && <p className="mt-2 text-xs text-gray-400">{statusMessage}</p>}
        {errorMessage && <p className="mt-2 text-xs text-red-500">{errorMessage}</p>}
        {debugMessage && <p className="mt-2 text-[11px] text-gray-400">{debugMessage}</p>}
      </header>

      {!isLoading && !errorMessage && rentals.length === 0 && (
        <div className="rounded-lg border bg-white p-4 text-sm text-gray-500">
          レンタル履歴はまだありません。
        </div>
      )}

      <div className="space-y-6">
        {rentingItems.length > 0 && (
          <section>
            <SectionHeader title="レンタル中" />
            <div className="space-y-3">
              {rentingItems.map((rental) => (
                <RentalCard key={rental.id} rental={rental} />
              ))}
            </div>
          </section>
        )}

        {requestedItems.length > 0 && (
          <section>
            <SectionHeader title="レンタル希望" />
            <div className="space-y-3">
              {requestedItems.map((rental) => (
                <RentalCard key={rental.id} rental={rental} />
              ))}
            </div>
          </section>
        )}

        {returnedItems.length > 0 && (
          <section>
            <SectionHeader title="レンタル終了" />
            <div className="space-y-3">
              {returnedItems.map((rental) => (
                <RentalCard key={rental.id} rental={rental} />
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
