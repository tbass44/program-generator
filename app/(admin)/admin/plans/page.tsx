'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { PageHeader, EmptyState } from '@/components/admin';

/**
 * /api/admin/plans から返るプラン情報。
 */
type PlanListItem = {
  id: string;
  patientId: string;
  patientName: string;
  patientKana: string;
  type: '回数券' | 'サブスク';
  name: string;
  totalCount: number | null;
  remainingCount: number | null;
  startDate: string | null;
  endDate: string | null;
  status: '有効' | '期限切れ' | '停止';
  createdAt: string;
  updatedAt: string;
};

type PlansResponse = {
  plans?: PlanListItem[];
  error?: string;
  detail?: unknown;
};

const statusConfig: Record<PlanListItem['status'], string> = {
  '有効': 'bg-emerald-50 text-emerald-700 border-emerald-200',
  '期限切れ': 'bg-gray-50 text-gray-600 border-gray-200',
  '停止': 'bg-red-50 text-red-700 border-red-200',
};

function formatApiError(status: number, data: PlansResponse) {
  const detail = typeof data.detail === 'string' ? ` / detail: ${data.detail}` : '';
  return `プラン一覧を取得できませんでした（HTTP ${status} / error: ${data.error ?? 'unknown'}${detail}）`;
}

function formatDate(value: string | null) {
  if (!value) {
    return '-';
  }

  return new Date(value).toLocaleDateString('ja-JP');
}

export default function AdminPlansPage() {
  const [plans, setPlans] = useState<PlanListItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    const fetchPlans = async () => {
      try {
        setIsLoading(true);
        setErrorMessage(null);

        const response = await fetch('/api/admin/plans');
        const data = (await response.json()) as PlansResponse;

        if (!response.ok || !data.plans) {
          setErrorMessage(formatApiError(response.status, data));
          setPlans([]);
          return;
        }

        setPlans(data.plans);
      } catch (error) {
        console.error(error);
        setErrorMessage('プラン一覧の取得中にエラーが発生しました。');
        setPlans([]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchPlans();
  }, []);

  return (
    <div>
      <PageHeader
        title="プラン管理"
        description="回数券・サブスクプランを管理します"
        actions={
          <Link href="/admin/plans/new">
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              新規プラン作成
            </Button>
          </Link>
        }
      />

      {errorMessage && (
        <div className="mb-4 rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
          {errorMessage}
        </div>
      )}

      <div className="rounded-lg border bg-card">
        {isLoading ? (
          <div className="p-6 text-sm text-muted-foreground">プラン一覧を読み込み中です...</div>
        ) : plans.length === 0 ? (
          <div className="p-6">
            <EmptyState
              title="プランはまだ登録されていません"
              description="患者に回数券・サブスクを紐づけると、ここに表示されます。"
              action={
                <Link href="/admin/plans/new">
                  <Button size="sm">新規プラン作成</Button>
                </Link>
              }
            />
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>患者名</TableHead>
                <TableHead>プランタイプ</TableHead>
                <TableHead>プラン名</TableHead>
                <TableHead>残回数</TableHead>
                <TableHead>開始日</TableHead>
                <TableHead>終了日</TableHead>
                <TableHead>ステータス</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {plans.map((plan) => (
                <TableRow key={plan.id}>
                  <TableCell>
                    <Link
                      href={`/admin/patients/${plan.patientId}`}
                      className="font-medium text-primary hover:underline"
                    >
                      {plan.patientName}
                    </Link>
                    {plan.patientKana && (
                      <p className="text-xs text-muted-foreground">{plan.patientKana}</p>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary">{plan.type}</Badge>
                  </TableCell>
                  <TableCell className="font-medium">{plan.name}</TableCell>
                  <TableCell>
                    {plan.type === '回数券' ? (
                      <span className="font-medium">
                        {plan.remainingCount ?? 0} / {plan.totalCount ?? 0}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </TableCell>
                  <TableCell>{formatDate(plan.startDate)}</TableCell>
                  <TableCell>{formatDate(plan.endDate)}</TableCell>
                  <TableCell>
                    <Badge className={statusConfig[plan.status]} variant="outline">
                      {plan.status}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
}
