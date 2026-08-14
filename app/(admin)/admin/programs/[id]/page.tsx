'use client';

import { useEffect, useState } from 'react';
import { ArrowLeft, Edit, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { PageHeader, SectionCard, ProgramSection } from '@/components/admin';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

type ProgramDetail = {
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
};

type ProgramPatient = {
  id: string;
  name: string;
  kana: string | null;
  phone: string | null;
};

type ProgramDetailResponse = {
  program?: ProgramDetail;
  patient?: ProgramPatient | null;
  error?: string;
  detail?: unknown;
};

function formatApiError(status: number, data: ProgramDetailResponse) {
  const detail = typeof data.detail === 'string' ? ` / detail: ${data.detail}` : '';
  return `改善プログラムを取得できませんでした（HTTP ${status} / error: ${data.error ?? 'unknown'}${detail}）`;
}

export default function AdminProgramDetailPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const [program, setProgram] = useState<ProgramDetail | null>(null);
  const [patient, setPatient] = useState<ProgramPatient | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    const fetchProgram = async () => {
      try {
        setIsLoading(true);
        setErrorMessage(null);

        const response = await fetch(`/api/admin/programs/${params.id}`);
        const data = (await response.json()) as ProgramDetailResponse;

        if (!response.ok || !data.program) {
          setErrorMessage(formatApiError(response.status, data));
          setProgram(null);
          setPatient(null);
          return;
        }

        setProgram(data.program);
        setPatient(data.patient ?? null);
      } catch (error) {
        console.error(error);
        setErrorMessage('改善プログラムの取得中にエラーが発生しました。');
        setProgram(null);
        setPatient(null);
      } finally {
        setIsLoading(false);
      }
    };

    fetchProgram();
  }, [params.id]);

    /**
   * 改善プログラム削除処理。
   *
   * 削除は元に戻しにくい操作なので、
   * APIを呼ぶ前にブラウザ標準の確認ダイアログを出す。
   */
  const handleDelete = async () => {
    const ok = window.confirm(
      'この改善プログラムを削除します。削除すると元に戻せません。よろしいですか？'
    );

    if (!ok) {
      return;
    }

    try {
      setIsDeleting(true);

      /**
       * 詳細表示中のprogram idを使ってDELETE APIを呼ぶ。
       * 権限確認・UUIDチェック・存在確認はAPI側で行う。
       */
      const response = await fetch(`/api/admin/programs/${params.id}`, {
        method: 'DELETE',
      });

      const data = await response.json();

      /**
       * API側は削除成功時に deleted: true を返す。
       * これが無い場合は、HTTP 200でも想定外としてエラー扱いにする。
       */
      if (!response.ok || !data.deleted) {
        toast.error('改善プログラムを削除できませんでした');
        setErrorMessage(
          `削除に失敗しました（HTTP ${response.status} / error: ${data.error ?? 'unknown'}）`
        );
        return;
      }

      toast.success('改善プログラムを削除しました');

      /**
       * 削除後は詳細ページに残れないため、一覧へ戻す。
       * refreshも呼び、一覧側のキャッシュが残る可能性を下げる。
       */
      router.push('/admin/programs');
      router.refresh();
    } catch (error) {
      console.error(error);
      toast.error('改善プログラムを削除できませんでした');
      setErrorMessage('改善プログラムの削除中にエラーが発生しました。');
    } finally {
      setIsDeleting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="max-w-4xl mx-auto">
        <PageHeader
          title="改善プログラム詳細"
          description="改善プログラムを読み込み中です"
          backHref="/admin/programs"
        />
        <SectionCard>
          <p className="text-sm text-muted-foreground">読み込み中です...</p>
        </SectionCard>
      </div>
    );
  }

  if (errorMessage || !program) {
    return (
      <div className="max-w-4xl mx-auto">
        <PageHeader
          title="改善プログラム詳細"
          description="改善プログラムを取得できませんでした"
          backHref="/admin/programs"
        />
        <SectionCard>
          <p className="text-sm text-destructive">
            {errorMessage ?? '改善プログラムが見つかりませんでした。'}
          </p>
        </SectionCard>
      </div>
    );
  }

  const patientName = patient?.name ?? '患者情報なし';
  const createdAt = new Date(program.created_at).toLocaleDateString('ja-JP');

  return (
    <div className="max-w-4xl mx-auto">
      <PageHeader
        title="改善プログラム詳細"
        description={`${patientName} - ${createdAt}`}
        backHref="/admin/programs"
        actions={
          <div className="flex items-center gap-2">
            <Link href={`/admin/programs/${program.id}/edit`}>
              <Button>
                <Edit className="h-4 w-4 mr-2" />
                編集
              </Button>
            </Link>

            {/*
              削除ボタン。
              削除処理中はdisabledにして、二重削除を防ぐ。
            */}
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={isDeleting}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              {isDeleting ? '削除中...' : '削除'}
            </Button>
          </div>
        }
      />

      <SectionCard className="mb-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm text-muted-foreground">患者名</p>
            {patient ? (
              <Link
                href={`/admin/patients/${patient.id}`}
                className="font-medium text-primary hover:underline"
              >
                {patient.name}
              </Link>
            ) : (
              <p className="font-medium">患者情報なし</p>
            )}
            {patient?.kana && (
              <p className="text-xs text-muted-foreground">カナ: {patient.kana}</p>
            )}
          </div>

          <div className="md:text-right">
            <p className="text-sm text-muted-foreground">作成日</p>
            <p className="font-medium">{createdAt}</p>
            <p className="text-xs text-muted-foreground">
              作成方法: {program.create_mode === 'manual' ? '手動作成' : 'AI作成'}
            </p>
          </div>
        </div>
      </SectionCard>

      <SectionCard title="状態メモ" className="mb-6">
        <p className="whitespace-pre-wrap text-sm">
          {program.memo || '状態メモは未入力です。'}
        </p>
      </SectionCard>

      <div className="space-y-4 mb-6">
        <ProgramSection
          title="状態まとめ"
          content={program.summary || '状態まとめは未入力です。'}
        />
        <ProgramSection
          title="短期プログラム（3カ月）"
          content={program.short_term_program || '短期プログラムは未入力です。'}
        />
        <ProgramSection
          title="長期プログラム"
          content={program.long_term_program || '長期プログラムは未入力です。'}
        />
        <ProgramSection
          title="今日やること"
          content={program.today_task || '今日やることは未入力です。'}
        />
      </div>

      <div className="flex items-center gap-4">
        <Link href="/admin/programs">
          <Button variant="outline">
            <ArrowLeft className="h-4 w-4 mr-2" />
            一覧へ戻る
          </Button>
        </Link>

        {patient && (
          <Link href={`/admin/patients/${patient.id}`}>
            <Button variant="outline">患者詳細へ</Button>
          </Link>
        )}
      </div>
    </div>
  );
}