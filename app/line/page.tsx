'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import liff from '@line/liff';
import { Button } from '@/components/ui/button';

const LIFF_INIT_TIMEOUT_MS = 10000;

type LineProfile = {
  userId: string;
  displayName: string;
  pictureUrl?: string;
};

type LinkedPatient = {
  id: string;
  name: string;
  line_user_id: string | null;
  line_display_name: string | null;
  line_picture_url: string | null;
  line_linked_at: string | null;
};

type LineMeResponse = {
  lineProfile?: {
    userId: string;
    displayName: string | null;
    pictureUrl: string | null;
  };
  linked?: boolean;
  patient?: LinkedPatient | null;
  error?: string;
  detail?: unknown;
};

function buildLiffUrl(liffId: string) {
  return `https://liff.line.me/${liffId}`;
}

function toErrorDetail(error: unknown) {
  if (error instanceof Error) {
    return `${error.name}: ${error.message}`;
  }

  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
}

function toApiErrorDetail(data: LineMeResponse) {
  const parts = [];

  if (data.error) {
    parts.push(`error: ${data.error}`);
  }

  if (data.detail) {
    parts.push(`detail: ${String(data.detail)}`);
  }

  return parts.join('\n');
}

function initLiffWithTimeout(liffId: string) {
  return Promise.race([
    liff.init({ liffId }),
    new Promise<never>((_resolve, reject) => {
      window.setTimeout(() => {
        reject(new Error('LIFF_INIT_TIMEOUT'));
      }, LIFF_INIT_TIMEOUT_MS);
    }),
  ]);
}

