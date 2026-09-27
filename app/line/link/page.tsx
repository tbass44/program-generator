'use client';

import { FormEvent, useEffect, useState } from 'react';
import liff from '@line/liff';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

/**
 * /api/line/link から返ってくるレスポンス型。
 *
 * 成功時：
 * - linked: true
 * - patient: 紐づいた患者情報
 *
 * 失敗時：
 * - error: エラー種別
 * - detail: 補足情報
 */
type LinkResult = {
  linked?: boolean;
  patient?: {
    id: string;
    name: string;
    line_user_id: string | null;
    line_display_name: string | null;
    line_picture_url: string | null;
    line_linked_at: string | null;
  };
  error?: string;
  detail?: unknown;
};

function formatDetail(detail: unknown) {
  if (!detail) {
    return null;
  }

  if (typeof detail === 'string') {
    return detail;
  }

  try {
    return JSON.stringify(detail, null, 2);
  } catch {
    return String(detail);
  }
}

function toStatusMessage(data: LinkResult) {
  if (data.error === 'Invalid link code') {
    return '連携コードが正しくありません。';
  }

  if (data.error === 'Link code has expired') {
    return '連携コードの有効期限が切れています。';
  }

  if (data.error === 'LINE account already linked') {
    return 'このLINEアカウントは、すでに別の患者データに連携済みです。';
  }

  if (data.error === 'Failed to verify LINE id token') {
    return 'LINE認証情報の確認に失敗しました。';
  }

  return 'LINE連携に失敗しました。';
}

/**
 * LINEアカウント連携画面。
 *
 * 役割：
 * 1. LIFFを初期化する
 * 2. LINEログイン状態を確認する
 * 3. LINE IDトークンを取得する
 * 4. 患者さんが入力した連携コードとIDトークンをAPIへ送る
 * 5. 成功すれば patients.line_user_id にLINE userIdが保存される
 *
 * 注意：
 * この画面では line_user_id を直接扱わない。
 * 本人確認・LINE IDトークン検証・DB更新は /api/line/link 側で行う。
 */
