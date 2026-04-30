'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Plus, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { PageHeader } from '@/components/admin';

const dummyPatients = [
  { id: '1', name: '山田 太郎', kana: 'ヤマダ タロウ', phone: '090-1234-5678', lastVisit: '2024-01-15', plan: '回数券 10回' },
  { id: '2', name: '佐藤 花子', kana: 'サトウ ハナコ', phone: '090-2345-6789', lastVisit: '2024-01-14', plan: 'サブスク' },
  { id: '3', name: '鈴木 一郎', kana: 'スズキ イチロウ', phone: '090-3456-7890', lastVisit: '2024-01-13', plan: 'なし' },
  { id: '4', name: '田中 美咲', kana: 'タナカ ミサキ', phone: '090-4567-8901', lastVisit: '2024-01-12', plan: '回数券 5回' },
  { id: '5', name: '高橋 健太', kana: 'タカハシ ケンタ', phone: '090-5678-9012', lastVisit: '2024-01-11', plan: 'サブスク' },
];

export default function AdminPatientsPage() {
  const [searchQuery, setSearchQuery] = useState('');

  const filteredPatients = dummyPatients.filter(
    (patient) =>
      patient.name.includes(searchQuery) ||
      patient.kana.includes(searchQuery) ||
      patient.phone.includes(searchQuery)
  );

  return (
    <div>
      <PageHeader
        title="患者管理"
        description="患者の一覧を管理"
        actions={
          <Link href="/admin/patients/new">
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              新規患者登録
            </Button>
          </Link>
        }
      />

      {/* Search */}
      <div className="mb-6">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="名前、カナ、電話番号で検索..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      {/* Table */}
      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>氏名</TableHead>
              <TableHead>カナ</TableHead>
              <TableHead>電話番号</TableHead>
              <TableHead>最終来院</TableHead>
              <TableHead>プラン</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredPatients.map((patient) => (
              <Link
                key={patient.id}
                href={`/admin/patients/${patient.id}`}
                className="cursor-pointer"
              >
                <TableRow className="hover:bg-accent/50">
                  <TableCell className="font-medium">{patient.name}</TableCell>
                  <TableCell className="text-muted-foreground">{patient.kana}</TableCell>
                  <TableCell>{patient.phone}</TableCell>
                  <TableCell>{patient.lastVisit}</TableCell>
                  <TableCell>
                    <span className="text-xs px-2 py-1 rounded-full bg-primary/10 text-primary">
                      {patient.plan}
                    </span>
                  </TableCell>
                </TableRow>
              </Link>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
