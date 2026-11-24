'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import liff from '@line/liff';
import { redirectToLineEntry, retryLineLogin } from '@/lib/patient-line-navigation';
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

type NextReservation = {
  menu: string;
  start_at: string;
  end_at: string;
};

function formatReservationDateTime(value: string): string {
  // Laravel stores local clinic time without an offset. Do not shift it to the browser's timezone.
  const match = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})/.exec(value);
  if (!match) return value;
  return `${match[1]}年${Number(match[2])}月${Number(match[3])}日 ${match[4]}:${match[5]}`;
}

type ReservationHistoryItem = NextReservation & {
  canceled: boolean;
  status: 'canceled' | 'completed' | 'upcoming';
};

type DashboardResponse = {
  patient?: DashboardPatient;
  nextReservation?: NextReservation | null;
  reservationHistory?: ReservationHistoryItem[];
  nextReservationStatus?: 'ok' | 'unavailable';
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



export default function DashboardPage() {
  const [patient, setPatient] = useState<DashboardPatient | null>(null);
  const [currentProgram, setCurrentProgram] = useState<ProgramCardViewModel | null>(null);
  const [currentPlan, setCurrentPlan] = useState<DashboardCurrentPlan | null>(null);
  const [recommendations, setRecommendations] = useState<DashboardRecommendation[]>([]);
  const [recentVisits, setRecentVisits] = useState<DashboardVisit[]>([]);
  const [rentals, setRentals] = useState<DashboardRecommendation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [statusMessage, setStatusMessage] = useState('LINE認証を確認しています...');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [nextReservation, setNextReservation] = useState<NextReservation | null>(null);
  const [reservationHistory, setReservationHistory] = useState<ReservationHistoryItem[]>([]);
  const [showAllReservationHistory, setShowAllReservationHistory] = useState(false);
  const [nextReservationStatus, setNextReservationStatus] = useState<'loading' | 'ok' | 'unavailable'>('loading');
  const [bookingBusy, setBookingBusy] = useState(false);
  const [bookingError, setBookingError] = useState<string | null>(null);
  const [refreshCount, setRefreshCount] = useState(0);

  const supportRecommendations = useMemo(
    () => recommendations.filter((recommendation) => !rentalStatuses.includes(recommendation.status)),
    [recommendations]
  );

  useEffect(() => {
    let active = true;
    const abortController = new AbortController();
    const fetchPatientDashboard = async () => {
      try {
        setIsLoading(true);
        // Clear the previous patient's details before re-checking LINE identity.
        // Otherwise a failed refresh or account switch can leave stale data visible.
        setPatient(null);
        setCurrentProgram(null);
        setCurrentPlan(null);
        setRecommendations([]);
        setRecentVisits([]);
        setRentals([]);
        setNextReservation(null);
        setReservationHistory([]);
        setShowAllReservationHistory(false);
        setBookingError(null);
        setErrorMessage(null);
        setNextReservationStatus('loading');
        setStatusMessage('LINE認証を確認しています...');

        const liffId = process.env.NEXT_PUBLIC_LIFF_ID;

        if (!liffId) {
          setErrorMessage('NEXT_PUBLIC_LIFF_ID が設定されていません。');
          return;
        }

        await liff.init({ liffId });
        if (!active) return;

        if (!liff.isLoggedIn()) {
          redirectToLineEntry();
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
          signal: abortController.signal,
        });

        const data = (await response.json()) as DashboardResponse;
        if (!active) return;

        if (!response.ok || !data.patient) {
          if (shouldRetryLineLogin(data.error ?? '')) {
            retryLineLogin();
            return;
          }

          setNextReservationStatus('unavailable');
          if (data.error === 'Patient not linked') {
            setErrorMessage('このLINEアカウントはまだ患者データと連携されていません。');
          } else {
            setErrorMessage('患者情報を取得できませんでした。時間をおいて再度お試しください。');
          }

          return;
        }

        setPatient(data.patient);
        setNextReservation(data.nextReservation ?? null);
        setReservationHistory(data.reservationHistory ?? []);
        setNextReservationStatus(data.nextReservationStatus === 'ok' ? 'ok' : 'unavailable');
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
      } catch (error) {
        if (!active) return;
        const message = error instanceof Error ? error.message : String(error);

        if (shouldRetryLineLogin(message)) {
          retryLineLogin();
          return;
        }

        setNextReservationStatus('unavailable');
        setErrorMessage('患者情報の取得中にエラーが発生しました。時間をおいて再度お試しください。');
      } finally {
        if (active) setIsLoading(false);
      }
    };

    fetchPatientDashboard();
    return () => {
      active = false;
      abortController.abort();
    };
  }, [refreshCount]);

  // Browsers may restore this page from the back-forward cache after Laravel booking.
  useEffect(() => {
    const onPageShow = (event: PageTransitionEvent) => {
      if (event.persisted) setRefreshCount((count) => count + 1);
    };
    window.addEventListener('pageshow', onPageShow);
    return () => window.removeEventListener('pageshow', onPageShow);
  }, []);

  const startBooking = async () => {
    if (bookingBusy || !patient) return;
    setBookingBusy(true);
    setBookingError(null);
    try {
      if (!liff.isLoggedIn()) {
        redirectToLineEntry();
        return;
      }
      const idToken = liff.getIDToken();
      if (!idToken) {
        retryLineLogin();
        return;
      }
      const response = await fetch('/api/patient/booking-handoff', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken }),
        cache: 'no-store',
      });
      const body = (await response.json()) as { entryUrl?: string; error?: string };
      if (!response.ok || !body.entryUrl) {
        setBookingError('予約画面を開けませんでした。時間をおいて再度お試しください。');
        return;
      }
      window.location.assign(body.entryUrl);
    } catch {
      setBookingError('予約画面との接続に失敗しました。もう一度お試しください。');
    } finally {
      setBookingBusy(false);
    }
  };

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
      </header>

      {!canShowDashboard && !isLoading && (
        <div className="rounded-lg border bg-white p-4 text-sm text-gray-500">
          患者画面を表示するには、LINEアカウントと患者データの連携が必要です。
        </div>
      )}

      {canShowDashboard && (
        <>
          <section className="mb-6 rounded-lg border border-teal-200 bg-white p-4">
            <h2 className="font-semibold text-gray-900">次回のご予約</h2>
            {nextReservationStatus === 'loading' ? (
              <p className="mt-2 text-sm text-gray-500">予約情報を確認しています…</p>
            ) : nextReservationStatus === 'unavailable' ? (
              <p className="mt-2 text-sm text-amber-700">予約情報を現在取得できません。予約済みの場合は、確認後に表示されます。</p>
            ) : nextReservation ? (
              <div className="mt-2 text-sm text-gray-700">
                <p className="font-semibold">{formatReservationDateTime(nextReservation.start_at)}〜{nextReservation.end_at.slice(11, 16)}</p>
                <p className="mt-1">{nextReservation.menu}</p>
              </div>
            ) : (
              <p className="mt-2 text-sm text-gray-600">現在、MyCareからの次回予約はありません。</p>
            )}
            <p className="mt-2 text-sm text-gray-600">ご希望の日時を選んで、次回の施術をご予約いただけます。</p>
            <button
              type="button"
              disabled={bookingBusy}
              onClick={startBooking}
              className="mt-3 w-full rounded-md bg-teal-600 px-4 py-3 text-sm font-semibold text-white disabled:opacity-60"
            >{bookingBusy ? '予約画面に接続しています…' : nextReservation ? '別の日程も予約する' : '次回の施術を予約する'}</button>
            {bookingError && <p role="alert" className="mt-2 text-sm text-red-600">{bookingError}</p>}
            <button
              type="button"
              onClick={() => setRefreshCount((count) => count + 1)}
              disabled={isLoading}
              className="mt-3 w-full rounded-md border border-teal-200 py-2 text-sm font-medium text-teal-700 disabled:opacity-50"
            >
              {isLoading ? '予約情報を確認しています…' : '予約情報を更新する'}
            </button>
          </section>
          <section className="mb-6 rounded-lg border bg-white p-4">
            <h2 className="font-semibold text-gray-900">MyCareからの予約履歴</h2>
            {nextReservationStatus === 'loading' ? (
              <p className="mt-2 text-sm text-gray-500">予約履歴を確認しています…</p>
            ) : nextReservationStatus === 'unavailable' ? (
              <p className="mt-2 text-sm text-amber-700">予約履歴を現在取得できません。</p>
            ) : reservationHistory.length === 0 ? (
              <p className="mt-2 text-sm text-gray-600">MyCareからの予約履歴はまだありません。</p>
            ) : (
              <div>
                <ul className="mt-3 space-y-3">
                {(showAllReservationHistory ? reservationHistory : reservationHistory.slice(0, 3)).map((booking, index) => (
                  <li key={`${booking.start_at}-${index}`} className="border-t pt-3 first:border-t-0 first:pt-0">
                    <p className="text-sm font-medium text-gray-900">
                      {formatReservationDateTime(booking.start_at)}〜{booking.end_at.slice(11, 16)}
                    </p>
                    <p className="mt-1 text-sm text-gray-600">{booking.menu}</p>
                    <p className={`mt-1 text-xs ${booking.status === 'canceled' ? 'text-red-600' : booking.status === 'completed' ? 'text-gray-500' : 'text-teal-700'}`}>
                      {booking.status === 'canceled' ? 'キャンセル済み' : booking.status === 'completed' ? '日時経過' : '予約済み'}
                    </p>
                  </li>
                ))}
                </ul>
                {reservationHistory.length > 3 && (
                  <button
                    type="button"
                    onClick={() => setShowAllReservationHistory((current) => !current)}
                    aria-expanded={showAllReservationHistory}
                    className="mt-3 w-full rounded-md border border-teal-200 py-2 text-sm font-medium text-teal-700"
                  >
                    {showAllReservationHistory ? '閉じる' : 'さらに履歴を見る'}
                  </button>
                )}
              </div>
            )}
            <p className="mt-3 text-xs text-gray-500">
              MyCareからの直近最大10件を表示しています。従来の予約システムから行った予約は含みません。
            </p>
          </section>
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
