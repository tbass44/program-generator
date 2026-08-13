'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { PageHeader, SectionCard } from '@/components/admin';
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

export default function AdminProgramEditPage({ params }: { params: { id: string } }) {
  const router = useRouter();

  const [patient, setPatient] = useState<ProgramPatient | null>(null);
  const [memo, setMemo] = useState('');
  const [summary, setSummary] = useState('');
  const [shortTermProgram, setShortTermProgram] = useState('');
  const [longTermProgram, setLongTermProgram] = useState('');
  const [todayTask, setTodayTask] = useState('');

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    const fetchProgram = async () => {
      try {
        setIsLoading(true);
        setErrorMessage(null);

        const response = await fetch(`/api/admin/programs/${params.id}`);
        const data = (await response.json()) as ProgramDetailResponse;

        if (!response.ok || !data.program) {
          setErrorMessage(formatApiError(response.status, data));
          return;
        }

        setPatient(data.patient ?? null);
        setMemo(data.program.memo ?? '');
        setSummary(data.program.summary ?? '');
        setShortTermProgram(data.program.short_term_program ?? '');
        setLongTermProgram(data.program.long_term_program ?? '');
        setTodayTask(data.program.today_task ?? '');
      } catch (error) {
        console.error(error);
        setErrorMessage('改善プログラムの取得中にエラーが発生しました。');
      } finally {
        setIsLoading(false);
      }
    };

    fetchProgram();
  }, [params.id]);

  const handleSave = async () => {
    if (!summary.trim()) {
      toast.error('状態まとめを入力してください');
      return;
    }

    if (!shortTermProgram.trim()) {
      toast.error('短期プログラムを入力してください');
      return;
    }

    try {
      setIsSaving(true);

      const response = await fetch(`/api/admin/programs/${params.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          memo,
          summary,
          shortTermProgram,
          longTermProgram,
          todayTask,
        }),
      });

      const data = (await response.json()) as ProgramDetailResponse;

      if (!response.ok || !data.program) {
        setErrorMessage(formatApiError(response.status, data));
        toast.error('改善プログラムを更新できませんでした');
        return;
      }

      toast.success('改善プログラムを更新しました');
      router.push(`/admin/programs/${params.id}`);
      router.refresh();
    } catch (error) {
      console.error(error);
      setErrorMessage('改善プログラムの更新中にエラーが発生しました。');
      toast.error('改善プログラムを更新できませんでした');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="max-w-4xl mx-auto">
        <PageHeader
          title="改善プログラム編集"
          description="改善プログラムを読み込み中です"
          backHref={`/admin/programs/${params.id}`}
        />
        <SectionCard>
          <p className="text-sm text-muted-foreground">読み込み中です...</p>
        </SectionCard>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      <PageHeader
        title="改善プログラム編集"
        description={patient ? `${patient.name}のプログラムを編集` : '改善プログラムを編集'}
        backHref={`/admin/programs/${params.id}`}
      />

      {errorMessage && (
        <div className="mb-4 rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
          {errorMessage}
        </div>
      )}

      <SectionCard className="mb-6">
        <div className="flex items-center gap-4">
          <div className="rounded-lg bg-primary/10 p-3">
            <span className="text-sm font-medium text-primary">
              {patient?.name ?? '患者情報なし'}
            </span>
          </div>
          {patient?.kana && (
            <p className="text-xs text-muted-foreground">カナ: {patient.kana}</p>
          )}
        </div>
      </SectionCard>

      <SectionCard title="状態メモ" className="mb-6">
        <div className="space-y-2">
          <Label htmlFor="memo">状態・要望</Label>
          <Textarea
            id="memo"
            value={memo}
            onChange={(e) => setMemo(e.target.value)}
            placeholder="患者の状態や要望を入力"
            className="min-h-[80px]"
          />
        </div>
      </SectionCard>

      <SectionCard title="状態まとめ" className="mb-6">
        <div className="space-y-2">
          <Label htmlFor="summary">状態まとめ</Label>
          <Textarea
            id="summary"
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
            className="min-h-[80px]"
          />
        </div>
      </SectionCard>

      <SectionCard title="短期プログラム（3カ月）" className="mb-6">
        <div className="space-y-2">
          <Label htmlFor="shortTermProgram">短期プログラム内容</Label>
          <Textarea
            id="shortTermProgram"
            value={shortTermProgram}
            onChange={(e) => setShortTermProgram(e.target.value)}
            className="min-h-[200px] font-mono text-sm"
          />
        </div>
      </SectionCard>

      <SectionCard title="長期プログラム" className="mb-6">
        <div className="space-y-2">
          <Label htmlFor="longTermProgram">長期プログラム内容</Label>
          <Textarea
            id="longTermProgram"
            value={longTermProgram}
            onChange={(e) => setLongTermProgram(e.target.value)}
            className="min-h-[150px] font-mono text-sm"
          />
        </div>
      </SectionCard>

      <SectionCard title="今日やること" className="mb-6">
        <div className="space-y-2">
          <Label htmlFor="todayTask">今日やること</Label>
          <Textarea
            id="todayTask"
            value={todayTask}
            onChange={(e) => setTodayTask(e.target.value)}
            className="min-h-[120px] font-mono text-sm"
          />
        </div>
      </SectionCard>

      <div className="flex items-center gap-4">
        <Button onClick={handleSave} disabled={isSaving}>
          <Save className="h-4 w-4 mr-2" />
          {isSaving ? '保存中...' : '保存'}
        </Button>
        <Button
          variant="outline"
          onClick={() => router.push(`/admin/programs/${params.id}`)}
          disabled={isSaving}
        >
          キャンセル
        </Button>
      </div>
    </div>
  );
}