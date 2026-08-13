'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { Plus, FileText, ShoppingBag, Package, Calendar, Pencil, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PageHeader, SectionCard, EmptyState } from '@/components/admin';

/**
 * /api/admin/patients/[id] から返る患者詳細情報。
 *
 * MVPでは、まず patients テーブルの基本項目を表示・編集・削除する。
 * visits / plans / 商品提案は後続STEPで実データ化する。
 */
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

/**
 * 患者詳細画面に表示する最新改善プログラム。
 */
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

type DeletePatientResponse = {
  deleted?: boolean;
  patient?: {
    id: string;
    name: string;
  };
  error?: string;
  detail?: unknown;
};

type PatientEditFormData = {
  name: string;
  kana: string;
  phone: string;
  memo: string;
};

/**
 * APIレスポンスのエラー情報を画面表示用に整形する。
 *
 * 本番確認時に「何が失敗したか」が見えないと切り分けできないため、
 * error / detail / HTTP status をまとめて表示する。
 */
function buildApiErrorMessage(prefix: string, status: number, data: { error?: string; detail?: unknown }) {
  const detailText = data.detail ? ` / detail: ${String(data.detail)}` : '';
  const errorText = data.error ? ` / error: ${data.error}` : '';

  return `${prefix}（HTTP ${status}${errorText}${detailText}）`;
}

/**
 * 管理側：患者詳細ページ。
 */
export default function AdminPatientDetailPage() {
  const params = useParams();
  const router = useRouter();
  const patientId = typeof params.id === 'string' ? params.id : '';

  const [patient, setPatient] = useState<AdminPatientDetail | null>(null);
  const [latestProgram, setLatestProgram] = useState<LatestProgram | null>(null);
  const [formData, setFormData] = useState<PatientEditFormData>({
    name: '',
    kana: '',
    phone: '',
    memo: '',
  });

  const [isLoading, setIsLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [warningMessage, setWarningMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  /**
   * 患者情報をフォームに反映する。
   */
  const syncFormDataFromPatient = (nextPatient: AdminPatientDetail) => {
    setFormData({
      name: nextPatient.name,
      kana: nextPatient.kana ?? '',
      phone: nextPatient.phone ?? '',
      memo: nextPatient.memo ?? '',
    });
  };

  useEffect(() => {
    /**
     * 患者詳細と最新改善プログラムを取得する。
     *
     * 重要：
     * 最新プログラム取得に失敗しても、患者基本情報が取れていれば画面は表示する。
     * 患者基本情報と改善プログラム表示は切り分けて扱う。
     */
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
          return;
        }

        setPatient(patientData.patient);
        syncFormDataFromPatient(patientData.patient);

        const programResponse = await fetch(`/api/admin/patients/${patientId}/latest-program`);
        const programData = (await programResponse.json()) as LatestProgramResponse;

        if (!programResponse.ok) {
          console.error(programData);
          setWarningMessage(
            buildApiErrorMessage('最新の改善プログラムを取得できませんでした', programResponse.status, programData)
          );
          setLatestProgram(null);
          return;
        }

        setLatestProgram(programData.program ?? null);
      } catch (error) {
        console.error(error);
        setErrorMessage(`患者情報の取得中にエラーが発生しました。${String(error)}`);
        setPatient(null);
        setLatestProgram(null);
      } finally {
        setIsLoading(false);
      }
    };

    fetchPatientDetail();
  }, [patientId]);

  /**
   * 患者基本情報を保存する。
   */
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

  /**
   * 患者を削除する。
   */
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

  /**
   * 編集をキャンセルして表示モードへ戻す。
   */
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
                <p className="font-medium">
                  {new Date(patient.created_at).toLocaleDateString('ja-JP')}
                </p>
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

      <SectionCard title="現在のプラン" className="mb-6">
        <EmptyState
          title="プラン情報は未接続です"
          description="後続STEPで plans テーブルから取得します。"
          action={
            <Link href="/admin/plans/new">
              <Button size="sm">プラン作成</Button>
            </Link>
          }
        />
      </SectionCard>

      <SectionCard
        title="現在の改善プログラム"
        className="mb-6"
        actions={
          latestProgram ? (
            <Link href={`/admin/programs/new?patientId=${patient.id}`}>
              <Button size="sm" variant="outline">新しく作成</Button>
            </Link>
          ) : undefined
        }
      >
        {latestProgram ? (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <FileText className="h-4 w-4" />
              <span>作成日: {new Date(latestProgram.created_at).toLocaleDateString('ja-JP')}</span>
              <Badge variant="secondary">{latestProgram.create_mode === 'manual' ? '手動入力' : 'AI生成'}</Badge>
            </div>
            {latestProgram.memo && (
              <div>
                <p className="text-sm font-medium mb-1">状態メモ</p>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">{latestProgram.memo}</p>
              </div>
            )}
            {latestProgram.summary && (
              <div>
                <p className="text-sm font-medium mb-1">状態まとめ</p>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">{latestProgram.summary}</p>
              </div>
            )}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {latestProgram.short_term_program && (
                <div className="p-3 rounded-lg border">
                  <p className="text-sm font-medium mb-2">短期プログラム（3カ月）</p>
                  <p className="text-xs text-muted-foreground whitespace-pre-wrap">{latestProgram.short_term_program}</p>
                </div>
              )}
              {latestProgram.long_term_program && (
                <div className="p-3 rounded-lg border">
                  <p className="text-sm font-medium mb-2">長期プログラム</p>
                  <p className="text-xs text-muted-foreground whitespace-pre-wrap">{latestProgram.long_term_program}</p>
                </div>
              )}
            </div>
            {latestProgram.today_task && (
              <div className="p-3 rounded-lg border">
                <p className="text-sm font-medium mb-2">今日やること</p>
                <p className="text-xs text-muted-foreground whitespace-pre-wrap">{latestProgram.today_task}</p>
              </div>
            )}
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

      <SectionCard title="購入済み商品" className="mb-6">
        <EmptyState title="購入済み商品はありません" />
      </SectionCard>

      <SectionCard title="レンタル中の商品" className="mb-6">
        <EmptyState title="レンタル中の商品はありません" />
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
          <SectionCard>
            <EmptyState
              title="通院履歴は未接続です"
              description="後続STEPで visits テーブルから取得します。"
            />
          </SectionCard>
        </TabsContent>

        <TabsContent value="programs">
          <SectionCard>
            {latestProgram ? (
              <Link
                href={`/admin/programs/new?patientId=${patient.id}`}
                className="block rounded-lg border p-4 hover:bg-accent transition-colors"
              >
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="font-medium">作成日: {new Date(latestProgram.created_at).toLocaleDateString('ja-JP')}</p>
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

        <TabsContent value="products">
          <SectionCard>
            <EmptyState
              title="商品サポート履歴は未接続です"
              description="後続STEPで patient_product_recommendations から取得します。"
            />
          </SectionCard>
        </TabsContent>

        <TabsContent value="rentals">
          <SectionCard>
            <EmptyState
              title="レンタル履歴は未接続です"
              description="後続STEPで rentals テーブルから取得します。"
            />
          </SectionCard>
        </TabsContent>
      </Tabs>
    </div>
  );
}
