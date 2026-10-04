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
  debug?: {
    patientId?: string;
    patientName?: string;
    lineUserId?: string;
    visitsCount?: number;
  };
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

export default function VisitsPage() {
  const [patientName, setPatientName] = useState<string | null>(null);
  const [visits, setVisits] = useState<PatientVisit[]>([]);
  const [debugMessage, setDebugMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [statusMessage, setStatusMessage] = useState('LINE認証を確認しています...');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    const fetchVisits = async () => {
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

        setStatusMessage('通院履歴を取得しています...');

        const response = await fetch('/api/patient/visits', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ idToken }),
          cache: 'no-store',
        });

        const data = (await response.json()) as PatientVisitsResponse;

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
            setErrorMessage(
              `通院履歴を取得できませんでした。${detail ? ` ${detail}` : ''}`
            );
          }

          if (data.debug) {
            setDebugMessage(
              `患者ID: ${data.debug.patientId ?? '-'} / 患者名: ${data.debug.patientName ?? '-'} / 件数: ${data.debug.visitsCount ?? '-'}`
            );
          }

          return;
        }

        setPatientName(data.patient?.name ?? data.debug?.patientName ?? null);
        setVisits(data.visits ?? []);
        setStatusMessage('通院履歴を取得しました。');

        if (data.debug) {
          setDebugMessage(
            `患者ID: ${data.debug.patientId ?? '-'} / 患者名: ${data.debug.patientName ?? '-'} / 件数: ${data.debug.visitsCount ?? data.visits?.length ?? 0}`
          );
        }
      } catch (error) {
        console.error(error);
        const message = error instanceof Error ? error.message : String(error);

        if (shouldRetryLineLogin(message)) {
          retryLineLogin();
          return;
        }

        setErrorMessage(`通院履歴の取得中にエラーが発生しました。${message ? ` ${message}` : ''}`);
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
        <p className="text-sm text-gray-500">
          {patientName ? `${patientName}さんの通院記録` : '過去の通院記録'}
        </p>
        {isLoading && (
          <p className="mt-2 text-xs text-gray-400">{statusMessage}</p>
        )}
        {errorMessage && (
          <p className="mt-2 text-xs text-red-500">{errorMessage}</p>
        )}
        {debugMessage && (
          <p className="mt-2 text-[11px] text-gray-400">{debugMessage}</p>
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
