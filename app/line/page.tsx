'use client';

import { useEffect, useState } from 'react';
import liff from '@line/liff';

type LineProfile = {
  userId: string;
  displayName: string;
  pictureUrl?: string;
};

export default function LineEntryPage() {
  const [status, setStatus] = useState('LIFFを初期化しています...');
  const [profile, setProfile] = useState<LineProfile | null>(null);

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
          liff.login();
          return;
        }

        const lineProfile = await liff.getProfile();

        setProfile({
          userId: lineProfile.userId,
          displayName: lineProfile.displayName,
          pictureUrl: lineProfile.pictureUrl,
        });

        setStatus('LINEプロフィールを取得できました。');
      } catch (error) {
        console.error(error);
        setStatus('LIFFの初期化またはプロフィール取得に失敗しました。');
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

        {profile && (
          <div className="mt-6 rounded-xl border p-4">
            <p className="text-sm font-medium">LINEプロフィール</p>

            {profile.pictureUrl && (
              <img
                src={profile.pictureUrl}
                alt={profile.displayName}
                className="mt-3 h-16 w-16 rounded-full"
              />
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
      </div>
    </main>
  );
}