export default function LineEntryPage() {
  const [status, setStatus] = useState('LIFFを初期化しています...');
  const [liffUrl, setLiffUrl] = useState<string | null>(null);
  const [showLiffGuide, setShowLiffGuide] = useState(false);
  const [errorDetail, setErrorDetail] = useState<string | null>(null);
  const [profile, setProfile] = useState<LineProfile | null>(null);
  const [lineMeResult, setLineMeResult] = useState<LineMeResponse | null>(null);

  useEffect(() => {
    const initLiff = async () => {
      try {
        setErrorDetail(null);

        const liffId = process.env.NEXT_PUBLIC_LIFF_ID;

        if (!liffId) {
          setStatus('NEXT_PUBLIC_LIFF_ID が設定されていません。');
          setErrorDetail('NEXT_PUBLIC_LIFF_ID is not set');
          return;
        }

        const nextLiffUrl = buildLiffUrl(liffId);
        setLiffUrl(nextLiffUrl);

        await initLiffWithTimeout(liffId);
        setShowLiffGuide(false);

        if (!liff.isLoggedIn()) {
          liff.login();
          return;
        }

        const lineProfile = await liff.getProfile();

        setProfile({
          userId: lineProfile.userId,
          displayName: lineProfile.displayName,
          pictureUrl: lineProfile.pictureUrl,
        });

        const idToken = liff.getIDToken();

        if (!idToken) {
          setStatus('LINE IDトークンを取得できませんでした。');
          setErrorDetail('liff.getIDToken() returned null. LIFFのscopeにopenidがない可能性があります。');
          return;
        }

        setStatus('LINEプロフィールを取得しました。患者情報を照合しています...');

        const response = await fetch('/api/line/me', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ idToken }),
        });

        const data = (await response.json()) as LineMeResponse;

        if (!response.ok) {
          console.error(data);
          setStatus('患者情報の照合に失敗しました。');
          setErrorDetail(toApiErrorDetail(data) || `HTTP ${response.status}`);
          setLineMeResult(data);
          return;
        }

        setLineMeResult(data);

        if (data.linked) {
          setStatus('患者データとLINEアカウントが紐づいています。');
        } else {
          setStatus('まだ患者データとLINEアカウントが紐づいていません。');
        }
      } catch (error) {
        console.error(error);
        const detail = toErrorDetail(error);
        setErrorDetail(detail);

        if (error instanceof Error && error.message === 'LIFF_INIT_TIMEOUT') {
          setStatus('LIFFの初期化に時間がかかっています。LIFF URLから開き直してください。');
          setShowLiffGuide(true);
          return;
        }

        setStatus('LIFFの初期化または患者情報の照合に失敗しました。');
        setShowLiffGuide(true);
      }
    };

    initLiff();
  }, []);

  return (
    <main className="min-h-screen bg-[#F6F3EE] px-4 py-8 text-[#3A3A3A]">
      <div className="mx-auto max-w-md rounded-2xl bg-white p-6 shadow-sm">
        <h1 className="text-xl font-bold">カイロシガ整体院 患者画面</h1>

        <p className="mt-4 text-sm leading-6 text-muted-foreground">
          LINE公式アカウントから患者画面に接続しています。
        </p>

        <div className="mt-6 rounded-xl border p-4">
          <p className="text-sm font-medium">接続状況</p>
          <p className="mt-2 text-sm">{status}</p>
        </div>

        {errorDetail && (
          <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            <p className="font-medium">エラー詳細</p>
            <p className="mt-2 whitespace-pre-wrap break-words">{errorDetail}</p>
          </div>
        )}

        {showLiffGuide && liffUrl && (
          <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50 p-4">
            <p className="text-sm font-medium text-amber-900">
              LINEアプリ用URLから開き直してください
            </p>
            <p className="mt-2 text-sm leading-6 text-amber-800">
              この画面が進まない場合は、通常URLではなくLIFF URLから開く必要があります。
            </p>
            <a href={liffUrl} className="mt-4 block">
              <Button className="w-full">LINEアプリ用URLで開く</Button>
            </a>
            <p className="mt-3 break-all text-xs text-amber-700">{liffUrl}</p>
          </div>
        )}

        {profile && (
          <div className="mt-6 rounded-xl border p-4">
            <p className="text-sm font-medium">LINEプロフィール</p>

            {profile.pictureUrl && (
              <>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={profile.pictureUrl}
                  alt={profile.displayName}
                  className="mt-3 h-16 w-16 rounded-full"
                />
              </>
            )}

            <dl className="mt-4 space-y-2 text-sm">
              <div>
                <dt className="font-medium">表示名</dt>
                <dd>{profile.displayName}</dd>
              </div>
              <div>
                <dt className="font-medium">LINE userId</dt>
                <dd className="break-all text-xs text-muted-foreground">
                  {profile.userId}
                </dd>
              </div>
            </dl>
          </div>
        )}

        {lineMeResult && (
          <div className="mt-6 rounded-xl border p-4">
            <p className="text-sm font-medium">患者データ照合結果</p>

            <dl className="mt-4 space-y-2 text-sm">
              <div>
                <dt className="font-medium">紐づけ状態</dt>
                <dd>{lineMeResult.linked ? '紐づけ済み' : '未紐づけ'}</dd>
              </div>

              {lineMeResult.patient && (
                <>
                  <div>
                    <dt className="font-medium">患者名</dt>
                    <dd>{lineMeResult.patient.name}</dd>
                  </div>

                  <div>
                    <dt className="font-medium">患者ID</dt>
                    <dd className="break-all text-xs text-muted-foreground">
                      {lineMeResult.patient.id}
                    </dd>
                  </div>

                  <div className="pt-2">
                    <Link href="/dashboard" className="block">
                      <Button className="w-full">患者画面へ進む</Button>
                    </Link>
                  </div>
                </>
              )}

              {!lineMeResult.patient && (
                <div>
                  <dt className="font-medium">次の対応</dt>
                  <dd className="text-muted-foreground">
                    本人確認後、患者データとLINEアカウントを紐づけます。
                  </dd>

                  <Link href="/line/link" className="mt-4 block">
                    <Button className="w-full">連携コードを入力する</Button>
                  </Link>
                </div>
              )}
            </dl>
          </div>
        )}
      </div>
    </main>
  );
}
