'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import liff from '@line/liff';
import { Button } from '@/components/ui/button';

/**
 * LIFF初期化の待機上限。
 *
 * Vercelの通常URLをLINE内ブラウザで直接開いた場合など、
 * liff.init() が完了しないように見えるケースがあるため、
 * 一定時間で案内表示に切り替える。
 */
const LIFF_INIT_TIMEOUT_MS = 10000;

/**
 * LIFFから取得したLINEプロフィール。
 */
type LineProfile = {
  userId: string;
  displayName: string;
  pictureUrl?: string;
};

/**
 * /api/line/me から返ってくる患者情報。
 * まだ紐づいていない場合は null。
 */
type LinkedPatient = {
  id: string;
  name: string;
  line_user_id: string | null;
  line_display_name: string | null;
  line_picture_url: string | null;
  line_linked_at: string | null;
};

/**
 * /api/line/me のレスポンス型。
 *
 * linked:
 *   true  → patients.line_user_id に一致する患者がいる
 *   false → まだ患者データとLINEが紐づいていない
 */
type LineMeResponse = {
  lineProfile: {
    userId: string;
    displayName: string | null;
    pictureUrl: string | null;
  };
  linked: boolean;
  patient: LinkedPatient | null;
  error?: string;
  detail?: unknown;
};

function buildLiffUrl(liffId: string) {
  return `https://liff.line.me/${liffId}`;
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

/**
 * LINE公式アカウントから開く患者画面の入口。
 *
 * 役割：
 * 1. LIFFを初期化する
 * 2. LINEプロフィールとIDトークンを取得する
 * 3. /api/line/me でLINE IDトークンを検証する
 * 4. patients.line_user_id と照合する
 * 5. 紐づけ済みなら患者ダッシュボードへ進める
 * 6. 未紐づけなら /line/link へ進めるボタンを出す
 */
export default function LineEntryPage() {
  /**
   * 画面上に表示する処理状況。
   */
  const [status, setStatus] = useState('LIFFを初期化しています...');

  /**
   * LIFF URL。
   * 直接 /line を開いて初期化が進まない場合の案内に使う。
   */
  const [liffUrl, setLiffUrl] = useState<string | null>(null);

  /**
   * LIFF URLで開き直す案内を表示するかどうか。
   */
  const [showLiffGuide, setShowLiffGuide] = useState(false);

  /**
   * LIFFから取得したLINEプロフィール。
   * 画面上の確認表示に使う。
   */
  const [profile, setProfile] = useState<LineProfile | null>(null);

  /**
   * /api/line/me で患者データ照合した結果。
   */
  const [lineMeResult, setLineMeResult] = useState<LineMeResponse | null>(null);

  useEffect(() => {
    /**
     * LIFFを初期化して、LINEプロフィール取得と患者データ照合を行う。
     *
     * この処理は画面表示時に1回だけ実行する。
     */
    const initLiff = async () => {
      try {
        /**
         * Vercel / .env.local に設定した LIFF ID を取得。
         * NEXT_PUBLIC_ が付いているので、ブラウザ側でも参照できる。
         */
        const liffId = process.env.NEXT_PUBLIC_LIFF_ID;

        if (!liffId) {
          setStatus('NEXT_PUBLIC_LIFF_ID が設定されていません。');
          return;
        }

        const nextLiffUrl = buildLiffUrl(liffId);
        setLiffUrl(nextLiffUrl);

        /**
         * LIFF初期化。
         * 直接Vercel URLを開いた場合などに進まないことがあるため、
         * タイムアウト時はLIFF URLから開き直す案内を出す。
         */
        await initLiffWithTimeout(liffId);
        setShowLiffGuide(false);

        /**
         * 未ログインならLINEログインへ遷移。
         * LINEアプリ内で開いた場合も、初回は認可画面が出る。
         */
        if (!liff.isLoggedIn()) {
          liff.login();
          return;
        }

        /**
         * LINEプロフィール取得。
         * これはフロント側で表示確認するために使う。
         */
        const lineProfile = await liff.getProfile();

        setProfile({
          userId: lineProfile.userId,
          displayName: lineProfile.displayName,
          pictureUrl: lineProfile.pictureUrl,
        });

        /**
         * IDトークン取得。
         *
         * 重要：
         * lineProfile.userId をそのまま信用してDB検索するのではなく、
         * idToken をサーバー側APIへ送り、LINE公式APIで検証する。
         */
        const idToken = liff.getIDToken();

        if (!idToken) {
          setStatus('LINE IDトークンを取得できませんでした。');
          return;
        }

        setStatus('LINEプロフィールを取得しました。患者情報を照合しています...');

        /**
         * サーバー側APIへIDトークンを送信。
         *
         * /api/line/me 側で：
         * - LINE IDトークン検証
         * - LINE userId取得
         * - patients.line_user_id と照合
         * を行う。
         */
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
                {/*
                  LINEプロフィール画像は外部URLのため、MVPでは通常のimgで表示する。
                  next/image に切り替える場合は、LINE画像ドメインの許可設定が必要。
                */}
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

                  {/*
                    LINE連携済みの場合は、患者側ダッシュボードへ進む。
                    ダッシュボード側で再度LIFFのIDトークンを取得し、
                    サーバー側で検証してから本人の患者データを取得する。
                  */}
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

                  {/*
                    未紐づけの場合は、LINE連携コード入力画面へ進む。

                    /line/link では：
                    1. LIFFでLINE IDトークンを取得
                    2. 患者さんが連携コードを入力
                    3. /api/line/link に送信
                    4. patients.line_user_id にLINE userIdを保存
                    という流れで紐づけを行う。
                  */}
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
