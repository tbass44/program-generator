'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  LayoutDashboard,
  Users,
  FileText,
  ShoppingBag,
  CreditCard,
  Menu,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

/**
 * /api/admin/me から返ってくるレスポンス型。
 *
 * isAdmin:
 *   true  → Supabase profiles.role が admin
 *   false → ログイン済みでも管理者権限なし
 */
type AdminMeResponse = {
  authenticated?: boolean;
  clerkUserId?: string | null;
  profile?: {
    id: string;
    clerk_user_id: string;
    role: 'admin' | 'patient';
    created_at: string;
    updated_at: string;
  } | null;
  isAdmin?: boolean;
  message?: string;
  error?: string;
  detail?: unknown;
};

/**
 * 管理画面サイドバーのナビゲーション。
 */
const navItems = [
  {
    label: 'ダッシュボード',
    href: '/admin/dashboard',
    icon: LayoutDashboard,
  },
  {
    label: '患者管理',
    href: '/admin/patients',
    icon: Users,
  },
  {
    label: '改善プログラム',
    href: '/admin/programs/new',
    icon: FileText,
  },
  {
    label: '商品管理',
    href: '/admin/products',
    icon: ShoppingBag,
  },
  {
    label: 'プラン管理',
    href: '/admin/plans',
    icon: CreditCard,
  },
];

/**
 * 管理画面共通レイアウト。
 *
 * 役割：
 * 1. 管理画面のサイドバー・モバイルメニューを表示する
 * 2. /api/admin/me で Supabase profiles.role を確認する
 * 3. role が admin の場合だけ管理画面本体を表示する
 * 4. admin でない場合はトップへ戻す
 *
 * 補足：
 * Clerkログイン必須化は middleware.ts が担当する。
 * このレイアウトでは「ログイン済みユーザーがadminかどうか」を確認する。
 */
export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  /**
   * 管理者権限チェック中かどうか。
   * true の間は管理画面本体を表示しない。
   */
  const [isCheckingAdmin, setIsCheckingAdmin] = useState(true);

  /**
   * 権限チェックに失敗した場合やadminでない場合のメッセージ。
   */
  const [adminErrorMessage, setAdminErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    /**
     * ログイン中ユーザーの admin role を確認する。
     *
     * /api/admin/me 側で：
     * - Clerk userId取得
     * - Supabase profiles.clerk_user_id と照合
     * - profiles.role === admin か判定
     * を行っている。
     */
    const checkAdminRole = async () => {
      try {
        setIsCheckingAdmin(true);
        setAdminErrorMessage(null);

        const response = await fetch('/api/admin/me');
        const data = (await response.json()) as AdminMeResponse;

        /**
         * middleware.ts により未ログインは基本的にClerk側で弾かれる。
         * ただしAPIとして401が返る可能性もあるため、その場合はトップへ戻す。
         */
        if (!response.ok) {
          console.error(data);
          setAdminErrorMessage('管理者情報を確認できませんでした。');
          router.replace('/');
          return;
        }

        /**
         * ログイン済みでも profiles.role が admin でない場合は管理画面へ入れない。
         */
        if (!data.isAdmin) {
          console.warn('Admin role required:', data);
          setAdminErrorMessage('管理者権限がありません。');
          router.replace('/');
          return;
        }
      } catch (error) {
        console.error(error);
        setAdminErrorMessage('管理者権限の確認中にエラーが発生しました。');
        router.replace('/');
      } finally {
        setIsCheckingAdmin(false);
      }
    };

    checkAdminRole();
  }, [router]);

  /**
   * 管理者権限確認中は、管理画面の中身を表示しない。
   * 一瞬でも非adminに管理画面を見せないため。
   */
  if (isCheckingAdmin) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4">
        <div className="rounded-lg border bg-card p-6 text-center shadow-sm">
          <p className="text-sm font-medium text-foreground">管理者権限を確認しています...</p>
          {adminErrorMessage && (
            <p className="mt-2 text-xs text-destructive">{adminErrorMessage}</p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Mobile Header */}
      <div className="lg:hidden fixed top-0 left-0 right-0 h-14 bg-card border-b z-50 flex items-center px-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setSidebarOpen(!sidebarOpen)}
        >
          {sidebarOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </Button>
        <span className="ml-3 font-semibold">管理画面</span>
      </div>

      {/* Sidebar */}
      <aside
        className={cn(
          'fixed top-0 left-0 z-40 h-full w-64 bg-card border-r transform transition-transform duration-200 ease-in-out lg:translate-x-0',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        <div className="h-14 lg:flex items-center px-6 border-b hidden">
          <span className="font-semibold text-foreground">管理画面</span>
        </div>
        <nav className="p-4 space-y-1 mt-14 lg:mt-0">
          {navItems.map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setSidebarOpen(false)}
                className={cn(
                  'flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                )}
              >
                <item.icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>
      </aside>

      {/* Overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-30 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Main Content */}
      <main className="lg:ml-64 min-h-screen">
        <div className="p-6 lg:p-8 pt-20 lg:pt-8">{children}</div>
      </main>
    </div>
  );
}
