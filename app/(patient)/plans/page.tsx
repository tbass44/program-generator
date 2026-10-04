'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import liff from '@line/liff';
import { PlanStatusCard } from '@/components/patient';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

type TicketUsage = {
  id: string;
  plan_id: string;
  used_at: string;
  note: string | null;
  created_at: string;
};

type PatientPlan = {
  id: string;
  patient_id: string;
  type: 'ticket' | 'subscription';
  name: string;
  total_count: number | null;
  remaining_count: number | null;
  start_date: string | null;
  end_date: string | null;
  status: 'active' | 'expired' | 'cancelled';
  created_at: string;
  updated_at: string | null;
  usages: TicketUsage[];
};

type PatientPlansResponse = {
  patient?: {
    id: string;
    name: string;
  };
  plans?: PatientPlan[];
  error?: string;
  detail?: unknown;
};

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

function getStatusLabel(status: PatientPlan['status']) {
  const labels: Record<PatientPlan['status'], string> = {
    active: '有効',
    expired: '期限切れ',
    cancelled: '停止',
  };

  return labels[status];
}

function getStatusClassName(status: PatientPlan['status']) {
  switch (status) {
    case 'active':
      return 'bg-teal-600';
    case 'expired':
      return 'bg-gray-500';
    case 'cancelled':
      return 'bg-red-500';
    default:
      return 'bg-gray-500';
  }
}

function getUsedCount(plan: PatientPlan) {
  if (plan.type !== 'ticket') {
    return 0;
  }

  const total = plan.total_count ?? 0;
  const remaining = plan.remaining_count ?? 0;

  return Math.max(0, total - remaining);
}

function getSubscriptionRemainingDays(endDate: string | null) {
  if (!endDate) {
    return 0;
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const end = new Date(endDate);
  end.setHours(0, 0, 0, 0);

  const diff = end.getTime() - today.getTime();

  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
}

export default function PlansPage() {
  const [plans, setPlans] = useState<PatientPlan[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [statusMessage, setStatusMessage] = useState('LINE認証を確認しています...');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    const fetchPlans = async () => {
      try {
        setIsLoading(true);
        setErrorMessage(null);
        setStatusMessage('LINE認証を確認しています...');

        const liffId = process.env.NEXT_PUBLIC_LIFF_ID;

        if (!liffId) {
          setErrorMessage('NEXT_PUBLIC_LIFF_ID が設定されていません。');
          return;
        }

        await liff.init({ liffId });

        if (!liff.isLoggedIn()) {
          liff.login({ redirectUri: window.location.href });
          return;
        }

        const idToken = liff.getIDToken();

        if (!idToken) {
          setErrorMessage('LINE IDトークンを取得できませんでした。');
          return;
        }

        setStatusMessage('プラン情報を取得しています...');

        const response = await fetch('/api/patient/plans', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ idToken }),
        });

        const data = (await response.json()) as PatientPlansResponse;

        if (!response.ok) {
          console.error(data);

          if (data.error === 'Patient not linked') {
            setErrorMessage('このLINEアカウントはまだ患者データと連携されていません。');
          } else {
            setErrorMessage('プラン情報を取得できませんでした。');
          }

          return;
        }

        setPlans(data.plans ?? []);
        setStatusMessage('プラン情報を取得しました。');
      } catch (error) {
        console.error(error);
        setErrorMessage('プラン情報の取得中にエラーが発生しました。');
      } finally {
        setIsLoading(false);
      }
    };

    fetchPlans();
  }, []);

  const currentPlan = plans.find((plan) => plan.status === 'active') ?? null;

  return (
    <div className="max-w-lg mx-auto px-4 py-6">
      <header className="mb-6">
        <Link href="/dashboard" className="mb-3 inline-block text-sm text-teal-600">
          ダッシュボードへ戻る
        </Link>
        <h1 className="text-xl font-bold text-gray-900">プラン</h1>
        <p className="text-sm text-gray-500">現在のプラン状況</p>
        {isLoading && (
          <p className="mt-2 text-xs text-gray-400">{statusMessage}</p>
        )}
        {errorMessage && (
          <p className="mt-2 text-xs text-red-500">{errorMessage}</p>
        )}
      </header>

      {!isLoading && !errorMessage && plans.length === 0 && (
        <div className="rounded-lg border bg-white p-4 text-sm text-gray-500">
          まだプランは登録されていません。
        </div>
      )}

      {currentPlan && (
        <section className="mb-6">
          <h2 className="mb-3 text-sm font-semibold text-gray-900">現在のプラン</h2>
          <PlanStatusCard
            type={currentPlan.type}
            remaining={
              currentPlan.type === 'ticket'
                ? currentPlan.remaining_count ?? 0
                : getSubscriptionRemainingDays(currentPlan.end_date)
            }
            expiresAt={formatDate(currentPlan.end_date)}
          />
        </section>
      )}

      <div className="space-y-4">
        {plans.map((plan) => {
          const usedCount = getUsedCount(plan);

          return (
            <Card key={plan.id} className="border-gray-200">
              <CardContent className="p-5">
                <div className="flex justify-between items-start mb-4 gap-3">
                  <div>
                    <h2 className="font-semibold text-gray-900">{plan.name}</h2>
                    <p className="text-xs text-gray-500 mt-1">
                      種別: {plan.type === 'ticket' ? '回数券' : 'サブスク'}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      期間: {formatDate(plan.start_date)} 〜 {formatDate(plan.end_date)}
                    </p>
                  </div>
                  <Badge className={getStatusClassName(plan.status)}>
                    {getStatusLabel(plan.status)}
                  </Badge>
                </div>

                {plan.type === 'ticket' ? (
                  <div className="grid grid-cols-3 gap-4 text-center">
                    <div className="p-3 bg-gray-50 rounded-lg">
                      <p className="text-2xl font-bold text-gray-900">
                        {plan.total_count ?? 0}
                      </p>
                      <p className="text-xs text-gray-500">合計</p>
                    </div>
                    <div className="p-3 bg-gray-50 rounded-lg">
                      <p className="text-2xl font-bold text-gray-600">{usedCount}</p>
                      <p className="text-xs text-gray-500">使用済</p>
                    </div>
                    <div className="p-3 bg-teal-50 rounded-lg">
                      <p className="text-2xl font-bold text-teal-700">
                        {plan.remaining_count ?? 0}
                      </p>
                      <p className="text-xs text-teal-600">残り</p>
                    </div>
                  </div>
                ) : (
                  <div className="rounded-lg bg-teal-50 p-4 text-center">
                    <p className="text-3xl font-bold text-teal-700">
                      {getSubscriptionRemainingDays(plan.end_date)}
                    </p>
                    <p className="text-sm text-teal-700">有効期限までの日数</p>
                  </div>
                )}

                {plan.type === 'ticket' && (
                  <div className="mt-5 border-t pt-4">
                    <h3 className="font-medium text-gray-900 mb-3">ご利用履歴</h3>
                    {plan.usages.length > 0 ? (
                      <div className="space-y-2">
                        {plan.usages.map((usage) => (
                          <div key={usage.id} className="flex justify-between gap-3 text-sm">
                            <span className="text-gray-600">{formatDate(usage.used_at)}</span>
                            <span className="text-right text-gray-900">
                              {usage.note || '1回使用'}
                            </span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-gray-500">使用履歴はまだありません。</p>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
