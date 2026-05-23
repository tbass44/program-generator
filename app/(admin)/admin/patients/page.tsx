'use client';

import { useEffect, useState } from 'react';
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

/**
 * /api/admin/patients から返ってくる患者情報。
 *
 * 管理画面の患者一覧で表示するための最小項目。
 * 最終来院・プランは後続STEPで visits / plans から取得する。
 */
type AdminPatient = {
  id: string;
  name: string;
  kana: string | null;
  phone: string | null;
  memo: string | null;
  line_user_id: string | null;
  line_display_name: string | null;
  line_linked_at: string | null;
  created_at: string;
  updated_at: string;
};

/**
 * 患者一覧APIのレスポンス型。
 */
type AdminPatientsResponse = {
  patients?: AdminPatient[];
  error?: string;
  detail?: unknown;
};

/**
 * 管理側：患者一覧ページ。
 *
 * 役割：
 * 1. /api/admin/patients からSupabase上の患者一覧を取得する
 * 2. 検索文字列が入力されたら q パラメータ付きで再取得する
 * 3. 患者詳細ページ /admin/patients/[id] へ遷移できるようにする
 *
 * 注意：
 * この画面は管理画面配下なので、Clerkログインとadmin roleチェックは
 * middleware.ts と app/(admin)/admin/layout.tsx 側で行っている。
 */
export default function AdminPatientsPage() {
  /**
   * 検索フォームの入力値。
   */
  const [searchQuery, setSearchQuery] = useState('');

  /**
   * APIから取得した患者一覧。
   */
  const [patients, setPatients] = useState<AdminPatient[]>([]);

  /**
   * 一覧取得中の表示制御。
   */
  const [isLoading, setIsLoading] = useState(true);

  /**
   * 一覧取得失敗時の表示メッセージ。
   */
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    /**
     * 患者一覧を取得する。
     *
     * 検索文字列がある場合は /api/admin/patients?q=... にする。
     * 検索処理はAPI側で name / kana / phone を対象に行う。
     */
    const fetchPatients = async () => {
      try {
        setIsLoading(true);
        setErrorMessage(null);

        const params = new URLSearchParams();

        if (searchQuery.trim()) {
          params.set('q', searchQuery.trim());
        }

        const url = params.toString()
          ? `/api/admin/patients?${params.toString()}`
          : '/api/admin/patients';

        const response = await fetch(url);
        const data = (await response.json()) as AdminPatientsResponse;

        if (!response.ok || !data.patients) {
          console.error(data);
          setErrorMessage('患者一覧を取得できませんでした。');
          setPatients([]);
          return;
        }

        setPatients(data.patients);
      } catch (error) {
        console.error(error);
        setErrorMessage('患者一覧の取得中にエラーが発生しました。');
        setPatients([]);
      } finally {
        setIsLoading(false);
      }
    };

    /**
     * 入力のたびに即APIを叩きすぎないよう、少し待ってから検索する。
     */
    const timerId = window.setTimeout(fetchPatients, 300);

    return () => {
      window.clearTimeout(timerId);
    };
  }, [searchQuery]);

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

      {/* Status */}
      {isLoading && (
        <div className="mb-4 rounded-lg border bg-card p-4 text-sm text-muted-foreground">
          患者一覧を読み込み中です...
        </div>
      )}

      {errorMessage && (
        <div className="mb-4 rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
          {errorMessage}
        </div>
      )}

      {/* Table */}
      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>氏名</TableHead>
              <TableHead>カナ</TableHead>
              <TableHead>電話番号</TableHead>
              <TableHead>LINE連携</TableHead>
              <TableHead>登録日</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {!isLoading && patients.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="py-8 text-center text-sm text-muted-foreground">
                  患者データがありません。
                </TableCell>
              </TableRow>
            )}

            {patients.map((patient) => (
              <TableRow key={patient.id} className="hover:bg-accent/50">
                <TableCell className="font-medium">
                  <Link href={`/admin/patients/${patient.id}`} className="hover:underline">
                    {patient.name}
                  </Link>
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {patient.kana || '未登録'}
                </TableCell>
                <TableCell>{patient.phone || '未登録'}</TableCell>
                <TableCell>
                  <span className={patient.line_user_id
                    ? 'text-xs px-2 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200'
                    : 'text-xs px-2 py-1 rounded-full bg-muted text-muted-foreground border'
                  }>
                    {patient.line_user_id ? '連携済み' : '未連携'}
                  </span>
                </TableCell>
                <TableCell>
                  {new Date(patient.created_at).toLocaleDateString('ja-JP')}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
