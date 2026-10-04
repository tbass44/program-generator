'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import liff from '@line/liff';
import {
  PlanStatusCard,
  ProgramCard,
  SectionHeader,
  SupportCategoryCard,
  VisitList,
} from '@/components/patient';
import { Apple, Dumbbell, Moon, Sparkles } from 'lucide-react';

type DashboardPatient = {
  id: string;
  name: string;
  memo: string | null;
  line_user_id: string | null;
  line_display_name: string | null;
  line_picture_url: string | null;
  line_linked_at: string | null;
};

type DashboardCurrentProgram = {
  id: string;
  summary: string | null;
  short_term_program: string | null;
  long_term_program: string | null;
  created_at: string;
};

type DashboardCurrentPlan = {
  id: string;
  type: 'ticket' | 'subscription';
  name: string;
  total_count: number | null;
  remaining_count: number | null;
  start_date: string | null;
  end_date: string | null;
  status: string;
  created_at: string;
};

type DashboardProduct = {
  id: string;
  name: string;
  category: string;
  description: string | null;
  product_url: string | null;
};

type DashboardRecommendation = {
  id: string;
  program_id: string | null;
  product_id: string | null;
  category: string | null;
  reason: string | null;
  status: string;
  created_at: string;
  updated_at: string;
  product: DashboardProduct | null;
  program: {
    id: string;
    summary: string | null;
  } | null;
};

type DashboardVisit = {
  id: string;
  patient_id: string;
  visit_date: string;
  note: string | null;
  created_at: string;
  updated_at: string | null;
};

type DashboardResponse = {
  patient?: DashboardPatient;
  currentProgram?: DashboardCurrentProgram | null;
  currentPlan?: DashboardCurrentPlan | null;
  recommendations?: DashboardRecommendation[];
  recentVisits?: DashboardVisit[];
  rentals?: DashboardRecommendation[];
  debug?: {
    patientId?: string;
    patientName?: string;
    lineUserId?: string;
    recommendationsCount?: number;
    visitsCount?: number;
    rentalsCount?: number;
  };
  error?: string;
  detail?: unknown;
};

type ProgramCardViewModel = {
  id: string;
  title: string;
  shortTerm: string;
  longTerm: string;
};

type SupportCategoryKey = 'physical_sleep' | 'nutrition' | 'exercise' | 'skincare';

const rentalStatuses = ['rental_requested', 'renting', 'rental_returned'];

const supportCategoryMeta: Record<
  SupportCategoryKey,
  {
    icon: typeof Moon;
    title: string;
    description: string;
  }
> = {
  physical_sleep: {
    icon: Moon,
    title: '物理療法（睡眠）',
    description: '睡眠環境や身体への負担軽減を目的としたサポート',
  },
  nutrition: {
    icon: Apple,
    title: '栄養療法',
    description: '内面から健康を支える栄養サポート',
  },
  exercise: {
    icon: Dumbbell,
    title: '運動療法',
    description: '体を動かして改善を促すサポート',
  },
  skincare: {
    icon: Sparkles,
    title: 'スキンケア',
    description: '肌の健康を保つケアサポート',
  },
};

function isSupportCategoryKey(value: string | null | undefined): value is SupportCategoryKey {
  return Boolean(value && value in supportCategoryMeta);
}

function getSupportCategoryMeta(value: string | null | undefined) {
  if (isSupportCategoryKey(value)) {
    return supportCategoryMeta[value];
  }

  return {
    icon: Sparkles,
    title: '商品サポート',
    description: '現在提案中の商品サポート',
  };
}

