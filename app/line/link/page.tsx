'use client';

import { FormEvent, useEffect, useState } from 'react';
import Link from 'next/link';
import liff from '@line/liff';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

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

function isRevokedTokenError(error: unknown) {
  return toErrorDetail(error).toLowerCase().includes('access token revoked');
}

function retryLineLogin() {
  try {
    liff.logout();
  } catch (error) {
    console.error(error);
  }

  window.setTimeout(() => {
    liff.login({ redirectUri: window.location.href });
  }, 500);
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

export default function LineLinkPage() {
  const [status, setStatus] = useState('LIFFを初期化しています...');
  const [idToken, setIdToken] = useState<string | null>(null);
  const [linkCode, setLinkCode] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [result, setResult] = useState<LinkResult | null>(null);

  useEffect(() => {
    const initLiff = async () => {
      try {
        const liffId = process.env.NEXT_PUBLIC_LIFF_ID;

        if (!liffId) {
          setStatus('NEXT_PUBLIC_LIFF_ID が設定されていません。');
          return;
        }

        await liff.init({ liffId });

        if (!liff.isLoggedIn()) {
          liff.login({ redirectUri: window.location.href });
          return;
        }

        const token = liff.getIDToken();

        if (!token) {
          setStatus('LINE IDトークンを取得できませんでした。LIFFのscopeにopenidがない可能性があります。');
          setResult({
            error: 'Missing ID token',
            detail: 'liff.getIDToken() returned null. LIFFのscopeにopenidがあるか確認してください。',
          });
          return;
        }

        setIdToken(token);
        setStatus('LINE認証が完了しました。連携コードを入力してください。');
      } catch (error) {
        console.error(error);

        if (isRevokedTokenError(error)) {
          setStatus('LINEログイン情報が無効になっています。LINEログインをやり直します...');
          setResult({
            error: 'LINE access token revoked',
            detail: toErrorDetail(error),
          });
          retryLineLogin();
          return;
        }

        setResult({
          error: 'LIFF init failed',
          detail: toErrorDetail(error),
        });
        setStatus('LIFFの初期化に失敗しました。');
      }
    };

    initLiff();
  }, []);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!idToken) {
      setStatus('LINE認証が完了していません。');
      return;
    }

    if (!linkCode.trim()) {
      setStatus('連携コードを入力してください。');
      return;
    }

    try {
      setIsSubmitting(true);
      setResult(null);
      setStatus('患者データとLINEアカウントを紐づけています...');

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

      if (!response.ok) {
        setStatus(toStatusMessage(data));
        return;
      }

      setStatus('LINE連携が完了しました。');
    } catch (error) {
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
  const isLinked = Boolean(result?.linked && result?.patient);

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

        {!isLinked && (
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
        )}

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

            {isLinked && (
              <Link href="/dashboard" className="mt-5 block">
                <Button className="w-full">患者画面へ進む</Button>
              </Link>
            )}
          </div>
        )}
      </div>
    </main>
  );
}
