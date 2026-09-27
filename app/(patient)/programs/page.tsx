'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import liff from '@line/liff';
import { ProgramCard } from '@/components/patient';

type PatientProgram = {
  id: string;
  summary: string | null;
  short_term_program: string | null;
  long_term_program: string | null;
  today_task: string | null;
  program_text: string | null;
  created_at: string;
};

type ProgramsResponse = {
  patient?: {
    id: string;
    name: string;
  };
  programs?: PatientProgram[];
  error?: string;
  detail?: unknown;
};

type ProgramCardViewModel = {
  id: string;
  title: string;
  shortTerm: string;
  longTerm: string;
  todayTask: string;
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat('ja-JP', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(new Date(value));
}

function toProgramCardViewModel(program: PatientProgram): ProgramCardViewModel {
  return {
    id: program.id,
    title: program.summary || `${formatDate(program.created_at)} の改善プログラム`,
    shortTerm: program.short_term_program || '短期プログラムは未登録です。',
    longTerm: program.long_term_program || '長期プログラムは未登録です。',
    todayTask: program.today_task || '詳細ページで内容をご確認ください。',
  };
}

export default function ProgramsPage() {
  const [programs, setPrograms] = useState<ProgramCardViewModel[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [statusMessage, setStatusMessage] = useState('LINE認証を確認しています...');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    const fetchPrograms = async () => {
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

        setStatusMessage('改善プログラムを取得しています...');

        const response = await fetch('/api/patient/programs', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ idToken }),
        });

        const data = (await response.json()) as ProgramsResponse;

        if (!response.ok) {
          console.error(data);

          if (data.error === 'Patient not linked') {
            setErrorMessage('このLINEアカウントはまだ患者データと連携されていません。');
          } else {
            setErrorMessage('改善プログラムを取得できませんでした。');
          }

          return;
        }

        setPrograms((data.programs ?? []).map(toProgramCardViewModel));
        setStatusMessage('改善プログラムを取得しました。');
      } catch (error) {
        console.error(error);
        setErrorMessage('改善プログラムの取得中にエラーが発生しました。');
      } finally {
        setIsLoading(false);
      }
    };

    fetchPrograms();
  }, []);

  return (
    <div className="max-w-lg mx-auto px-4 py-6">
      <header className="mb-6">
        <Link href="/dashboard" className="mb-3 inline-block text-sm text-teal-600">
          ダッシュボードへ戻る
        </Link>
        <h1 className="text-xl font-bold text-gray-900">改善プログラム</h1>
        <p className="text-sm text-gray-500">院から案内された改善プログラム一覧</p>
        {isLoading && (
          <p className="mt-2 text-xs text-gray-400">{statusMessage}</p>
        )}
        {errorMessage && (
          <p className="mt-2 text-xs text-red-500">{errorMessage}</p>
        )}
      </header>

      {!isLoading && !errorMessage && programs.length === 0 && (
        <div className="rounded-lg border bg-white p-4 text-sm text-gray-500">
          まだ改善プログラムは登録されていません。
        </div>
      )}

      <div className="space-y-3">
        {programs.map((program) => (
          <ProgramCard key={program.id} {...program} />
        ))}
      </div>
    </div>
  );
}