function getStatusLabel(status: string) {
  const labels: Record<string, string> = {
    recommended: '提案中',
    rental_requested: 'レンタル希望',
    renting: 'レンタル中',
    rental_returned: 'レンタル終了',
    purchase_requested: '購入希望',
  };

  return labels[status] ?? status;
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

function toProgramCardViewModel(program: DashboardCurrentProgram): ProgramCardViewModel {
  return {
    id: program.id,
    title: '現在の改善プログラム',
    shortTerm: program.short_term_program || '短期プログラムは未登録です。',
    longTerm: program.long_term_program || '長期プログラムは未登録です。',
  };
}

function toSupportCardProps(recommendation: DashboardRecommendation) {
  const category = recommendation.product?.category ?? recommendation.category;
  const meta = getSupportCategoryMeta(category);
  const productName = recommendation.product?.name ?? '商品名未設定';
  const reason = recommendation.reason || recommendation.product?.description || '提案理由は未登録です。';

  return {
    href: '/product-support',
    icon: meta.icon,
    title: meta.title,
    description: reason,
    recommendedSupport: productName,
    relatedProgramId: recommendation.program?.id,
    relatedProgramTitle: recommendation.program?.summary || '関連プログラム',
    supportItems: [
      {
        name: getStatusLabel(recommendation.status),
        href: '/product-support',
      },
    ],
  };
}

function toVisitListItems(visits: DashboardVisit[]) {
  return visits.map((visit) => ({
    id: visit.id,
    date: formatDate(visit.visit_date),
    memo: visit.note || '施術メモは未登録です。',
  }));
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

  liff.login({ redirectUri: window.location.href });
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

export default function DashboardPage() {
  const [patient, setPatient] = useState<DashboardPatient | null>(null);
  const [currentProgram, setCurrentProgram] = useState<ProgramCardViewModel | null>(null);
  const [currentPlan, setCurrentPlan] = useState<DashboardCurrentPlan | null>(null);
  const [recommendations, setRecommendations] = useState<DashboardRecommendation[]>([]);
  const [recentVisits, setRecentVisits] = useState<DashboardVisit[]>([]);
  const [rentals, setRentals] = useState<DashboardRecommendation[]>([]);
  const [debugMessage, setDebugMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [statusMessage, setStatusMessage] = useState('LINE認証を確認しています...');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const supportRecommendations = useMemo(
    () => recommendations.filter((recommendation) => !rentalStatuses.includes(recommendation.status)),
    [recommendations]
  );

  useEffect(() => {
    const fetchPatientDashboard = async () => {
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
          liff.login({ redirectUri: window.location.href });
          return;
        }

        const idToken = liff.getIDToken();

        if (!idToken) {
          retryLineLogin();
          return;
        }

        setStatusMessage('患者情報を取得しています...');

        const response = await fetch('/api/patient/dashboard', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ idToken }),
          cache: 'no-store',
        });

        const data = (await response.json()) as DashboardResponse;

        if (!response.ok || !data.patient) {
          console.error(data);
          const detail = formatDetail(data.detail);

          if (shouldRetryLineLogin(`${data.error ?? ''} ${detail}`)) {
            retryLineLogin();
            return;
          }

          if (data.error === 'Patient not linked') {
            setErrorMessage('このLINEアカウントはまだ患者データと連携されていません。');
          } else {
            setErrorMessage(`患者情報を取得できませんでした。${detail ? ` ${detail}` : ''}`);
          }

          if (data.debug) {
            setDebugMessage(
              `患者ID: ${data.debug.patientId ?? '-'} / 患者名: ${data.debug.patientName ?? '-'} / 商品: ${data.debug.recommendationsCount ?? '-'} / 通院: ${data.debug.visitsCount ?? '-'} / レンタル: ${data.debug.rentalsCount ?? '-'}`
            );
          }

          return;
        }

        setPatient(data.patient);
        setCurrentPlan(data.currentPlan ?? null);
        setRecommendations(data.recommendations ?? []);
        setRecentVisits(data.recentVisits ?? []);
        setRentals(data.rentals ?? []);
        setStatusMessage('患者情報を取得しました。');

        if (data.currentProgram) {
          setCurrentProgram(toProgramCardViewModel(data.currentProgram));
        } else {
          setCurrentProgram(null);
        }

        if (data.debug) {
          setDebugMessage(
            `患者ID: ${data.debug.patientId ?? '-'} / 患者名: ${data.debug.patientName ?? '-'} / 商品: ${data.debug.recommendationsCount ?? 0} / 通院: ${data.debug.visitsCount ?? 0} / レンタル: ${data.debug.rentalsCount ?? 0}`
          );
        }
      } catch (error) {
        console.error(error);
        const message = error instanceof Error ? error.message : String(error);

        if (shouldRetryLineLogin(message)) {
          retryLineLogin();
          return;
        }

        setErrorMessage(`患者情報の取得中にエラーが発生しました。${message ? ` ${message}` : ''}`);
      } finally {
        setIsLoading(false);
      }
    };

    fetchPatientDashboard();
  }, []);

  const canShowDashboard = Boolean(patient);

  return (
    <div className="max-w-lg mx-auto px-4 py-6">
      <header className="mb-6">
        <h1 className="text-xl font-bold text-gray-900">
          {patient ? `こんにちは、${patient.name}さん` : 'こんにちは'}
        </h1>
        <p className="text-sm text-gray-500">本日の状態を確認しましょう</p>
        {isLoading && <p className="mt-2 text-xs text-gray-400">{statusMessage}</p>}
        {errorMessage && <p className="mt-2 text-xs text-red-500">{errorMessage}</p>}
        {debugMessage && <p className="mt-2 text-[11px] text-gray-400">{debugMessage}</p>}
      </header>

      {!canShowDashboard && !isLoading && (
        <div className="rounded-lg border bg-white p-4 text-sm text-gray-500">
          患者画面を表示するには、LINEアカウントと患者データの連携が必要です。
        </div>
      )}

      {canShowDashboard && (
        <>
          <section className="mb-6">
            <SectionHeader
              title="現在のプラン"
              action={
                <Link href="/plans" className="text-sm text-teal-600">
                  詳細
                </Link>
              }
            />
            {currentPlan ? (
              <div className="space-y-2">
                <PlanStatusCard
                  type={currentPlan.type}
                  remaining={
                    currentPlan.type === 'ticket'
                      ? currentPlan.remaining_count ?? 0
                      : getSubscriptionRemainingDays(currentPlan.end_date)
                  }
                  expiresAt={formatDate(currentPlan.end_date)}
                />
                <div className="rounded-lg border bg-white p-3 text-sm text-gray-600">
                  <p className="font-medium text-gray-900">{currentPlan.name}</p>
                  <p className="mt-1">
                    期間：{formatDate(currentPlan.start_date)} 〜 {formatDate(currentPlan.end_date)}
                  </p>
                </div>
              </div>
            ) : (
              <div className="rounded-lg border bg-white p-4 text-sm text-gray-500">
                現在有効なプランは登録されていません。
              </div>
            )}
          </section>

          <section className="mb-6">
            <SectionHeader
              title="現在の改善プログラム"
              action={
                <Link href="/programs" className="text-sm text-teal-600">
                  すべて見る
                </Link>
              }
            />
            {currentProgram ? (
              <ProgramCard {...currentProgram} />
            ) : (
              <div className="rounded-lg border bg-white p-4 text-sm text-gray-500">
                まだ改善プログラムは登録されていません。
              </div>
            )}
          </section>

          <section className="mb-6">
            <SectionHeader
              title="商品サポート"
              action={
                <Link href="/product-support" className="text-sm text-teal-600">
                  すべて見る
                </Link>
              }
            />
            {supportRecommendations.length > 0 ? (
              <div className="space-y-3">
                {supportRecommendations.map((recommendation) => (
                  <SupportCategoryCard
                    key={recommendation.id}
                    {...toSupportCardProps(recommendation)}
                  />
                ))}
              </div>
            ) : (
              <div className="rounded-lg border bg-white p-4 text-sm text-gray-500">
                現在表示できる商品提案はありません。
              </div>
            )}
          </section>

          <section className="mb-6">
            <SectionHeader
              title="直近の通院履歴"
              action={
                <Link href="/visits" className="text-sm text-teal-600">
                  すべて見る
                </Link>
              }
            />
            {recentVisits.length > 0 ? (
              <VisitList visits={toVisitListItems(recentVisits)} />
            ) : (
              <div className="rounded-lg border bg-white p-4 text-sm text-gray-500">
                通院履歴はまだ登録されていません。
              </div>
            )}
          </section>

          <section>
            <SectionHeader
              title="レンタル履歴"
              action={
                <Link href="/rentals" className="text-sm text-teal-600">
                  すべて見る
                </Link>
              }
            />
            {rentals.length > 0 ? (
              <div className="space-y-3">
                {rentals.map((rental) => (
                  <div key={rental.id} className="rounded-lg border bg-white p-4 text-sm">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-medium text-gray-900">
                          {rental.product?.name ?? '商品名未設定'}
                        </p>
                        <p className="mt-1 text-xs text-gray-500">
                          更新日：{formatDate(rental.updated_at)}
                        </p>
                      </div>
                      <span className="rounded-full bg-teal-50 px-2 py-1 text-xs font-medium text-teal-700">
                        {getStatusLabel(rental.status)}
                      </span>
                    </div>
                    {rental.reason && <p className="mt-3 text-gray-600">{rental.reason}</p>}
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-lg border bg-white p-4 text-sm text-gray-500">
                レンタル履歴はまだありません。
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}
