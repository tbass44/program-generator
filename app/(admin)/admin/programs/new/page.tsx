'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Copy,
  Save,
  Sparkles,
  PenLine,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { PageHeader, SectionCard } from '@/components/admin';
import { toast } from 'sonner';

type Mode = 'ai' | 'manual';

type AdminPatientListItem = {
  id: string;
  name: string;
  kana: string | null;
  phone: string | null;
  memo: string | null;
  line_user_id: string | null;
  line_display_name: string | null;
  created_at: string;
  updated_at: string;
};

type PatientsResponse = {
  patients?: AdminPatientListItem[];
  error?: string;
  detail?: unknown;
};

type CreateProgramResponse = {
  program?: {
    id: string;
    patient_id: string;
  };
  error?: string;
  detail?: unknown;
};

/**
 * 管理側：改善プログラム新規作成ページ。
 *
 * MVPではAI生成ではなく、手動入力した改善プログラムをSupabaseへ保存する。
 * 患者詳細ページから来た場合は、URLの patientId を読み取って患者選択を自動反映する。
 */
export default function AdminProgramNewPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const patientIdFromQuery = searchParams.get('patientId') ?? '';

  const [mode, setMode] = useState<Mode>('manual');
  const [patients, setPatients] = useState<AdminPatientListItem[]>([]);
  const [selectedPatient, setSelectedPatient] = useState<string>(patientIdFromQuery);
  const [status, setStatus] = useState<string>('');
  const [memo, setMemo] = useState('');
  const [manualSummary, setManualSummary] = useState('');
  const [manualShortTerm, setManualShortTerm] = useState('');
  const [manualLongTerm, setManualLongTerm] = useState('');
  const [isLoadingPatients, setIsLoadingPatients] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const selectedPatientName = useMemo(() => {
    return patients.find((patient) => patient.id === selectedPatient)?.name ?? '';
  }, [patients, selectedPatient]);

  /**
   * 患者一覧を取得する。
   * ダミー患者ではなく、実際に登録済みのpatientsから選択できるようにする。
   */
  useEffect(() => {
    const fetchPatients = async () => {
      try {
        setIsLoadingPatients(true);
        setErrorMessage(null);

        const response = await fetch('/api/admin/patients');
        const data = (await response.json()) as PatientsResponse;

        if (!response.ok || !data.patients) {
          console.error(data);
          setErrorMessage('患者一覧を取得できませんでした。');
          return;
        }

        setPatients(data.patients);

        /**
         * URLに patientId がある場合は、患者詳細からの作成として自動選択する。
         */
        if (patientIdFromQuery) {
          setSelectedPatient(patientIdFromQuery);
        }
      } catch (error) {
        console.error(error);
        setErrorMessage('患者一覧の取得中にエラーが発生しました。');
      } finally {
        setIsLoadingPatients(false);
      }
    };

    fetchPatients();
  }, [patientIdFromQuery]);

  const handleCopy = () => {
    const text = [
      status ? ['【状態】', status].join('\n') : '',
      memo ? ['【メモ】', memo].join('\n') : '',
      ['【状態まとめ】', manualSummary].join('\n'),
      ['【短期プログラム（3カ月）】', manualShortTerm].join('\n'),
      manualLongTerm ? ['【長期プログラム】', manualLongTerm].join('\n') : '',
    ]
      .filter(Boolean)
      .join('\n\n');

    navigator.clipboard.writeText(text);
    toast.success('クリップボードにコピーしました');
  };

  /**
   * 手動入力した改善プログラムをSupabaseへ保存する。
   */
  const handleSave = async () => {
    if (!selectedPatient) {
      setErrorMessage('患者を選択してください。');
      return;
    }

    if (!manualSummary.trim()) {
      setErrorMessage('状態まとめを入力してください。');
      return;
    }

    if (!manualShortTerm.trim()) {
      setErrorMessage('短期プログラムを入力してください。');
      return;
    }

    try {
      setIsSaving(true);
      setErrorMessage(null);

      const response = await fetch('/api/admin/programs', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          patientId: selectedPatient,
          status,
          memo,
          summary: manualSummary,
          shortTermProgram: manualShortTerm,
          longTermProgram: manualLongTerm,
        }),
      });

      const data = (await response.json()) as CreateProgramResponse;

      if (!response.ok || !data.program) {
        console.error(data);
        setErrorMessage('改善プログラムを保存できませんでした。');
        return;
      }

      toast.success('改善プログラムを保存しました');
      router.push(`/admin/programs/${data.program.id}#product-recommendations`);
    } catch (error) {
      console.error(error);
      setErrorMessage('改善プログラムの保存中にエラーが発生しました。');
    } finally {
      setIsSaving(false);
    }
  };

  const canSaveManual =
    selectedPatient !== '' &&
    manualSummary.trim() !== '' &&
    manualShortTerm.trim() !== '' &&
    !isSaving;

  return (
    <div className="max-w-4xl mx-auto">
      <PageHeader
        title="改善プログラム作成"
        description="改善プログラムを手動入力し、保存後に実際の商品を提案"
        backHref={selectedPatient ? `/admin/patients/${selectedPatient}` : '/admin/dashboard'}
      />

      {errorMessage && (
        <div className="mb-4 rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
          {errorMessage}
        </div>
      )}

      {/* Mode Toggle */}
      <SectionCard className="mb-6">
        <div className="flex items-center gap-2">
          <Button
            variant={mode === 'ai' ? 'default' : 'outline'}
            disabled
            className="flex-1 opacity-60 cursor-not-allowed"
          >
            <Sparkles className="h-4 w-4 mr-2" />
            AI生成モード（今後追加予定）
          </Button>
          <Button
            variant={mode === 'manual' ? 'default' : 'outline'}
            onClick={() => setMode('manual')}
            className="flex-1"
          >
            <PenLine className="h-4 w-4 mr-2" />
            手動入力モード
          </Button>
        </div>
        <p className="text-xs text-muted-foreground mt-2">
          管理者が直接プログラム内容を入力して保存します
        </p>
      </SectionCard>

      {/* Patient Selection */}
      <SectionCard title="患者選択" className="mb-6">
        <div className="space-y-2">
          <Label htmlFor="patient">患者</Label>
          <Select
            value={selectedPatient}
            onValueChange={setSelectedPatient}
            disabled={isLoadingPatients || Boolean(patientIdFromQuery)}
          >
            <SelectTrigger id="patient">
              <SelectValue placeholder={isLoadingPatients ? '患者を読み込み中です' : '患者を選択してください'} />
            </SelectTrigger>
            <SelectContent>
              {patients.map((patient) => (
                <SelectItem key={patient.id} value={patient.id}>
                  {patient.name}{patient.kana ? `（${patient.kana}）` : ''}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {patientIdFromQuery && selectedPatientName && (
            <p className="text-xs text-muted-foreground">
              患者詳細から作成しているため、対象患者を「{selectedPatientName}」で固定しています。
            </p>
          )}
        </div>
      </SectionCard>

      {/* Status & Memo */}
      <SectionCard title="状態・メモ" className="mb-6">
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="status">状態</Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger id="status">
                <SelectValue placeholder="状態を選択（任意）" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="初回">初回</SelectItem>
                <SelectItem value="継続中">継続中</SelectItem>
                <SelectItem value="改善傾向">改善傾向</SelectItem>
                <SelectItem value="要フォロー">要フォロー</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="memo">メモ</Label>
            <Textarea
              id="memo"
              placeholder="患者の状態や要望を入力"
              value={memo}
              onChange={(e) => setMemo(e.target.value)}
              rows={4}
            />
          </div>
        </div>
      </SectionCard>

      <SectionCard title="状態まとめ" className="mb-6">
        <div className="space-y-2">
          <Label htmlFor="summary">状態まとめ</Label>
          <Textarea
            id="summary"
            placeholder="患者の状態をまとめて入力してください"
            value={manualSummary}
            onChange={(e) => setManualSummary(e.target.value)}
            rows={5}
          />
        </div>
      </SectionCard>

      <SectionCard title="短期プログラム（3カ月）" className="mb-6">
        <div className="space-y-2">
          <Label htmlFor="shortTerm">短期プログラム内容</Label>
          <Textarea
            id="shortTerm"
            placeholder="3カ月間の改善プログラムを入力してください"
            value={manualShortTerm}
            onChange={(e) => setManualShortTerm(e.target.value)}
            rows={8}
          />
        </div>
      </SectionCard>

      <SectionCard title="長期プログラム" className="mb-6">
        <div className="space-y-2">
          <Label htmlFor="longTerm">長期プログラム内容</Label>
          <Textarea
            id="longTerm"
            placeholder="長期的な改善プログラムを入力してください"
            value={manualLongTerm}
            onChange={(e) => setManualLongTerm(e.target.value)}
            rows={6}
          />
        </div>
      </SectionCard>

      <SectionCard title="商品提案はプログラム保存後に登録" className="mb-6">
        <p className="text-sm text-muted-foreground">
          「保存」を押すと、この患者さんの改善プログラム詳細画面へ移動します。
          続けて「商品提案」から、登録済みの商品マスターを使って商品・提案理由・数量や期間の目安を保存できます。
        </p>
        <p className="mt-2 text-xs text-muted-foreground">
          仮の商品候補は保存されないため、この画面では表示しません。
          商品はプログラム保存後に実際のマスターから選んでください。
        </p>
      </SectionCard>

      <div className="flex gap-3 pb-8">
        <Button onClick={handleSave} disabled={!canSaveManual}>
          <Save className="h-4 w-4 mr-2" />
          {isSaving ? '保存中...' : '保存'}
        </Button>
        <Button variant="outline" onClick={handleCopy}>
          <Copy className="h-4 w-4 mr-2" />
          コピー
        </Button>
      </div>

      {!canSaveManual && (
        <p className="pb-8 text-sm text-muted-foreground">
          患者を選択し、状態まとめと短期プログラムを入力してください
        </p>
      )}
    </div>
  );
}
