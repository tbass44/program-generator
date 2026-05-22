import './globals.css';
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { ClerkProvider } from '@clerk/nextjs';

/**
 * Google Font設定。
 */
const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'program-generator',
  description: '整体院向け患者管理・改善プログラム管理アプリ',
  openGraph: {
    images: [
      {
        url: 'https://bolt.new/static/og_default.png',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    images: [
      {
        url: 'https://bolt.new/static/og_default.png',
      },
    ],
  },
};

/**
 * アプリ全体のRootLayout。
 *
 * ClerkProviderでchildrenを包むことで、
 * 管理画面側でClerkのログイン状態・ユーザー情報を使えるようにする。
 *
 * 患者側LINE LIFF導線は今まで通り動かし、
 * 管理側 /admin は次の middleware.ts でログイン必須にする。
 */
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ClerkProvider>
      <html lang="ja">
        <body className={inter.className}>{children}</body>
      </html>
    </ClerkProvider>
  );
}
