'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { PageHeader, SectionCard } from '@/components/admin';

export default function AdminProgramDetailPage() {
  const params = useParams();
  const programId = typeof params.programId === 'string' ? params.programId : '';

  return (
    <div className="max-w-4xl mx-auto">
      <PageHeader
        title="改善プログラム詳細"
        description="詳細ページ"
        backHref="/admin/programs"
      />
      <SectionCard title="改善プログラムID">
        <p className="text-sm text-muted-foreground">{programId}</p>
        <div className="mt-4">
          <Link href="/admin/programs">
            <Button variant="outline">一覧へ戻る</Button>
          </Link>
        </div>
      </SectionCard>
    </div>
  );
}
