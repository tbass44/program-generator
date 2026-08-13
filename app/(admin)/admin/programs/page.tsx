'use client';

import Link from 'next/link';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PageHeader, SectionCard } from '@/components/admin';

/**
 * 管理側：改善プログラム一覧ページ。
 *
 * まず /admin/programs のルートがVercel上で確実に認識されるかを確認するため、
 * 一時的にシンプルな画面にしている。
 * ルート表示が確認できた後で、Supabase実データ一覧を戻す。
 */
export default function AdminProgramsPage() {
  return (
    <div>
      <PageHeader
        title="改善プログラム"
        description="作成済みの改善プログラムを一覧で確認します"
        actions={
          <Link href="/admin/programs/new">
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              新規作成
            </Button>
          </Link>
        }
      />

      <SectionCard title="改善プログラム一覧">
        <div className="space-y-3 text-sm">
          <p>このページが表示されれば、/admin/programs のルーティングは正常です。</p>
          <p className="text-muted-foreground">
            次の修正で、Supabaseに保存済みの改善プログラム一覧をここに表示します。
          </p>
        </div>
      </SectionCard>
    </div>
  );
}