export default function LineLinkPage() {
  /**
   * 画面に表示する現在の処理状態。
   * 例：LIFF初期化中、連携コード入力待ち、連携完了など。
   */
  const [status, setStatus] = useState('LIFFを初期化しています...');

  /**
   * LIFFから取得したLINE IDトークン。
   * API側でLINE公式の検証APIに渡すために使う。
   */
  const [idToken, setIdToken] = useState<string | null>(null);

  /**
   * 患者さんが入力する連携コード。
   * 管理者側で患者ごとに発行する想定。
   */
  const [linkCode, setLinkCode] = useState('');

  /**
   * 連携処理中の二重送信防止用。
   */
  const [isSubmitting, setIsSubmitting] = useState(false);

  /**
   * APIから返ってきた結果。
   * 成功時は患者情報を表示する。
   */
  const [result, setResult] = useState<LinkResult | null>(null);

  useEffect(() => {
    /**
     * LIFFを初期化し、LINE IDトークンを取得する。
     *
     * この処理は画面表示時に1回だけ実行する。
     */
    const initLiff = async () => {
      try {
        /**
         * Vercel / .env.local に設定したLIFF ID。
         * NEXT_PUBLIC_ が付いているのでブラウザ側で読める。
         */
        const liffId = process.env.NEXT_PUBLIC_LIFF_ID;

        if (!liffId) {
          setStatus('NEXT_PUBLIC_LIFF_ID が設定されていません。');
          return;
        }

        /**
         * LIFF初期化。
         * LINEアプリ内で開いた時に、LINEログインやプロフィール取得ができるようになる。
         */
        await liff.init({ liffId });

        /**
         * 未ログインの場合はLINEログインへ遷移。
         * 初回は認可画面が表示される。
         */
        if (!liff.isLoggedIn()) {
          liff.login();
          return;
        }

        /**
         * LINE IDトークンを取得。
         * これはサーバー側でLINE公式APIに検証してもらうために使う。
         */
        const token = liff.getIDToken();

        if (!token) {
          setStatus('LINE IDトークンを取得できませんでした。');
          return;
        }

        setIdToken(token);
        setStatus('LINE認証が完了しました。連携コードを入力してください。');
      } catch (error) {
        /**
         * LIFF初期化やIDトークン取得に失敗した場合。
         */
        console.error(error);
        setStatus('LIFFの初期化に失敗しました。');
      }
    };

    initLiff();
  }, []);

  /**
   * 連携コード送信処理。
   *
   * 入力された連携コードとLINE IDトークンを /api/line/link に送り、
   * サーバー側で患者データとLINEアカウントを紐づける。
   */
  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    /**
     * LIFF認証が終わっていない場合は送信させない。
     */
    if (!idToken) {
      setStatus('LINE認証が完了していません。');
      return;
    }

    /**
     * 連携コード未入力の場合は送信させない。
     */
    if (!linkCode.trim()) {
      setStatus('連携コードを入力してください。');
      return;
    }

    try {
      setIsSubmitting(true);
      setResult(null);
      setStatus('患者データとLINEアカウントを紐づけています...');

      /**
       * サーバー側APIへ送信。
       *
       * idToken：
       *   LINE userIdを安全に検証するためのトークン。
       *
       * linkCode：
       *   管理者が患者ごとに発行した本人確認用コード。
       */
      const response = await fetch('/api/line/link', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          idToken,
          linkCode: linkCode.trim(),
        }),
      });

      const data = (await response.json()) as LinkResult;
      setResult(data);

      /**
       * API側でエラーが返ってきた場合、エラー種別ごとに表示文を変える。
       */
      if (!response.ok) {
        setStatus(toStatusMessage(data));
        return;
      }

      /**
       * 紐づけ成功。
       * この段階で patients.line_user_id などがDBに保存されている。
       */
      setStatus('LINE連携が完了しました。');
    } catch (error) {
      /**
       * 通信エラーや想定外エラー。
       */
      console.error(error);
      setResult({
        error: 'Client error',
        detail: error instanceof Error ? error.message : String(error),
      });
      setStatus('LINE連携中にエラーが発生しました。');
    } finally {
      setIsSubmitting(false);
    }
  };

  const detailText = formatDetail(result?.detail);

  return (
    <main className="min-h-screen bg-[#F6F3EE] px-4 py-8 text-[#3A3A3A]">
      <div className="mx-auto max-w-md rounded-2xl bg-white p-6 shadow-sm">
        <h1 className="text-xl font-bold">LINEアカウント連携</h1>

        <p className="mt-4 text-sm leading-6 text-muted-foreground">
          院から案内された連携コードを入力してください。
          LINEアカウントと患者データを紐づけます。
        </p>

        <div className="mt-6 rounded-xl border p-4">
          <p className="text-sm font-medium">状態</p>
          <p className="mt-2 text-sm">{status}</p>
        </div>

        {result?.error && (
          <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            <p className="font-medium">エラー詳細</p>
            <p className="mt-2 break-all">error: {result.error}</p>
            {detailText && (
              <p className="mt-2 whitespace-pre-wrap break-all">detail: {detailText}</p>
            )}
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="linkCode">連携コード</Label>
            <Input
              id="linkCode"
              value={linkCode}
              onChange={(event) => setLinkCode(event.target.value)}
              placeholder="例：123456"
              inputMode="numeric"
              autoComplete="one-time-code"
            />
          </div>

          <Button
            type="submit"
            className="w-full"
            disabled={!idToken || isSubmitting}
          >
            {isSubmitting ? '連携中...' : 'LINEアカウントを連携する'}
          </Button>
        </form>

        {result?.patient && (
          <div className="mt-6 rounded-xl border p-4">
            <p className="text-sm font-medium">連携済み患者情報</p>

            <dl className="mt-4 space-y-2 text-sm">
              <div>
                <dt className="font-medium">患者名</dt>
                <dd>{result.patient.name}</dd>
              </div>

              <div>
                <dt className="font-medium">患者ID</dt>
                <dd className="break-all text-xs text-muted-foreground">
                  {result.patient.id}
                </dd>
              </div>
            </dl>
          </div>
        )}
      </div>
    </main>
  );
}
