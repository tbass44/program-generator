'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import liff from '@line/liff';
import { VisitList } from '@/components/patient';

type PatientVisit = {
  id: string;
  patient_id: string;
  visit_date: string;
  note: string | null;
  created_at: string;
  updated_at: string | null;
};

type PatientVisitsResponse = {
  patient?: {
    id: string;
    name: string;
  };
  visits?: PatientVisit[];
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

function toVisitListItems(visits: PatientVisit[]) {
  return visits.map((visit) => ({
    id: visit.id,
    date: formatDate(visit.visit_date),
    memo: visit.note || '施術メモは未登録です。',
  }));
}

export default function VisitsPage() {
  const [visits, setVisits] = useState<PatientVisit[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [statusMessage, setStatusMessage] = useState('LINE認証を確認しています...');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    const fetchVisits = async () => {
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

        setStatusMessage('通院履歴を取得しています...');

        const response = await fetch('/api/patient/visits', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ idToken }),
        });

        const data = (await response.json()) as PatientVisitsResponse;

        if (!response.ok) {
          console.error(data);

          if (data.error === 'Patient not linked') {
            setErrorMessage('このLINEアカウントはまだ患者データと連携されていません。');
          } else {
            setErrorMessage('通院履歴を取得できませんでした。');
          }

          return;
        }

        setVisits(data.visits ?? []);
        setStatusMessage('通院履歴を取得しました。');
      } catch (error) {
        console.error(error);
        setErrorMessage('通院履歴の取得中にエラーが発生しました。');
      } finally {
        setIsLoading(false);
      }
    };

    fetchVisits();
  }, []);

  return (
    <div className="max-w-lg mx-auto px-4 py-6">
      <header className="mb-6">
        <Link href="/dashboard" className="mb-3 inline-block text-sm text-teal-600">
          ダッシュボードへ戻る
        </Link>
        <h1 className="text-xl font-bold text-gray-900">通院履歴</h1>
        <p className="text-sm text-gray-500">過去の通院記録</p>
        {isLoading && (
          <p className="mt-2 text-xs text-gray-400">{statusMessage}</p>
        )}
        {errorMessage && (
          <p className="mt-2 text-xs text-red-500">{errorMessage}</p>
        )}
      </header>

      {!isLoading && !errorMessage && visits.length === 0 && (
        <div className="rounded-lg border bg-white p-4 text-sm text-gray-500">
          通院履歴はまだ登録されていません。
        </div>
      )}

      {visits.length > 0 && <VisitList visits={toVisitListItems(visits)} />}
    </div>
  );
}
