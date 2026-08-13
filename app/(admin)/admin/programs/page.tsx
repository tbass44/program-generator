'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { FileText, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { PageHeader, SectionCard, EmptyState } from '@/components/admin';

/**
 * /api/admin/programs から返る改善プログラム一覧の1件分。
 */
type AdminProgramListItem = {
  id: string;
  patient_id: string;
  create_mode: 'manual' | 'ai';
  memo: string | null;
  summary: string | null;
  short_term_program: string | null;
  long_term_program: string | null;
  today_task: string | null;
  program_text: string | null;
  created_at: string;
  updated_at: string;
  patients: {
    id: string;
    name: string;
    kana: string | null;
  } | null;
};

/**
 * 改善プログラム一覧APIのレスポンス型。
 */
type ProgramsResponse = {
  programs?: AdminProgramListItem[];
  error?: string;
  detail?: unknown;
};

/**
 * 管理側：改善プログラム一覧ページ。
 *
 * 役割：
 * - Supabaseのprogramsを新しい順に表示する
 * - 患者名、作成日、状態まとめを一覧で確認できるようにする
 * - 詳細ページ、患者詳細ページへ移動できるようにする
 */
export default function AdminProgramsPage() {
  /**
   * APIから取得した改善プログラム一覧。
   */
  const [programs, setPrograms] = useState<AdminProgramListItem[]>([]);

  /**
   * 読み込み中表示用。
   */
  const [isLoading, setIsLoading] = useState(true);

  /**
   * 取得失敗時のメッセージ。
   */
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    /**
     * 改善プログラム一覧を取得する。
     */
    const fetchPrograms = async () => {
      try {
        setIsLoading(true);
        setErrorMessage(null);

        const response = await fetch('/api/admin/programs');
        const data = (await response.json()) as ProgramsResponse;

        if (!response.ok || !data.programs) {
          console.error(data);
          setErrorMessage('改善プログラム一覧を取得できませんでした。');
          setPrograms([]);
          return;
        }

        setPrograms(data.programs);
      } catch (error) {
        console.error(error);
        setErrorMessage('改善プログラム一覧の取得中にエラーが発生しました。');
        setPrograms([]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchPrograms();
  }, []);

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

      {errorMessage && (
        <div className="mb-4 rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
          {errorMessage}
        </div>
      )}

      <SectionCard>
        {isLoading ? (
          <div className="text-sm text-muted-foreground">改善プログラムを読み込み中です...</div>
        ) : programs.length === 0 ? (
          <EmptyState
            title="改善プログラムはまだありません"
            description="患者詳細ページ、または新規作成ボタンから改善プログラムを作成してください。"
            action={
              <Link href="/admin/programs/new">
                <Button size="sm">新規作成</Button>
              </Link>
            }
          />
        ) : (
          <div className="space-y-3">
            {programs.map((program) => {
              const patientName = program.patients?.name ?? '患者情報なし';
              const patientKana = program.patients?.kana ?? '';
              const createdAt = new Date(program.created_at).toLocaleDateString('ja-JP');

              return (
                <div
                  key={program.id}
                  className="rounded-lg border p-4 transition-colors hover:bg-accent/40"
                >
                  <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <FileText className="h-4 w-4 text-muted-foreground" />
                        <Link
                          href={`/admin/programs/${program.id}`}
                          className="font-medium text-primary hover:underline"
                        >
                          {patientName} の改善プログラム
                        </Link>
                        <Badge variant="secondary">
                          {program.create_mode === 'manual' ? '手動作成' : 'AI作成'}
                        </Badge>
                      </div>

                      {patientKana && (
                        <p className="mt-1 text-xs text-muted-foreground">{patientKana}</p>
                      )}

                      <p className="mt-3 line-clamp-2 text-sm text-muted-foreground">
                        {program.summary || '状態まとめは未入力です。'}
                      </p>

                      {program.short_term_program && (
                        <p className="mt-2 line-clamp-2 text-xs text-muted-foreground">
                          短期：{program.short_term_program}
                        </p>
                      )}
                    </div>

                    <div className="flex shrink-0 flex-col gap-2 md:items-end">
                      <p className="text-xs text-muted-foreground">作成日: {createdAt}</p>
                      <div className="flex flex-wrap gap-2">
                        <Link href={`/admin/programs/${program.id}`}>
                          <Button variant="outline" size="sm">
                            詳細
                          </Button>
                        </Link>
                        <Link href={`/admin/patients/${program.patient_id}`}>
                          <Button variant="outline" size="sm">
                            患者詳細
                          </Button>
                        </Link>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </SectionCard>
    </div>
  );
}
