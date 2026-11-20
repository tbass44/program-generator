'use client';

import Link from 'next/link';
import { Users, FileText, CreditCard } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { PageHeader } from '@/components/admin';

/**
 * 管理ダッシュボード。
 * 初期サンプルにあった固定の患者・商品提案・プログラムなどは表示しない。
 * 実データ連動の一覧が必要になった場合は認証済みAPIから取得する。
 */
export default function AdminDashboardPage() {
  return (
    <div>
      <PageHeader title="ダッシュボード" description="管理画面の概要" />

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <Link href="/admin/patients/new">
          <Card className="hover:shadow-md transition-shadow cursor-pointer">
            <CardContent className="flex items-center gap-4 p-6">
              <div className="p-3 bg-primary/10 rounded-lg">
                <Users className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="font-medium">新規患者登録</p>
                <p className="text-sm text-muted-foreground">患者を追加</p>
              </div>
            </CardContent>
          </Card>
        </Link>

        <Link href="/admin/programs/new">
          <Card className="hover:shadow-md transition-shadow cursor-pointer">
            <CardContent className="flex items-center gap-4 p-6">
              <div className="p-3 bg-primary/10 rounded-lg">
                <FileText className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="font-medium">改善プログラム作成</p>
                <p className="text-sm text-muted-foreground">AI提案を生成</p>
              </div>
            </CardContent>
          </Card>
        </Link>

        <Link href="/admin/plans/new">
          <Card className="hover:shadow-md transition-shadow cursor-pointer">
            <CardContent className="flex items-center gap-4 p-6">
              <div className="p-3 bg-primary/10 rounded-lg">
                <CreditCard className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="font-medium">プラン作成</p>
                <p className="text-sm text-muted-foreground">プランを追加</p>
              </div>
            </CardContent>
          </Card>
        </Link>
      </div>


    </div>
  );
}
