'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { Plus, FileText, ShoppingBag, Package, Calendar, Pencil } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PageHeader, SectionCard, EmptyState } from '@/components/admin';

/**
 * /api/admin/patients/[id] から返る患者詳細情報。
 *
 * MVPでは、まず patients テーブルの基本項目を表示・編集する。
 * visits / plans / programs / 商品提案は後続STEPで実データ化する。
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
 * 患者詳細APIのレスポンス型。
 */
type PatientDetailResponse = {
  patient?: AdminPatientDetail;
  error?: string;
  detail?: unknown;
};

/**
 * 患者編集フォームの入力値。
 */
type PatientEditFormData = {
  name: string;
  kana: string;
  phone: string;
  memo: string;
};

/**
 * 管理側：患者詳細ページ。
 *
 * 役割：
 * 1. URLの患者IDを取得する
 * 2. /api/admin/patients/[id] から患者基本情報を取得する
 * 3. 患者基本情報を表示する
 * 4. 編集モードで氏名・カナ・電話番号・備考を更新する
 *
 * 補足：
 * 現時点では、プラン・改善プログラム・通院履歴・商品サポートは未接続。
 */
export default function AdminPatientDetailPage() {
  const params = useParams();
  const patientId = typeof params.id === 'string' ? params.id : '';

  /**
   * APIから取得した患者詳細。
   */
  const [patient, setPatient] = useState<AdminPatientDetail | null>(null);

  /**
   * 編集フォームの入力値。
   */
  const [formData, setFormData] = useState<PatientEditFormData>({
    name: '',
    kana: '',
    phone: '',
    memo: '',
  });

  /**
   * 読み込み中表示用。
   */
  const [isLoading, setIsLoading] = useState(true);

  /**
   * 編集モードかどうか。
   */
  const [isEditing, setIsEditing] = useState(false);

  /**
   * 保存中フラグ。
   */
  const [isSaving, setIsSaving] = useState(false);

  /**
   * 取得・更新失敗時の表示メッセージ。
   */
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  /**
   * 更新成功時の表示メッセージ。
   */
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  /**
   * 患者情報をフォームに反映する。
   * 編集キャンセル時にも使う。
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
     * 患者詳細を取得する。
     */
    const fetchPatient = async () => {
      if (!patientId) {
        setErrorMessage('患者IDを取得できませんでした。');
        setIsLoading(false);
        return;
      }

      try {
        setIsLoading(true);
        setErrorMessage(null);

        const response = await fetch(`/api/admin/patients/${patientId}`);
        const data = (await response.json()) as PatientDetailResponse;

        if (!response.ok || !data.patient) {
          console.error(data);
          setErrorMessage('患者情報を取得できませんでした。');
          setPatient(null);
          return;
        }

        setPatient(data.patient);
        syncFormDataFromPatient(data.patient);
      } catch (error) {
        console.error(error);
        setErrorMessage('患者情報の取得中にエラーが発生しました。');
        setPatient(null);
      } finally {
        setIsLoading(false);
      }
    };

    fetchPatient();
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
        setErrorMessage('患者情報を保存できませんでした。');
        return;
      }

      setPatient(data.patient);
      syncFormDataFromPatient(data.patient);
      setIsEditing(false);
      setSuccessMessage('患者情報を保存しました。');
    } catch (error) {
      console.error(error);
      setErrorMessage('患者情報の保存中にエラーが発生しました。');
    } finally {
      setIsSaving(false);
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
          <p className="text-sm text-destructive">{errorMessage}</p>
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
          <div className="flex gap-2">
            {!isEditing && (
              <Button type="button" variant="outline" onClick={() => setIsEditing(true)}>
                <Pencil className="h-4 w-4 mr-2" />
                基本情報を編集
              </Button>
            )}
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
        <div className="mb-4 rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
          {errorMessage}
        </div>
      )}

      {successMessage && (
        <div className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700">
          {successMessage}
        </div>
      )}

      {/* Basic Info */}
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
              <Button type="submit" disabled={isSaving}>
                {isSaving ? '保存中...' : '保存する'}
              </Button>
              <Button type="button" variant="outline" onClick={handleCancelEdit} disabled={isSaving}>
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

      {/* Current Plan */}
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

      {/* Current Program */}
      <SectionCard title="現在の改善プログラム" className="mb-6">
        <EmptyState
          title="改善プログラムは未接続です"
          description="後続STEPで programs テーブルから取得します。"
          action={
            <Link href={`/admin/programs/new?patientId=${patient.id}`}>
              <Button size="sm">プログラム作成</Button>
            </Link>
          }
        />
      </SectionCard>

      {/* Purchased Products */}
      <SectionCard title="購入済み商品" className="mb-6">
        <EmptyState title="購入済み商品はありません" />
      </SectionCard>

      {/* Rental Products */}
      <SectionCard title="レンタル中の商品" className="mb-6">
        <EmptyState title="レンタル中の商品はありません" />
      </SectionCard>

      {/* Tabs for History */}
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
            <EmptyState
              title="プログラム一覧は未接続です"
              description="後続STEPで programs テーブルから取得します。"
            />
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
