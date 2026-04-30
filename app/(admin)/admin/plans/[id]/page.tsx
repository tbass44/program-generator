'use client';

import { Calendar, Clock, CircleCheck as CheckCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { PageHeader, SectionCard } from '@/components/admin';

const planData = {
  id: '1',
  patientName: '山田 太郎',
  patientId: '1',
  type: 'ticket',
  name: '10回券',
  total: 10,
  used: 3,
  remaining: 7,
  purchasedAt: '2024-01-01',
  expiresAt: '2024-12-31',
};

const subscriptionData = {
  id: '2',
  patientName: '佐藤 花子',
  patientId: '2',
  type: 'subscription',
  name: '1ヶ月サブスク',
  startDate: '2024-01-01',
  endDate: '2024-01-31',
  status: 'active',
};

const usageHistory = [
  { id: '1', date: '2024-01-15', treatment: '整体マッサージ', used: 1 },
  { id: '2', date: '2024-01-08', treatment: '整体マッサージ', used: 1 },
  { id: '3', date: '2024-01-01', treatment: 'カウンセリング', used: 1 },
];

export default function AdminPlanDetailPage() {
  const isTicket = planData.type === 'ticket';

  return (
    <div className="max-w-4xl mx-auto">
      <PageHeader
        title="プラン詳細"
        description={`${planData.patientName}のプラン`}
        backHref={`/admin/patients/${planData.patientId}`}
      />

      {/* Plan Info */}
      <SectionCard className="mb-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="p-4 bg-primary/10 rounded-lg">
              {isTicket ? (
                <Calendar className="h-6 w-6 text-primary" />
              ) : (
                <Clock className="h-6 w-6 text-primary" />
              )}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <Badge>{isTicket ? '回数券' : 'サブスク'}</Badge>
                <span className="text-lg font-semibold">{planData.name}</span>
              </div>
              <p className="text-sm text-muted-foreground mt-1">
                {planData.patientName}
              </p>
            </div>
          </div>
          <Badge variant="secondary">有効</Badge>
        </div>
      </SectionCard>

      {/* Plan Details */}
      {isTicket ? (
        <SectionCard title="回数券情報" className="mb-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="text-center p-4 rounded-lg bg-primary/5">
              <p className="text-3xl font-bold text-primary">{planData.total}</p>
              <p className="text-sm text-muted-foreground mt-1">総回数</p>
            </div>
            <div className="text-center p-4 rounded-lg bg-muted">
              <p className="text-3xl font-bold">{planData.used}</p>
              <p className="text-sm text-muted-foreground mt-1">使用済み</p>
            </div>
            <div className="text-center p-4 rounded-lg bg-primary/5">
              <p className="text-3xl font-bold text-primary">
                {planData.remaining}
              </p>
              <p className="text-sm text-muted-foreground mt-1">残り回数</p>
            </div>
          </div>
          <div className="mt-4 pt-4 border-t grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-muted-foreground">購入日</p>
              <p className="font-medium">{planData.purchasedAt}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">有効期限</p>
              <p className="font-medium">{planData.expiresAt}</p>
            </div>
          </div>
        </SectionCard>
      ) : (
        <SectionCard title="サブスク情報" className="mb-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="p-4 rounded-lg bg-primary/5">
              <p className="text-sm text-muted-foreground">開始日</p>
              <p className="text-xl font-semibold mt-1">
                {subscriptionData.startDate}
              </p>
            </div>
            <div className="p-4 rounded-lg bg-primary/5">
              <p className="text-sm text-muted-foreground">終了日</p>
              <p className="text-xl font-semibold mt-1">
                {subscriptionData.endDate}
              </p>
            </div>
          </div>
          <div className="mt-4 pt-4 border-t flex items-center gap-2">
            <CheckCircle className="h-5 w-5 text-primary" />
            <span className="font-medium">利用中</span>
          </div>
        </SectionCard>
      )}

      {/* Usage History */}
      <SectionCard title="使用履歴">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>日付</TableHead>
              <TableHead>施術内容</TableHead>
              {isTicket && <TableHead>使用回数</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {usageHistory.map((usage) => (
              <TableRow key={usage.id}>
                <TableCell>{usage.date}</TableCell>
                <TableCell>{usage.treatment}</TableCell>
                {isTicket && <TableCell>{usage.used}回</TableCell>}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </SectionCard>
    </div>
  );
}
