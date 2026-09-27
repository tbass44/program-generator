'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { Card, CardContent } from '@/components/ui/card';
import { ChevronLeft, Clock, Calendar, FileText, Package } from 'lucide-react';
import Link from 'next/link';
import liff from '@line/liff';

type PatientProgram = {
  id: string;
  patient_id: string;
  memo: string | null;
  summary: string | null;
  short_term_program: string | null;
  long_term_program: string | null;
  today_task: string | null;
  program_text: string | null;
  created_at: string;
};

type ProgramRecommendation = {
  id: string;
  reason: string | null;
  status: string | null;
  statusLabel: string;
  created_at: string;
  product: {
    id: string;
    name: string;
    category: string | null;
    description: string | null;
    product_url: string | null;
  } | null;
};

type ProgramDetailResponse = {
  patient?: {
    id: string;
    name: string;
  };
  program?: PatientProgram;
  recommendations?: ProgramRecommendation[];
  error?: string;
  detail?: unknown;
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat('ja-JP', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(new Date(value));
}

function getParamId(id: string | string[] | undefined) {
  if (Array.isArray(id)) {
    return id[0] ?? '';
  }

  return id ?? '';
}

export default function ProgramDetailPage() {
  const params = useParams();
  const programId = getParamId(params.id);
  const [program, setProgram] = useState<PatientProgram | null>(null);
  const [recommendations, setRecommendations] = useState<ProgramRecommendation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [statusMessage, setStatusMessage] = useState('LINE認証を確認しています...');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    const fetchProgramDetail = async () => {
      try {
        setIsLoading(true);
        setErrorMessage(null);
        setStatusMessage('LINE認証を確認しています...');

        const liffId = process.env.NEXT_PUBLIC_LIFF_ID;

        if (!liffId) {
          setErrorMessage('NEXT_PUBLIC_LIFF_ID が設定されていません。');
          return;
        }

        if (!programId) {
          setErrorMessage('改善プログラムIDを確認できませんでした。');
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

        const response = await fetch(`/api/patient/programs/${programId}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ idToken }),
        });

        const data = (await response.json()) as ProgramDetailResponse;

        if (!response.ok || !data.program) {
          console.error(data);

          if (data.error === 'Patient not linked') {
            setErrorMessage('このLINEアカウントはまだ患者データと連携されていません。');
          } else if (data.error === 'Program not found') {
            setErrorMessage('この改善プログラムは表示できません。');
          } else {
            setErrorMessage('改善プログラムを取得できませんでした。');
          }

          return;
        }

        setProgram(data.program);
        setRecommendations(data.recommendations ?? []);
        setStatusMessage('改善プログラムを取得しました。');
      } catch (error) {
        console.error(error);
        setErrorMessage('改善プログラムの取得中にエラーが発生しました。');
      } finally {
        setIsLoading(false);
      }
    };

    fetchProgramDetail();
  }, [programId]);

  return (
    <div className="max-w-lg mx-auto px-4 py-6">
      <header className="mb-6">
        <Link
          href="/programs"
          className="flex items-center gap-1 text-sm text-gray-600 mb-3"
        >
          <ChevronLeft className="h-4 w-4" />
          戻る
        </Link>
        <p className="text-xs text-gray-500 mb-1">
          {program ? formatDate(program.created_at) : ''}
        </p>
        <h1 className="text-xl font-bold text-gray-900">改善プログラム詳細</h1>
        {isLoading && (
          <p className="mt-2 text-xs text-gray-400">{statusMessage}</p>
        )}
        {errorMessage && (
          <p className="mt-2 text-xs text-red-500">{errorMessage}</p>
        )}
      </header>

      {!isLoading && !program && !errorMessage && (
        <div className="rounded-lg border bg-white p-4 text-sm text-gray-500">
          改善プログラムが見つかりませんでした。
        </div>
      )}

      {program && (
        <div className="space-y-4">
          <Card className="border-teal-200 bg-gradient-to-br from-teal-50 to-white">
            <CardContent className="p-5">
              <h2 className="font-semibold text-gray-900 mb-3">状態まとめ</h2>
              <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">
                {program.summary || '状態まとめは未登録です。'}
              </p>
            </CardContent>
          </Card>

          <Card className="border-gray-200">
            <CardContent className="p-5">
              <div className="flex items-center gap-2 mb-3">
                <Clock className="h-5 w-5 text-teal-600" />
                <h2 className="font-semibold text-gray-900">短期プログラム</h2>
              </div>
              <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">
                {program.short_term_program || '短期プログラムは未登録です。'}
              </p>
            </CardContent>
          </Card>

          <Card className="border-gray-200">
            <CardContent className="p-5">
              <div className="flex items-center gap-2 mb-3">
                <Calendar className="h-5 w-5 text-teal-600" />
                <h2 className="font-semibold text-gray-900">長期プログラム</h2>
              </div>
              <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">
                {program.long_term_program || '長期プログラムは未登録です。'}
              </p>
            </CardContent>
          </Card>

          {program.program_text && (
            <Card className="border-gray-200">
              <CardContent className="p-5">
                <div className="flex items-center gap-2 mb-3">
                  <FileText className="h-5 w-5 text-teal-600" />
                  <h2 className="font-semibold text-gray-900">全体メモ</h2>
                </div>
                <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">
                  {program.program_text}
                </p>
              </CardContent>
            </Card>
          )}

          <Card className="border-gray-200 bg-teal-50/50">
            <CardContent className="p-5">
              <div className="flex items-center gap-2 mb-3">
                <Package className="h-5 w-5 text-teal-600" />
                <h2 className="font-semibold text-gray-900">関連する商品提案</h2>
              </div>

              {recommendations.length === 0 ? (
                <p className="text-sm text-gray-500">
                  このプログラムに関連する商品提案はまだありません。
                </p>
              ) : (
                <div className="space-y-3">
                  {recommendations.map((recommendation) => (
                    <div
                      key={recommendation.id}
                      className="rounded-lg border bg-white p-3"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <p className="text-sm font-medium text-gray-900">
                          {recommendation.product?.name || '商品名未登録'}
                        </p>
                        <span className="rounded-full bg-teal-100 px-2 py-0.5 text-xs text-teal-700">
                          {recommendation.statusLabel}
                        </span>
                      </div>
                      {recommendation.reason && (
                        <p className="mt-2 whitespace-pre-wrap text-sm text-gray-700">
                          {recommendation.reason}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
