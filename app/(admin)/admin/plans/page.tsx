'use client';

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
import { PageHeader } from '@/components/admin';

const dummyPlans = [
  { id: '1', patientName: '山田 太郎', patientId: '1', type: '回数券', name: '10回券', remaining: 7, total: 10, startDate: '2024-01-01', endDate: '2024-12-31', status: '有効' },
  { id: '2', patientName: '佐藤 花子', patientId: '2', type: 'サブスク', name: '1ヶ月サブスク', remaining: null, total: null, startDate: '2024-01-01', endDate: '2024-01-31', status: '有効' },
  { id: '3', patientName: '鈴木 一郎', patientId: '3', type: '回数券', name: '5回券', remaining: 2, total: 5, startDate: '2023-12-01', endDate: '2024-06-01', status: '有効' },
  { id: '4', patientName: '田中 美咲', patientId: '4', type: 'サブスク', name: '3ヶ月サブスク', remaining: null, total: null, startDate: '2024-01-01', endDate: '2024-03-31', status: '有効' },
  { id: '5', patientName: '高橋 健太', patientId: '5', type: '回数券', name: '20回券', remaining: 0, total: 20, startDate: '2023-06-01', endDate: '2023-12-01', status: '期限切れ' },
];

const statusConfig: Record<string, string> = {
  '有効': 'bg-emerald-50 text-emerald-700 border-emerald-200',
  '期限切れ': 'bg-gray-50 text-gray-600 border-gray-200',
};

export default function AdminPlansPage() {
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

      <div className="rounded-lg border bg-card">
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
            {dummyPlans.map((plan) => (
              <TableRow key={plan.id}>
                <TableCell>
                  <Link
                    href={`/admin/patients/${plan.patientId}`}
                    className="font-medium text-primary hover:underline"
                  >
                    {plan.patientName}
                  </Link>
                </TableCell>
                <TableCell>
                  <Badge variant="secondary">{plan.type}</Badge>
                </TableCell>
                <TableCell className="font-medium">{plan.name}</TableCell>
                <TableCell>
                  {plan.type === '回数券' ? (
                    <span className="font-medium">
                      {plan.remaining} / {plan.total}
                    </span>
                  ) : (
                    <span className="text-muted-foreground">-</span>
                  )}
                </TableCell>
                <TableCell>{plan.startDate}</TableCell>
                <TableCell>{plan.endDate}</TableCell>
                <TableCell>
                  <Link href={`/admin/plans/${plan.id}`}>
                    <Badge className={statusConfig[plan.status]} variant="outline">
                      {plan.status}
                    </Badge>
                  </Link>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
