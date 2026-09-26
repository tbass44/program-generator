'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Calendar, Clock, Edit, Save, Trash2, MinusCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { PageHeader, SectionCard, EmptyState } from '@/components/admin';
import { toast } from 'sonner';

type PlanDetail = {
  id: string;
  patientId: string;
  patientName: string;
  patientKana: string;
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

type TicketUsage = {
  id: string;
  planId: string;
  usedAt: string;
  note: string;
  createdAt: string;
};

type PlanDetailResponse = {
  plan?: PlanDetail;
  error?: string;
  detail?: unknown;
};

type TicketUsagesResponse = {
  usages?: TicketUsage[];
  usage?: TicketUsage;
  plan?: PlanDetail;
  error?: string;
  detail?: unknown;
};

type DeletePlanResponse = {
  deleted?: boolean;
  id?: string;
  patientId?: string;
  error?: string;
  detail?: unknown;
};

type PlanFormData = {
  type: '回数券' | 'サブスク';
  name: string;
  totalCount: string;
  remainingCount: string;
  startDate: string;
  endDate: string;
  status: '有効' | '期限切れ' | '停止';
};

const statusConfig: Record<PlanDetail['status'], string> = {
  '有効': 'bg-emerald-50 text-emerald-700 border-emerald-200',
  '期限切れ': 'bg-gray-50 text-gray-600 border-gray-200',
  '停止': 'bg-red-50 text-red-700 border-red-200',
};

function formatApiError(status: number, data: PlanDetailResponse | TicketUsagesResponse | DeletePlanResponse) {
  const detail = typeof data.detail === 'string' ? ` / detail: ${data.detail}` : '';
  return `プラン情報を処理できませんでした（HTTP ${status} / error: ${data.error ?? 'unknown'}${detail}）`;
}

function formatDate(value: string | null) {
  if (!value) {
    return '未設定';
  }

  return new Date(value).toLocaleDateString('ja-JP');
}

function toFormData(plan: PlanDetail): PlanFormData {
  return {
    type: plan.type,
    name: plan.name,
    totalCount: plan.totalCount === null ? '' : String(plan.totalCount),
    remainingCount: plan.remainingCount === null ? '' : String(plan.remainingCount),
    startDate: plan.startDate ?? '',
    endDate: plan.endDate ?? '',
    status: plan.status,
  };
}

export default function AdminPlanDetailPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const [plan, setPlan] = useState<PlanDetail | null>(null);
  const [usages, setUsages] = useState<TicketUsage[]>([]);
  const [formData, setFormData] = useState<PlanFormData>({
    type: '回数券',
    name: '',
    totalCount: '',
    remainingCount: '',
    startDate: '',
    endDate: '',
    status: '有効',
  });
  const [usageNote, setUsageNote] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isUsingTicket, setIsUsingTicket] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [usageErrorMessage, setUsageErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    const fetchPlan = async () => {
      try {
        setIsLoading(true);
        setErrorMessage(null);
        setUsageErrorMessage(null);

        const [planResponse, usagesResponse] = await Promise.all([
          fetch(`/api/admin/plans/${params.id}`),
          fetch(`/api/admin/plans/${params.id}/usages`),
        ]);

        const planData = (await planResponse.json()) as PlanDetailResponse;
        const usagesData = (await usagesResponse.json()) as TicketUsagesResponse;

        if (!planResponse.ok || !planData.plan) {
          setPlan(null);
          setErrorMessage(formatApiError(planResponse.status, planData));
          return;
        }

        setPlan(planData.plan);
        setFormData(toFormData(planData.plan));

        if (!usagesResponse.ok || !usagesData.usages) {
          setUsageErrorMessage(formatApiError(usagesResponse.status, usagesData));
          setUsages([]);
        } else {
          setUsages(usagesData.usages);
        }
      } catch (error) {
        console.error(error);
        setPlan(null);
        setErrorMessage('プラン情報の取得中にエラーが発生しました。');
      } finally {
        setIsLoading(false);
      }
    };

    fetchPlan();
  }, [params.id]);

  const handleCancelEdit = () => {
    if (plan) {
      setFormData(toFormData(plan));
    }

    setIsEditing(false);
    setErrorMessage(null);
  };

  const handleSave = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!formData.name.trim()) {
      setErrorMessage('プラン名を入力してください。');
      return;
    }

    try {
      setIsSaving(true);
      setErrorMessage(null);

      const response = await fetch(`/api/admin/plans/${params.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          type: formData.type,
          name: formData.name,
          totalCount: formData.type === '回数券' ? formData.totalCount : null,
          remainingCount: formData.type === '回数券' ? formData.remainingCount : null,
          startDate: formData.startDate,
          endDate: formData.endDate,
          status: formData.status,
        }),
      });

      const data = (await response.json()) as PlanDetailResponse;

      if (!response.ok || !data.plan) {
        setErrorMessage(formatApiError(response.status, data));
        toast.error('プランを保存できませんでした');
        return;
      }

      setPlan(data.plan);
      setFormData(toFormData(data.plan));
      setIsEditing(false);
      toast.success('プランを保存しました');
    } catch (error) {
      console.error(error);
      setErrorMessage('プラン情報の保存中にエラーが発生しました。');
      toast.error('プランを保存できませんでした');
    } finally {
      setIsSaving(false);
    }
  };

  const handleUseTicket = async () => {
    if (!plan || plan.type !== '回数券') {
      return;
    }

    if ((plan.remainingCount ?? 0) <= 0) {
      toast.error('残回数がありません');
      return;
    }

    const ok = window.confirm(`「${plan.name}」を1回使用します。よろしいですか？`);

    if (!ok) {
      return;
    }

    try {
      setIsUsingTicket(true);
      setUsageErrorMessage(null);

      const response = await fetch(`/api/admin/plans/${plan.id}/usages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          note: usageNote,
        }),
      });

      const data = (await response.json()) as TicketUsagesResponse;

      if (!response.ok || !data.usage || !data.plan) {
        setUsageErrorMessage(formatApiError(response.status, data));
        toast.error('回数券を使用できませんでした');
        return;
      }

      setPlan(data.plan);
      setFormData(toFormData(data.plan));
      setUsages((prev) => [data.usage!, ...prev]);
      setUsageNote('');
      toast.success('回数券を1回使用しました');
    } catch (error) {
      console.error(error);
      setUsageErrorMessage('回数券の使用処理中にエラーが発生しました。');
      toast.error('回数券を使用できませんでした');
    } finally {
      setIsUsingTicket(false);
    }
  };

  const handleDelete = async () => {
    if (!plan) {
      return;
    }

    const ok = window.confirm(
      `「${plan.patientName}」のプラン「${plan.name}」を削除します。削除すると元に戻せません。よろしいですか？`
    );

    if (!ok) {
      return;
    }

    try {
      setIsDeleting(true);
      setErrorMessage(null);

      const response = await fetch(`/api/admin/plans/${plan.id}`, {
        method: 'DELETE',
      });

      const data = (await response.json()) as DeletePlanResponse;

      if (!response.ok || !data.deleted) {
        setErrorMessage(formatApiError(response.status, data));
        toast.error('プランを削除できませんでした');
        return;
      }

      toast.success('プランを削除しました');
      router.push(`/admin/patients/${data.patientId ?? plan.patientId}`);
      router.refresh();
    } catch (error) {
      console.error(error);
      setErrorMessage('プランの削除中にエラーが発生しました。');
      toast.error('プランを削除できませんでした');
    } finally {
      setIsDeleting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="max-w-4xl mx-auto">
        <PageHeader title="プラン詳細" description="プラン情報を読み込み中です" backHref="/admin/plans" />
        <SectionCard>
          <p className="text-sm text-muted-foreground">読み込み中です...</p>
        </SectionCard>
      </div>
    );
  }

  if (errorMessage && !plan) {
    return (
      <div className="max-w-4xl mx-auto">
        <PageHeader title="プラン詳細" description="プラン情報を取得できませんでした" backHref="/admin/plans" />
        <SectionCard>
          <p className="text-sm text-destructive whitespace-pre-wrap">{errorMessage}</p>
        </SectionCard>
      </div>
    );
  }

  if (!plan) {
    return null;
  }

  const isTicket = plan.type === '回数券';
  const usedCount = isTicket
    ? Math.max((plan.totalCount ?? 0) - (plan.remainingCount ?? 0), 0)
    : null;

  return (
    <div className="max-w-4xl mx-auto">
      <PageHeader
        title="プラン詳細"
        description={`${plan.patientName}のプラン`}
        backHref="/admin/plans"
        actions={
          <div className="flex flex-wrap gap-2">
            {!isEditing && (
              <Button type="button" variant="outline" onClick={() => setIsEditing(true)}>
                <Edit className="h-4 w-4 mr-2" />
                編集
              </Button>
            )}
            <Button type="button" variant="destructive" onClick={handleDelete} disabled={isDeleting || isSaving || isUsingTicket}>
              <Trash2 className="h-4 w-4 mr-2" />
              {isDeleting ? '削除中...' : '削除'}
            </Button>
          </div>
        }
      />

      {errorMessage && (
        <div className="mb-4 rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive whitespace-pre-wrap">
          {errorMessage}
        </div>
      )}

      {usageErrorMessage && (
        <div className="mb-4 rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive whitespace-pre-wrap">
          {usageErrorMessage}
        </div>
      )}

      <SectionCard className="mb-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-4">
            <div className="rounded-lg bg-primary/10 p-4">
              {isTicket ? (
                <Calendar className="h-6 w-6 text-primary" />
              ) : (
                <Clock className="h-6 w-6 text-primary" />
              )}
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <Badge>{plan.type}</Badge>
                <span className="text-lg font-semibold">{plan.name}</span>
                <Badge className={statusConfig[plan.status]} variant="outline">
                  {plan.status}
                </Badge>
              </div>
              <Link href={`/admin/patients/${plan.patientId}`} className="text-sm text-primary hover:underline">
                {plan.patientName}
              </Link>
              {plan.patientKana && (
                <p className="text-xs text-muted-foreground">{plan.patientKana}</p>
              )}
            </div>
          </div>
        </div>
      </SectionCard>

      {isEditing ? (
        <form onSubmit={handleSave}>
          <SectionCard title="プラン編集" className="mb-6">
            <div className="space-y-5">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>プランタイプ</Label>
                  <Select
                    value={formData.type}
                    onValueChange={(value) =>
                      setFormData({ ...formData, type: value as PlanFormData['type'] })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="回数券">回数券</SelectItem>
                      <SelectItem value="サブスク">サブスク</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>ステータス</Label>
                  <Select
                    value={formData.status}
                    onValueChange={(value) =>
                      setFormData({ ...formData, status: value as PlanFormData['status'] })
                    }
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

              <div className="space-y-2">
                <Label htmlFor="plan-name">プラン名</Label>
                <Input
                  id="plan-name"
                  value={formData.name}
                  onChange={(event) => setFormData({ ...formData, name: event.target.value })}
                  required
                />
              </div>

              {formData.type === '回数券' && (
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="total-count">総回数</Label>
                    <Input
                      id="total-count"
                      type="number"
                      min="0"
                      value={formData.totalCount}
                      onChange={(event) => setFormData({ ...formData, totalCount: event.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="remaining-count">残回数</Label>
                    <Input
                      id="remaining-count"
                      type="number"
                      min="0"
                      value={formData.remainingCount}
                      onChange={(event) => setFormData({ ...formData, remainingCount: event.target.value })}
                    />
                  </div>
                </div>
              )}

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="start-date">開始日</Label>
                  <Input
                    id="start-date"
                    type="date"
                    value={formData.startDate}
                    onChange={(event) => setFormData({ ...formData, startDate: event.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="end-date">終了日</Label>
                  <Input
                    id="end-date"
                    type="date"
                    value={formData.endDate}
                    onChange={(event) => setFormData({ ...formData, endDate: event.target.value })}
                  />
                </div>
              </div>
            </div>
          </SectionCard>

          <div className="flex gap-3">
            <Button type="submit" disabled={isSaving || isDeleting || isUsingTicket}>
              <Save className="h-4 w-4 mr-2" />
              {isSaving ? '保存中...' : '保存する'}
            </Button>
            <Button type="button" variant="outline" onClick={handleCancelEdit} disabled={isSaving || isDeleting || isUsingTicket}>
              キャンセル
            </Button>
          </div>
        </form>
      ) : (
        <>
          {isTicket ? (
            <SectionCard title="回数券情報" className="mb-6">
              <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
                <div className="rounded-lg bg-primary/5 p-4 text-center">
                  <p className="text-3xl font-bold text-primary">{plan.totalCount ?? '-'}</p>
                  <p className="mt-1 text-sm text-muted-foreground">総回数</p>
                </div>
                <div className="rounded-lg bg-muted p-4 text-center">
                  <p className="text-3xl font-bold">{usedCount ?? '-'}</p>
                  <p className="mt-1 text-sm text-muted-foreground">使用済み</p>
                </div>
                <div className="rounded-lg bg-primary/5 p-4 text-center">
                  <p className="text-3xl font-bold text-primary">{plan.remainingCount ?? '-'}</p>
                  <p className="mt-1 text-sm text-muted-foreground">残り回数</p>
                </div>
              </div>

              <div className="mt-5 rounded-lg border bg-muted/20 p-4">
                <div className="space-y-2">
                  <Label htmlFor="usage-note">使用メモ</Label>
                  <textarea
                    id="usage-note"
                    className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                    value={usageNote}
                    onChange={(event) => setUsageNote(event.target.value)}
                    placeholder="例：通常施術で1回使用"
                    disabled={isUsingTicket || (plan.remainingCount ?? 0) <= 0}
                  />
                </div>
                <div className="mt-3 flex justify-end">
                  <Button
                    type="button"
                    onClick={handleUseTicket}
                    disabled={isUsingTicket || (plan.remainingCount ?? 0) <= 0 || isDeleting || isSaving}
                  >
                    <MinusCircle className="h-4 w-4 mr-2" />
                    {isUsingTicket ? '使用処理中...' : '1回使用する'}
                  </Button>
                </div>
              </div>
            </SectionCard>
          ) : (
            <SectionCard title="サブスク情報" className="mb-6">
              <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                <div className="rounded-lg bg-primary/5 p-4">
                  <p className="text-sm text-muted-foreground">開始日</p>
                  <p className="mt-1 text-xl font-semibold">{formatDate(plan.startDate)}</p>
                </div>
                <div className="rounded-lg bg-primary/5 p-4">
                  <p className="text-sm text-muted-foreground">終了日</p>
                  <p className="mt-1 text-xl font-semibold">{formatDate(plan.endDate)}</p>
                </div>
              </div>
            </SectionCard>
          )}

          <SectionCard title="期間情報" className="mb-6">
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <p className="text-sm text-muted-foreground">開始日</p>
                <p className="font-medium">{formatDate(plan.startDate)}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">終了日</p>
                <p className="font-medium">{formatDate(plan.endDate)}</p>
              </div>
            </div>
          </SectionCard>

          {isTicket && (
            <SectionCard title="使用履歴">
              {usages.length > 0 ? (
                <div className="space-y-3">
                  {usages.map((usage) => (
                    <div key={usage.id} className="rounded-lg border p-4">
                      <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                        <div>
                          <p className="font-medium">
                            {new Date(usage.usedAt).toLocaleString('ja-JP')}
                          </p>
                          <p className="mt-1 text-sm text-muted-foreground whitespace-pre-wrap">
                            {usage.note || 'メモなし'}
                          </p>
                        </div>
                        <Badge variant="secondary">1回使用</Badge>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <EmptyState
                  title="使用履歴はありません"
                  description="この回数券を使用すると、ここに履歴が表示されます。"
                />
              )}
            </SectionCard>
          )}
        </>
      )}
    </div>
  );
}
