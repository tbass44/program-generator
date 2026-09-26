'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import {
  Plus,
  FileText,
  ShoppingBag,
  Package,
  Calendar,
  Pencil,
  Trash2,
  CreditCard,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PageHeader, SectionCard, EmptyState } from '@/components/admin';

type AdminPatientDetail = {
  id: string;
  name: string;
  kana: string | null;
  phone: string | null;
  memo: string | null;
  line_user_id: string | null;
  line_display_name: string | null;
  line_picture_url: string | null;
  line_linked_at: string | null;
  line_link_code: string | null;
  line_link_code_expires_at: string | null;
  created_at: string;
  updated_at: string;
};

type LatestProgram = {
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

type PatientProductRecommendation = {
  id: string;
  patientId: string;
  programId: string | null;
  productId: string | null;
  productName: string;
  productUrl: string;
  category: string;
  reason: string;
  status: string;
  programSummary: string;
  programCreatedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

type PatientPlan = {
  id: string;
  patientId: string;
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

type PatientVisit = {
  id: string;
  patientId: string;
  visitDate: string;
  note: string;
  createdAt: string;
  updatedAt: string;
};

type PatientDetailResponse = {
  patient?: AdminPatientDetail;
  error?: string;
  detail?: unknown;
};

type LatestProgramResponse = {
  program?: LatestProgram | null;
  error?: string;
  detail?: unknown;
};

type PatientRecommendationsResponse = {
  recommendations?: PatientProductRecommendation[];
  error?: string;
  detail?: unknown;
};

type PatientPlansResponse = {
  plans?: PatientPlan[];
  currentPlan?: PatientPlan | null;
  error?: string;
  detail?: unknown;
};

type PatientVisitsResponse = {
  visits?: PatientVisit[];
  visit?: PatientVisit;
  error?: string;
  detail?: unknown;
};

type DeletePatientResponse = {
  deleted?: boolean;
  patient?: {
    id: string;
    name: string;
  };
  error?: string;
  detail?: unknown;
};

type DeleteVisitResponse = {
  deleted?: boolean;
  id?: string;
  error?: string;
  detail?: unknown;
};

type PatientEditFormData = {
  name: string;
  kana: string;
  phone: string;
  memo: string;
};

type VisitFormData = {
  visitDate: string;
  note: string;
};

function buildApiErrorMessage(prefix: string, status: number, data: { error?: string; detail?: unknown }) {
  const detailText = data.detail ? ` / detail: ${String(data.detail)}` : '';
  const errorText = data.error ? ` / error: ${data.error}` : '';

  return `${prefix}（HTTP ${status}${errorText}${detailText}）`;
}

function getTodayDateString() {
  return new Date().toISOString().slice(0, 10);
}

function formatDate(value: string | null) {
  if (!value) {
    return '未設定';
  }

  return new Date(value).toLocaleDateString('ja-JP');
}

function statusBadgeVariant(status: string): 'default' | 'secondary' | 'outline' {
  if (status === 'レンタル中' || status === '購入希望') {
    return 'default';
  }

  if (status === 'レンタル希望') {
    return 'secondary';
  }

  return 'outline';
}

function planStatusBadgeVariant(status: string): 'default' | 'secondary' | 'outline' {
  if (status === '有効') {
    return 'default';
  }

  if (status === '期限切れ') {
    return 'secondary';
  }

  return 'outline';
}

export default function AdminPatientDetailPage() {
  const params = useParams();
  const router = useRouter();
  const patientId = typeof params.id === 'string' ? params.id : '';

  const [patient, setPatient] = useState<AdminPatientDetail | null>(null);
  const [latestProgram, setLatestProgram] = useState<LatestProgram | null>(null);
  const [productRecommendations, setProductRecommendations] = useState<PatientProductRecommendation[]>([]);
  const [patientPlans, setPatientPlans] = useState<PatientPlan[]>([]);
  const [currentPlan, setCurrentPlan] = useState<PatientPlan | null>(null);
  const [visits, setVisits] = useState<PatientVisit[]>([]);
  const [formData, setFormData] = useState<PatientEditFormData>({
    name: '',
    kana: '',
    phone: '',
    memo: '',
  });
  const [visitFormData, setVisitFormData] = useState<VisitFormData>({
    visitDate: getTodayDateString(),
    note: '',
  });
  const [visitEditFormData, setVisitEditFormData] = useState<VisitFormData>({
    visitDate: '',
    note: '',
  });

  const [isLoading, setIsLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isSavingVisit, setIsSavingVisit] = useState(false);
  const [editingVisitId, setEditingVisitId] = useState<string | null>(null);
  const [savingVisitId, setSavingVisitId] = useState<string | null>(null);
  const [deletingVisitId, setDeletingVisitId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [warningMessage, setWarningMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const syncFormDataFromPatient = (nextPatient: AdminPatientDetail) => {
    setFormData({
      name: nextPatient.name,
      kana: nextPatient.kana ?? '',
      phone: nextPatient.phone ?? '',
      memo: nextPatient.memo ?? '',
    });
  };

  useEffect(() => {
    const fetchPatientDetail = async () => {
      if (!patientId) {
        setErrorMessage('患者IDを取得できませんでした。');
        setIsLoading(false);
        return;
      }

      try {
        setIsLoading(true);
        setErrorMessage(null);
        setWarningMessage(null);

        const patientResponse = await fetch(`/api/admin/patients/${patientId}`);
        const patientData = (await patientResponse.json()) as PatientDetailResponse;

        if (!patientResponse.ok || !patientData.patient) {
          console.error(patientData);
          setErrorMessage(
            buildApiErrorMessage('患者情報を取得できませんでした', patientResponse.status, patientData)
          );
          setPatient(null);
          setLatestProgram(null);
          setProductRecommendations([]);
          setPatientPlans([]);
          setCurrentPlan(null);
          setVisits([]);
          return;
        }

        setPatient(patientData.patient);
        syncFormDataFromPatient(patientData.patient);

        const [programResponse, recommendationsResponse, plansResponse, visitsResponse] = await Promise.all([
          fetch(`/api/admin/patients/${patientId}/latest-program`),
          fetch(`/api/admin/patients/${patientId}/recommendations`),
          fetch(`/api/admin/patients/${patientId}/plans`),
          fetch(`/api/admin/patients/${patientId}/visits`),
        ]);

        const programData = (await programResponse.json()) as LatestProgramResponse;
        const recommendationsData =
          (await recommendationsResponse.json()) as PatientRecommendationsResponse;
        const plansData = (await plansResponse.json()) as PatientPlansResponse;
        const visitsData = (await visitsResponse.json()) as PatientVisitsResponse;

        const warnings: string[] = [];

        if (!programResponse.ok) {
          console.error(programData);
          warnings.push(
            buildApiErrorMessage('最新の改善プログラムを取得できませんでした', programResponse.status, programData)
          );
          setLatestProgram(null);
        } else {
          setLatestProgram(programData.program ?? null);
        }

        if (!recommendationsResponse.ok || !recommendationsData.recommendations) {
          console.error(recommendationsData);
          warnings.push(
            buildApiErrorMessage(
              '商品提案履歴を取得できませんでした',
              recommendationsResponse.status,
              recommendationsData
            )
          );
          setProductRecommendations([]);
        } else {
          setProductRecommendations(recommendationsData.recommendations);
        }

        if (!plansResponse.ok || !plansData.plans) {
          console.error(plansData);
          warnings.push(
            buildApiErrorMessage('プラン情報を取得できませんでした', plansResponse.status, plansData)
          );
          setPatientPlans([]);
          setCurrentPlan(null);
        } else {
          setPatientPlans(plansData.plans);
          setCurrentPlan(plansData.currentPlan ?? null);
        }

        if (!visitsResponse.ok || !visitsData.visits) {
          console.error(visitsData);
          warnings.push(
            buildApiErrorMessage('通院履歴を取得できませんでした', visitsResponse.status, visitsData)
          );
          setVisits([]);
        } else {
          setVisits(visitsData.visits);
        }

        setWarningMessage(warnings.length > 0 ? warnings.join('\n') : null);
      } catch (error) {
        console.error(error);
        setErrorMessage(`患者情報の取得中にエラーが発生しました。${String(error)}`);
        setPatient(null);
        setLatestProgram(null);
        setProductRecommendations([]);
        setPatientPlans([]);
        setCurrentPlan(null);
        setVisits([]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchPatientDetail();
  }, [patientId]);

  const handleSavePatient = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!patientId) {
      setErrorMessage('患者IDを取得できませんでした。');
      return;
    }

    if (!formData.name.trim()) {
      setErrorMessage('氏名を入力してください。');
      return;
    }

    try {
      setIsSaving(true);
      setErrorMessage(null);
      setSuccessMessage(null);

      const response = await fetch(`/api/admin/patients/${patientId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: formData.name,
          kana: formData.kana,
          phone: formData.phone,
          memo: formData.memo,
        }),
      });

      const data = (await response.json()) as PatientDetailResponse;

      if (!response.ok || !data.patient) {
        console.error(data);
        setErrorMessage(buildApiErrorMessage('患者情報を保存できませんでした', response.status, data));
        return;
      }

      setPatient(data.patient);
      syncFormDataFromPatient(data.patient);
      setIsEditing(false);
      setSuccessMessage('患者情報を保存しました。');
    } catch (error) {
      console.error(error);
      setErrorMessage(`患者情報の保存中にエラーが発生しました。${String(error)}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleCreateVisit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!patientId) {
      setErrorMessage('患者IDを取得できませんでした。');
      return;
    }

    if (!visitFormData.visitDate) {
      setErrorMessage('来院日を入力してください。');
      return;
    }

    try {
      setIsSavingVisit(true);
      setErrorMessage(null);
      setSuccessMessage(null);

      const response = await fetch(`/api/admin/patients/${patientId}/visits`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          visitDate: visitFormData.visitDate,
          note: visitFormData.note,
        }),
      });

      const data = (await response.json()) as PatientVisitsResponse;

      if (!response.ok || !data.visit) {
        console.error(data);
        setErrorMessage(buildApiErrorMessage('通院履歴を追加できませんでした', response.status, data));
        return;
      }

      setVisits((current) => [data.visit as PatientVisit, ...current]);
      setVisitFormData({ visitDate: getTodayDateString(), note: '' });
      setSuccessMessage('通院履歴を追加しました。');
    } catch (error) {
      console.error(error);
      setErrorMessage(`通院履歴の追加中にエラーが発生しました。${String(error)}`);
    } finally {
      setIsSavingVisit(false);
    }
  };

  const handleStartEditVisit = (visit: PatientVisit) => {
    setEditingVisitId(visit.id);
    setVisitEditFormData({
      visitDate: visit.visitDate,
      note: visit.note,
    });
    setErrorMessage(null);
    setSuccessMessage(null);
  };

  const handleCancelEditVisit = () => {
    setEditingVisitId(null);
    setVisitEditFormData({ visitDate: '', note: '' });
    setErrorMessage(null);
  };

  const handleUpdateVisit = async (event: React.FormEvent, visitId: string) => {
    event.preventDefault();

    if (!patientId) {
      setErrorMessage('患者IDを取得できませんでした。');
      return;
    }

    if (!visitEditFormData.visitDate) {
      setErrorMessage('来院日を入力してください。');
      return;
    }

    try {
      setSavingVisitId(visitId);
      setErrorMessage(null);
      setSuccessMessage(null);

      const response = await fetch(`/api/admin/patients/${patientId}/visits/${visitId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          visitDate: visitEditFormData.visitDate,
          note: visitEditFormData.note,
        }),
      });

      const data = (await response.json()) as PatientVisitsResponse;

      if (!response.ok || !data.visit) {
        console.error(data);
        setErrorMessage(buildApiErrorMessage('通院履歴を保存できませんでした', response.status, data));
        return;
      }

      setVisits((current) =>
        current.map((visit) => (visit.id === visitId ? (data.visit as PatientVisit) : visit))
      );
      setEditingVisitId(null);
      setVisitEditFormData({ visitDate: '', note: '' });
      setSuccessMessage('通院履歴を保存しました。');
    } catch (error) {
      console.error(error);
      setErrorMessage(`通院履歴の保存中にエラーが発生しました。${String(error)}`);
    } finally {
      setSavingVisitId(null);
    }
  };

  const handleDeleteVisit = async (visit: PatientVisit) => {
    if (!patientId) {
      setErrorMessage('患者IDを取得できませんでした。');
      return;
    }

    const confirmed = window.confirm(
      `${formatDate(visit.visitDate)} の通院履歴を削除します。\nこの操作は元に戻せません。削除してもよろしいですか？`
    );

    if (!confirmed) {
      return;
    }

    try {
      setDeletingVisitId(visit.id);
      setErrorMessage(null);
      setSuccessMessage(null);

      const response = await fetch(`/api/admin/patients/${patientId}/visits/${visit.id}`, {
        method: 'DELETE',
      });

      const data = (await response.json()) as DeleteVisitResponse;

      if (!response.ok || !data.deleted) {
        console.error(data);
        setErrorMessage(buildApiErrorMessage('通院履歴を削除できませんでした', response.status, data));
        return;
      }

      setVisits((current) => current.filter((item) => item.id !== visit.id));
      if (editingVisitId === visit.id) {
        handleCancelEditVisit();
      }
      setSuccessMessage('通院履歴を削除しました。');
    } catch (error) {
      console.error(error);
      setErrorMessage(`通院履歴の削除中にエラーが発生しました。${String(error)}`);
    } finally {
      setDeletingVisitId(null);
    }
  };

  const handleDeletePatient = async () => {
    if (!patientId || !patient) {
      setErrorMessage('削除対象の患者情報を取得できませんでした。');
      return;
    }

    const confirmed = window.confirm(
      `患者「${patient.name}」を削除します。\n関連するプログラム・通院履歴・プラン等も削除されます。\nこの操作は元に戻せません。削除してもよろしいですか？`
    );

    if (!confirmed) {
      return;
    }

    try {
      setIsDeleting(true);
      setErrorMessage(null);
      setSuccessMessage(null);

      const response = await fetch(`/api/admin/patients/${patientId}`, {
        method: 'DELETE',
      });

      const data = (await response.json()) as DeletePatientResponse;

      if (!response.ok || !data.deleted) {
        console.error(data);
        setErrorMessage(buildApiErrorMessage('患者情報を削除できませんでした', response.status, data));
        return;
      }

      router.push('/admin/patients');
    } catch (error) {
      console.error(error);
      setErrorMessage(`患者情報の削除中にエラーが発生しました。${String(error)}`);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleCancelEdit = () => {
    if (patient) {
      syncFormDataFromPatient(patient);
    }

    setIsEditing(false);
    setErrorMessage(null);
    setSuccessMessage(null);
  };

  if (isLoading) {
    return (
      <div>
        <PageHeader
          title="患者詳細"
          description="患者情報を読み込んでいます"
          backHref="/admin/patients"
        />
        <div className="rounded-lg border bg-card p-6 text-sm text-muted-foreground">
          患者情報を読み込み中です...
        </div>
      </div>
    );
  }

  if (errorMessage && !patient) {
    return (
      <div>
        <PageHeader
          title="患者詳細"
          description="患者情報を表示できませんでした"
          backHref="/admin/patients"
        />
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-6">
          <p className="text-sm text-destructive whitespace-pre-wrap">{errorMessage}</p>
          <p className="mt-3 text-xs text-muted-foreground">患者ID: {patientId || '取得不可'}</p>
          <div className="mt-4 flex gap-3">
            <Button type="button" onClick={() => window.location.reload()}>
              再読み込み
            </Button>
            <Link href="/admin/patients">
              <Button type="button" variant="outline">
                患者一覧へ戻る
              </Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (!patient) {
    return null;
  }

  const rentalRecommendations = productRecommendations.filter(
    (item) =>
      item.status === 'レンタル希望' ||
      item.status === 'レンタル中' ||
      item.status === 'レンタル終了'
  );
  const purchaseRecommendations = productRecommendations.filter((item) => item.status === '購入希望');

  return (
    <div>
      <PageHeader
        title={patient.name}
        description="患者詳細情報"
        backHref="/admin/patients"
        actions={
          <div className="flex flex-wrap gap-2">
            {!isEditing && (
              <Button type="button" variant="outline" onClick={() => setIsEditing(true)}>
                <Pencil className="h-4 w-4 mr-2" />
                基本情報を編集
              </Button>
            )}
            <Button
              type="button"
              variant="destructive"
              onClick={handleDeletePatient}
              disabled={isDeleting || isSaving}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              {isDeleting ? '削除中...' : '削除'}
            </Button>
            <Link href={`/admin/programs/new?patientId=${patient.id}`}>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                プログラム作成
              </Button>
            </Link>
          </div>
        }
      />

      {errorMessage && (
        <div className="mb-4 rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive whitespace-pre-wrap">
          {errorMessage}
        </div>
      )}

      {warningMessage && (
        <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-700 whitespace-pre-wrap">
          {warningMessage}
        </div>
      )}

      {successMessage && (
        <div className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700">
          {successMessage}
        </div>
      )}

      <SectionCard title="基本情報" className="mb-6">
        {isEditing ? (
          <form onSubmit={handleSavePatient} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label htmlFor="name">氏名</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="kana">カナ</Label>
                <Input
                  id="kana"
                  value={formData.kana}
                  onChange={(e) => setFormData({ ...formData, kana: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">電話番号</Label>
                <Input
                  id="phone"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="memo">備考</Label>
              <textarea
                id="memo"
                className="flex min-h-[100px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                value={formData.memo}
                onChange={(e) => setFormData({ ...formData, memo: e.target.value })}
              />
            </div>

            <div className="flex gap-3">
              <Button type="submit" disabled={isSaving || isDeleting}>
                {isSaving ? '保存中...' : '保存する'}
              </Button>
              <Button type="button" variant="outline" onClick={handleCancelEdit} disabled={isSaving || isDeleting}>
                キャンセル
              </Button>
            </div>
          </form>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">氏名</p>
                <p className="font-medium">{patient.name}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">カナ</p>
                <p className="font-medium">{patient.kana || '未登録'}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">電話番号</p>
                <p className="font-medium">{patient.phone || '未登録'}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">LINE連携</p>
                <div className="mt-1">
                  <Badge variant={patient.line_user_id ? 'default' : 'secondary'}>
                    {patient.line_user_id ? '連携済み' : '未連携'}
                  </Badge>
                </div>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">LINE表示名</p>
                <p className="font-medium">{patient.line_display_name || '未登録'}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">登録日</p>
                <p className="font-medium">{formatDate(patient.created_at)}</p>
              </div>
            </div>
            {patient.memo && (
              <div className="mt-4 pt-4 border-t">
                <p className="text-sm text-muted-foreground">備考</p>
                <p className="mt-1 whitespace-pre-wrap">{patient.memo}</p>
              </div>
            )}
          </>
        )}
      </SectionCard>

      <SectionCard
        title="現在のプラン"
        className="mb-6"
        actions={
          <Link href="/admin/plans/new">
            <Button size="sm" variant="outline">プラン作成</Button>
          </Link>
        }
      >
        {currentPlan ? (
          <div className="space-y-4">
            <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <CreditCard className="h-4 w-4 text-muted-foreground" />
                  <p className="font-medium">{currentPlan.name}</p>
                  <Badge variant="secondary">{currentPlan.type}</Badge>
                  <Badge variant={planStatusBadgeVariant(currentPlan.status)}>{currentPlan.status}</Badge>
                </div>
                <p className="mt-2 text-sm text-muted-foreground">
                  登録プラン数: {patientPlans.length}件
                </p>
              </div>

              <Link href={`/admin/plans/${currentPlan.id}`}>
                <Button size="sm" variant="outline">プラン詳細</Button>
              </Link>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              {currentPlan.type === '回数券' && (
                <div className="rounded-lg border p-3">
                  <p className="text-sm text-muted-foreground">残回数</p>
                  <p className="mt-1 text-lg font-semibold">
                    {currentPlan.remainingCount ?? '-'} / {currentPlan.totalCount ?? '-'}
                  </p>
                </div>
              )}
              <div className="rounded-lg border p-3">
                <p className="text-sm text-muted-foreground">開始日</p>
                <p className="mt-1 font-medium">{formatDate(currentPlan.startDate)}</p>
              </div>
              <div className="rounded-lg border p-3">
                <p className="text-sm text-muted-foreground">終了日</p>
                <p className="mt-1 font-medium">{formatDate(currentPlan.endDate)}</p>
              </div>
            </div>
          </div>
        ) : (
          <EmptyState
            title="現在のプランはありません"
            description="この患者に回数券・サブスクを作成すると、ここに表示されます。"
            action={
              <Link href="/admin/plans/new">
                <Button size="sm">プラン作成</Button>
              </Link>
            }
          />
        )}
      </SectionCard>

      <SectionCard title="現在の改善プログラム" className="mb-6">
        {latestProgram ? (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <FileText className="h-4 w-4" />
              <span>作成日: {formatDate(latestProgram.created_at)}</span>
              <Badge variant="secondary">{latestProgram.create_mode === 'manual' ? '手動入力' : 'AI生成'}</Badge>
            </div>
            {latestProgram.summary && (
              <p className="text-sm text-muted-foreground whitespace-pre-wrap">{latestProgram.summary}</p>
            )}
            <Link href={`/admin/programs/${latestProgram.id}`}>
              <Button size="sm" variant="outline">プログラム詳細</Button>
            </Link>
          </div>
        ) : (
          <EmptyState
            title="改善プログラムは未作成です"
            description="この患者に対して、手動で改善プログラムを作成できます。"
            action={
              <Link href={`/admin/programs/new?patientId=${patient.id}`}>
                <Button size="sm">プログラム作成</Button>
              </Link>
            }
          />
        )}
      </SectionCard>

      <SectionCard title="購入希望・購入関連の商品" className="mb-6">
        {purchaseRecommendations.length > 0 ? (
          <div className="space-y-3">
            {purchaseRecommendations.map((item) => (
              <div key={item.id} className="rounded-lg border p-4">
                <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium">{item.productName}</p>
                      <Badge variant="secondary">{item.category}</Badge>
                      <Badge variant={statusBadgeVariant(item.status)}>{item.status}</Badge>
                    </div>
                    <p className="mt-2 text-sm text-muted-foreground whitespace-pre-wrap">
                      {item.reason || '提案理由は未入力です。'}
                    </p>
                  </div>
                  {item.programId && (
                    <Link href={`/admin/programs/${item.programId}`}>
                      <Button size="sm" variant="outline">プログラム詳細</Button>
                    </Link>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState title="購入希望の商品はありません" />
        )}
      </SectionCard>

      <SectionCard title="レンタル中の商品" className="mb-6">
        {productRecommendations.filter((item) => item.status === 'レンタル中').length > 0 ? (
          <div className="space-y-3">
            {productRecommendations
              .filter((item) => item.status === 'レンタル中')
              .map((item) => (
                <div key={item.id} className="rounded-lg border p-4">
                  <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-medium">{item.productName}</p>
                        <Badge variant="secondary">{item.category}</Badge>
                        <Badge variant={statusBadgeVariant(item.status)}>{item.status}</Badge>
                      </div>
                      <p className="mt-2 text-sm text-muted-foreground whitespace-pre-wrap">
                        {item.reason || '提案理由は未入力です。'}
                      </p>
                    </div>
                    {item.programId && (
                      <Link href={`/admin/programs/${item.programId}`}>
                        <Button size="sm" variant="outline">プログラム詳細</Button>
                      </Link>
                    )}
                  </div>
                </div>
              ))}
          </div>
        ) : (
          <EmptyState title="レンタル中の商品はありません" />
        )}
      </SectionCard>

      <Tabs defaultValue="visits" className="space-y-4">
        <TabsList>
          <TabsTrigger value="visits" className="gap-2">
            <Calendar className="h-4 w-4" />
            通院履歴
          </TabsTrigger>
          <TabsTrigger value="programs" className="gap-2">
            <FileText className="h-4 w-4" />
            プログラム一覧
          </TabsTrigger>
          <TabsTrigger value="plans" className="gap-2">
            <CreditCard className="h-4 w-4" />
            プラン履歴
          </TabsTrigger>
          <TabsTrigger value="products" className="gap-2">
            <ShoppingBag className="h-4 w-4" />
            商品サポート履歴
          </TabsTrigger>
          <TabsTrigger value="rentals" className="gap-2">
            <Package className="h-4 w-4" />
            レンタル履歴
          </TabsTrigger>
        </TabsList>

        <TabsContent value="visits">
          <SectionCard title="通院履歴">
            <form onSubmit={handleCreateVisit} className="mb-6 rounded-lg border p-4">
              <div className="grid gap-4 md:grid-cols-[180px_1fr]">
                <div className="space-y-2">
                  <Label htmlFor="visit-date">来院日</Label>
                  <Input
                    id="visit-date"
                    type="date"
                    value={visitFormData.visitDate}
                    onChange={(event) => setVisitFormData({ ...visitFormData, visitDate: event.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="visit-note">施術メモ</Label>
                  <textarea
                    id="visit-note"
                    className="flex min-h-[84px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                    value={visitFormData.note}
                    onChange={(event) => setVisitFormData({ ...visitFormData, note: event.target.value })}
                    placeholder="例：首肩こり、腰痛、施術内容、次回確認事項など"
                  />
                </div>
              </div>
              <div className="mt-4">
                <Button type="submit" disabled={isSavingVisit}>
                  <Plus className="h-4 w-4 mr-2" />
                  {isSavingVisit ? '追加中...' : '通院履歴を追加'}
                </Button>
              </div>
            </form>

            {visits.length > 0 ? (
              <div className="space-y-3">
                {visits.map((visit) => (
                  <div key={visit.id} className="rounded-lg border p-4">
                    {editingVisitId === visit.id ? (
                      <form onSubmit={(event) => handleUpdateVisit(event, visit.id)} className="space-y-4">
                        <div className="grid gap-4 md:grid-cols-[180px_1fr]">
                          <div className="space-y-2">
                            <Label htmlFor={`edit-visit-date-${visit.id}`}>来院日</Label>
                            <Input
                              id={`edit-visit-date-${visit.id}`}
                              type="date"
                              value={visitEditFormData.visitDate}
                              onChange={(event) =>
                                setVisitEditFormData({ ...visitEditFormData, visitDate: event.target.value })
                              }
                              required
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor={`edit-visit-note-${visit.id}`}>施術メモ</Label>
                            <textarea
                              id={`edit-visit-note-${visit.id}`}
                              className="flex min-h-[84px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                              value={visitEditFormData.note}
                              onChange={(event) =>
                                setVisitEditFormData({ ...visitEditFormData, note: event.target.value })
                              }
                            />
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <Button type="submit" size="sm" disabled={savingVisitId === visit.id}>
                            {savingVisitId === visit.id ? '保存中...' : '保存'}
                          </Button>
                          <Button type="button" size="sm" variant="outline" onClick={handleCancelEditVisit}>
                            キャンセル
                          </Button>
                        </div>
                      </form>
                    ) : (
                      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <Calendar className="h-4 w-4 text-muted-foreground" />
                            <p className="font-medium">{formatDate(visit.visitDate)}</p>
                          </div>
                          <p className="mt-2 text-sm text-muted-foreground whitespace-pre-wrap">
                            {visit.note || '施術メモは未入力です。'}
                          </p>
                          <p className="mt-3 text-xs text-muted-foreground">登録日: {formatDate(visit.createdAt)}</p>
                        </div>
                        <div className="flex shrink-0 flex-wrap gap-2">
                          <Button type="button" size="sm" variant="outline" onClick={() => handleStartEditVisit(visit)}>
                            <Pencil className="h-4 w-4 mr-2" />
                            編集
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="destructive"
                            onClick={() => handleDeleteVisit(visit)}
                            disabled={deletingVisitId === visit.id}
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            {deletingVisitId === visit.id ? '削除中...' : '削除'}
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState
                title="通院履歴はありません"
                description="来院日と施術メモを追加すると、ここに表示されます。"
              />
            )}
          </SectionCard>
        </TabsContent>

        <TabsContent value="programs">
          <SectionCard>
            {latestProgram ? (
              <Link
                href={`/admin/programs/${latestProgram.id}`}
                className="block rounded-lg border p-4 hover:bg-accent transition-colors"
              >
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="font-medium">作成日: {formatDate(latestProgram.created_at)}</p>
                    <p className="text-sm text-muted-foreground line-clamp-2">
                      {latestProgram.summary || latestProgram.memo || '内容未入力'}
                    </p>
                  </div>
                  <Badge variant="secondary">最新</Badge>
                </div>
              </Link>
            ) : (
              <EmptyState
                title="プログラム一覧は未接続です"
                description="まずは最新プログラムの表示のみ対応しています。"
              />
            )}
          </SectionCard>
        </TabsContent>

        <TabsContent value="plans">
          <SectionCard>
            {patientPlans.length > 0 ? (
              <div className="space-y-3">
                {patientPlans.map((plan) => (
                  <div key={plan.id} className="rounded-lg border p-4">
                    <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-medium">{plan.name}</p>
                          <Badge variant="secondary">{plan.type}</Badge>
                          <Badge variant={planStatusBadgeVariant(plan.status)}>{plan.status}</Badge>
                        </div>
                        <div className="mt-3 grid gap-3 text-sm text-muted-foreground md:grid-cols-3">
                          {plan.type === '回数券' && (
                            <span>残回数: {plan.remainingCount ?? '-'} / {plan.totalCount ?? '-'}</span>
                          )}
                          <span>開始日: {formatDate(plan.startDate)}</span>
                          <span>終了日: {formatDate(plan.endDate)}</span>
                        </div>
                        <p className="mt-2 text-xs text-muted-foreground">
                          作成日: {formatDate(plan.createdAt)}
                        </p>
                      </div>

                      <Link href={`/admin/plans/${plan.id}`}>
                        <Button size="sm" variant="outline">プラン詳細</Button>
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState
                title="プラン履歴はありません"
                description="この患者に回数券・サブスクを作成すると、ここに表示されます。"
                action={
                  <Link href="/admin/plans/new">
                    <Button size="sm">プラン作成</Button>
                  </Link>
                }
              />
            )}
          </SectionCard>
        </TabsContent>

        <TabsContent value="products">
          <SectionCard>
            {productRecommendations.length > 0 ? (
              <div className="space-y-3">
                {productRecommendations.map((item) => (
                  <div key={item.id} className="rounded-lg border p-4">
                    <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-medium">{item.productName}</p>
                          <Badge variant="secondary">{item.category}</Badge>
                          <Badge variant={statusBadgeVariant(item.status)}>{item.status}</Badge>
                        </div>
                        <p className="mt-2 text-sm text-muted-foreground whitespace-pre-wrap">
                          {item.reason || '提案理由は未入力です。'}
                        </p>
                        <div className="mt-3 flex flex-wrap gap-3 text-xs text-muted-foreground">
                          <span>提案日: {formatDate(item.createdAt)}</span>
                          {item.programCreatedAt && (
                            <span>プログラム作成日: {formatDate(item.programCreatedAt)}</span>
                          )}
                        </div>
                        {item.programSummary && (
                          <p className="mt-2 line-clamp-2 text-xs text-muted-foreground">
                            関連プログラム: {item.programSummary}
                          </p>
                        )}
                      </div>

                      <div className="flex shrink-0 flex-wrap gap-2">
                        {item.productUrl && (
                          <a href={item.productUrl} target="_blank" rel="noreferrer">
                            <Button size="sm" variant="outline">商品リンク</Button>
                          </a>
                        )}
                        {item.programId && (
                          <Link href={`/admin/programs/${item.programId}`}>
                            <Button size="sm" variant="outline">プログラム詳細</Button>
                          </Link>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState
                title="商品サポート履歴はありません"
                description="改善プログラム詳細から商品提案を追加すると、ここに表示されます。"
              />
            )}
          </SectionCard>
        </TabsContent>

        <TabsContent value="rentals">
          <SectionCard>
            {rentalRecommendations.length > 0 ? (
              <div className="space-y-3">
                {rentalRecommendations.map((item) => (
                  <div key={item.id} className="rounded-lg border p-4">
                    <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-medium">{item.productName}</p>
                          <Badge variant="secondary">{item.category}</Badge>
                          <Badge variant={statusBadgeVariant(item.status)}>{item.status}</Badge>
                        </div>
                        <p className="mt-2 text-sm text-muted-foreground whitespace-pre-wrap">
                          {item.reason || '提案理由は未入力です。'}
                        </p>
                        <div className="mt-3 flex flex-wrap gap-3 text-xs text-muted-foreground">
                          <span>提案日: {formatDate(item.createdAt)}</span>
                          <span>更新日: {formatDate(item.updatedAt)}</span>
                        </div>
                      </div>
                      {item.programId && (
                        <Link href={`/admin/programs/${item.programId}`}>
                          <Button size="sm" variant="outline">プログラム詳細</Button>
                        </Link>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState
                title="レンタル履歴はありません"
                description="ステータスが「レンタル希望」「レンタル中」「レンタル終了」の商品提案が表示されます。"
              />
            )}
          </SectionCard>
        </TabsContent>
      </Tabs>
    </div>
  );
}
