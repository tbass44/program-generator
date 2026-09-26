'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { PageHeader, SectionCard } from '@/components/admin';
import { toast } from 'sonner';

type PatientOption = {
  id: string;
  name: string;
  kana: string | null;
  phone: string | null;
};

type PatientsResponse = {
  patients?: PatientOption[];
  error?: string;
  detail?: unknown;
};

type PlanResponse = {
  plan?: {
    id: string;
    patientId: string;
    patientName: string;
    type: '回数券' | 'サブスク';
    name: string;
  };
  error?: string;
  detail?: unknown;
};

type PlanFormData = {
  patientId: string;
  name: string;
  totalCount: string;
  remainingCount: string;
  startDate: string;
  endDate: string;
  status: '有効' | '期限切れ' | '停止';
};

function formatApiError(status: number, data: { error?: string; detail?: unknown }) {
  const detail = typeof data.detail === 'string' ? ` / detail: ${data.detail}` : '';
  return `プランを保存できませんでした（HTTP ${status} / error: ${data.error ?? 'unknown'}${detail}）`;
}

function getTodayDateString() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

export default function AdminPlanNewPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialPatientId = searchParams.get('patientId') ?? '';

  const [patients, setPatients] = useState<PatientOption[]>([]);
  const [planType, setPlanType] = useState<'ticket' | 'subscription'>('ticket');
  const [formData, setFormData] = useState<PlanFormData>({
    patientId: initialPatientId,
    name: '',
    totalCount: '10',
    remainingCount: '10',
    startDate: getTodayDateString(),
    endDate: '',
    status: '有効',
  });

  const [isLoadingPatients, setIsLoadingPatients] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    const fetchPatients = async () => {
      try {
        setIsLoadingPatients(true);
        setErrorMessage(null);

        const response = await fetch('/api/admin/patients');
        const data = (await response.json()) as PatientsResponse;

        if (!response.ok || !data.patients) {
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
        setIsLoadingPatients(false);
      }
    };

    fetchPatients();
  }, []);

  const updateField = (field: keyof PlanFormData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handlePlanTypeChange = (value: 'ticket' | 'subscription') => {
    setPlanType(value);

    setFormData((prev) => ({
      ...prev,
      name: value === 'ticket' ? prev.name || '10回券' : prev.name || '1ヶ月サブスク',
      totalCount: value === 'ticket' ? prev.totalCount || '10' : '',
      remainingCount: value === 'ticket' ? prev.remainingCount || prev.totalCount || '10' : '',
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.patientId) {
      toast.error('患者を選択してください');
      return;
    }

    if (!formData.name.trim()) {
      toast.error('プラン名を入力してください');
      return;
    }

    if (planType === 'ticket' && !formData.totalCount) {
      toast.error('回数券の総回数を入力してください');
      return;
    }

    try {
      setIsSaving(true);
      setErrorMessage(null);

      const response = await fetch('/api/admin/plans', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          patientId: formData.patientId,
          type: planType,
          name: formData.name,
          totalCount: planType === 'ticket' ? formData.totalCount : null,
          remainingCount: planType === 'ticket' ? formData.remainingCount || formData.totalCount : null,
          startDate: formData.startDate,
          endDate: formData.endDate,
          status: formData.status,
        }),
      });

      const data = (await response.json()) as PlanResponse;

      if (!response.ok || !data.plan) {
        const message = formatApiError(response.status, data);
        setErrorMessage(message);
        toast.error('プランを作成できませんでした');
        return;
      }

      toast.success('プランを作成しました');
      router.push(`/admin/patients/${data.plan.patientId}`);
      router.refresh();
    } catch (error) {
      console.error(error);
      setErrorMessage('プラン作成中にエラーが発生しました。');
      toast.error('プランを作成できませんでした');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto">
      <PageHeader
        title="プラン作成"
        description="患者に回数券・サブスクを紐づけます"
        backHref="/admin/plans"
      />

      {errorMessage && (
        <div className="mb-4 rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
          {errorMessage}
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <SectionCard title="患者選択" className="mb-6">
          <div className="space-y-2">
            <Label htmlFor="patient">患者</Label>
            <Select
              value={formData.patientId}
              onValueChange={(value) => updateField('patientId', value)}
              disabled={isLoadingPatients || isSaving}
            >
              <SelectTrigger id="patient">
                <SelectValue placeholder={isLoadingPatients ? '患者一覧を読み込み中...' : '患者を選択してください'} />
              </SelectTrigger>
              <SelectContent>
                {patients.map((patient) => (
                  <SelectItem key={patient.id} value={patient.id}>
                    {patient.name}{patient.kana ? `（${patient.kana}）` : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </SectionCard>

        <SectionCard title="プランタイプ" className="mb-6">
          <RadioGroup
            value={planType}
            onValueChange={(value) => handlePlanTypeChange(value as 'ticket' | 'subscription')}
            className="grid grid-cols-2 gap-4"
          >
            <div>
              <RadioGroupItem value="ticket" id="ticket" className="peer sr-only" />
              <label
                htmlFor="ticket"
                className="flex flex-col items-center justify-center rounded-lg border-2 border-muted bg-popover p-6 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary cursor-pointer transition-colors"
              >
                <span className="text-lg font-semibold">回数券</span>
                <span className="text-sm text-muted-foreground mt-1">指定回数分利用可能</span>
              </label>
            </div>
            <div>
              <RadioGroupItem value="subscription" id="subscription" className="peer sr-only" />
              <label
                htmlFor="subscription"
                className="flex flex-col items-center justify-center rounded-lg border-2 border-muted bg-popover p-6 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary cursor-pointer transition-colors"
              >
                <span className="text-lg font-semibold">サブスク</span>
                <span className="text-sm text-muted-foreground mt-1">期間で管理</span>
              </label>
            </div>
          </RadioGroup>
        </SectionCard>

        <SectionCard title="プラン詳細" className="mb-6">
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">プラン名</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => updateField('name', e.target.value)}
                placeholder="例: 10回券、1ヶ月サブスク"
                required
                disabled={isSaving}
              />
            </div>

            {planType === 'ticket' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="totalCount">総回数</Label>
                  <Input
                    id="totalCount"
                    type="number"
                    min="0"
                    value={formData.totalCount}
                    onChange={(e) => {
                      updateField('totalCount', e.target.value);
                      updateField('remainingCount', e.target.value);
                    }}
                    disabled={isSaving}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="remainingCount">残回数</Label>
                  <Input
                    id="remainingCount"
                    type="number"
                    min="0"
                    value={formData.remainingCount}
                    onChange={(e) => updateField('remainingCount', e.target.value)}
                    disabled={isSaving}
                  />
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="startDate">開始日</Label>
                <Input
                  id="startDate"
                  type="date"
                  value={formData.startDate}
                  onChange={(e) => updateField('startDate', e.target.value)}
                  disabled={isSaving}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="endDate">終了日</Label>
                <Input
                  id="endDate"
                  type="date"
                  value={formData.endDate}
                  onChange={(e) => updateField('endDate', e.target.value)}
                  disabled={isSaving}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>ステータス</Label>
              <Select
                value={formData.status}
                onValueChange={(value) => updateField('status', value)}
                disabled={isSaving}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="有効">有効</SelectItem>
                  <SelectItem value="期限切れ">期限切れ</SelectItem>
                  <SelectItem value="停止">停止</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </SectionCard>

        <div className="flex items-center gap-4">
          <Button type="submit" disabled={isSaving || !formData.patientId || !formData.name}>
            <Save className="h-4 w-4 mr-2" />
            {isSaving ? '作成中...' : '作成'}
          </Button>
          <Button type="button" variant="outline" onClick={() => router.back()} disabled={isSaving}>
            キャンセル
          </Button>
        </div>
      </form>
    </div>
  );
}
