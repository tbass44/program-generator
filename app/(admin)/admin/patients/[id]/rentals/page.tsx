'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams, usePathname } from 'next/navigation';
import { ChevronLeft, Pencil, Save, Trash2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PageHeader, SectionCard } from '@/components/admin';

type PatientDetail = {
  id: string;
  name: string;
};

type RentalItem = {
  id: string;
  patientId: string;
  programId: string | null;
  productId: string | null;
  productName: string;
  productUrl: string;
  category: string;
  reason: string;
  status: 'レンタル希望' | 'レンタル中' | 'レンタル終了' | string;
  programSummary: string;
  programCreatedAt: string | null;
  rentalStartedAt: string;
  rentalUpdatedAt: string;
  createdAt: string;
  updatedAt: string;
};

type RentalsResponse = {
  patient?: PatientDetail;
  rentals?: RentalItem[];
  error?: string;
  detail?: unknown;
};

type UpdateRentalResponse = {
  rental?: {
    id: string;
    patientId: string;
    status: string;
    reason: string;
    updatedAt: string;
  };
  error?: string;
  detail?: unknown;
};

type DeleteRentalResponse = {
  deleted?: boolean;
  id?: string;
  error?: string;
  detail?: unknown;
};

type RentalEditForm = {
  status: string;
  reason: string;
};

const rentalPageSize = 5;
const rentalStatuses = ['レンタル希望', 'レンタル中', 'レンタル終了'];

function buildApiErrorMessage(prefix: string, status: number, data: { error?: string; detail?: unknown }) {
  const detailText = data.detail ? ` / detail: ${String(data.detail)}` : '';
  const errorText = data.error ? ` / error: ${data.error}` : '';

  return `${prefix}（HTTP ${status}${errorText}${detailText}）`;
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function getPatientIdFromParams(idParam: string | string[] | undefined, pathname: string) {
  const paramValue = Array.isArray(idParam) ? idParam[0] : idParam;

  if (paramValue && isUuid(paramValue)) {
    return paramValue;
  }

  const pathMatch = pathname.match(/\/admin\/patients\/([0-9a-f-]{36})\/rentals/i);
  const pathValue = pathMatch?.[1];

  if (pathValue && isUuid(pathValue)) {
    return pathValue;
  }

  return '';
}

function formatDate(value: string | null | undefined) {
  if (!value) {
    return '未設定';
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleDateString('ja-JP');
}

function getStatusBadgeClass(status: string) {
  switch (status) {
    case 'レンタル希望':
      return 'bg-amber-600 text-white';
    case 'レンタル中':
      return 'bg-blue-600 text-white';
    case 'レンタル終了':
      return 'bg-slate-600 text-white';
    default:
      return 'bg-muted text-muted-foreground';
  }
}

export default function AdminPatientRentalsPage() {
  const params = useParams();
  const pathname = usePathname();
  const patientId = getPatientIdFromParams(params.id, pathname);

  const [patient, setPatient] = useState<PatientDetail | null>(null);
  const [rentals, setRentals] = useState<RentalItem[]>([]);
  const [rentalPage, setRentalPage] = useState(1);
  const [editingRentalId, setEditingRentalId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<RentalEditForm>({ status: 'レンタル中', reason: '' });
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [deletingRentalId, setDeletingRentalId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const rentalTotalPages = Math.max(1, Math.ceil(rentals.length / rentalPageSize));

  const currentRentals = useMemo(() => {
    const start = (rentalPage - 1) * rentalPageSize;
    return rentals.slice(start, start + rentalPageSize);
  }, [rentals, rentalPage]);

  useEffect(() => {
    if (rentalPage > rentalTotalPages) {
      setRentalPage(rentalTotalPages);
    }
  }, [rentalPage, rentalTotalPages]);

  const refreshRentals = async () => {
    if (!patientId) {
      setErrorMessage('患者IDを取得できませんでした。患者詳細画面から開き直してください。');
      return false;
    }

    const response = await fetch(`/api/admin/patients/${patientId}/rentals`, {
      cache: 'no-store',
    });
    const data = (await response.json()) as RentalsResponse;

    if (!response.ok || !data.rentals || !data.patient) {
      setErrorMessage(buildApiErrorMessage('レンタル履歴を取得できませんでした', response.status, data));
      return false;
    }

    setPatient(data.patient);
    setRentals(data.rentals);
    return true;
  };

  useEffect(() => {
    const fetchInitialData = async () => {
      try {
        setIsLoading(true);
        setErrorMessage(null);
        await refreshRentals();
      } catch (error) {
        console.error(error);
        setErrorMessage(`レンタル履歴の取得中にエラーが発生しました。${String(error)}`);
      } finally {
        setIsLoading(false);
      }
    };

    fetchInitialData();
  }, [patientId]);

  const handleEditRental = (rental: RentalItem) => {
    setEditingRentalId(rental.id);
    setEditForm({
      status: rental.status || 'レンタル中',
      reason: rental.reason || '',
    });
    setErrorMessage(null);
    setSuccessMessage('レンタル履歴を編集中です。内容を修正して「保存」を押してください。');
  };

  const handleCancelEdit = () => {
    setEditingRentalId(null);
    setEditForm({ status: 'レンタル中', reason: '' });
    setSuccessMessage(null);
  };

  const handleUpdateRental = async (rental: RentalItem) => {
    if (!patientId) {
      setErrorMessage('患者IDを取得できませんでした。患者詳細画面から開き直してください。');
      return;
    }

    try {
      setIsSaving(true);
      setErrorMessage(null);
      setSuccessMessage(null);

      const response = await fetch(`/api/admin/patients/${patientId}/rentals/${rental.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          status: editForm.status,
          reason: editForm.reason,
        }),
      });

      const data = (await response.json()) as UpdateRentalResponse;

      if (!response.ok || !data.rental) {
        setErrorMessage(buildApiErrorMessage('レンタル履歴を更新できませんでした', response.status, data));
        return;
      }

      const refreshed = await refreshRentals();
      if (!refreshed) {
        return;
      }

      setEditingRentalId(null);
      setSuccessMessage('レンタル履歴を更新しました。');
    } catch (error) {
      console.error(error);
      setErrorMessage(`レンタル履歴の更新中にエラーが発生しました。${String(error)}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteRental = async (rental: RentalItem) => {
    if (!patientId) {
      setErrorMessage('患者IDを取得できませんでした。患者詳細画面から開き直してください。');
      return;
    }

    const confirmed = window.confirm(
      `レンタル履歴「${rental.productName}」を削除します。\nこの操作は元に戻せません。削除してもよろしいですか？`
    );

    if (!confirmed) {
      return;
    }

    try {
      setDeletingRentalId(rental.id);
      setErrorMessage(null);
      setSuccessMessage(null);

      const response = await fetch(`/api/admin/patients/${patientId}/rentals/${rental.id}`, {
        method: 'DELETE',
      });

      const data = (await response.json()) as DeleteRentalResponse;

      if (!response.ok || !data.deleted) {
        setErrorMessage(buildApiErrorMessage('レンタル履歴を削除できませんでした', response.status, data));
        return;
      }

      setRentals((current) => current.filter((item) => item.id !== rental.id));
      if (editingRentalId === rental.id) {
        handleCancelEdit();
      }
      setSuccessMessage('レンタル履歴を削除しました。');
    } catch (error) {
      console.error(error);
      setErrorMessage(`レンタル履歴の削除中にエラーが発生しました。${String(error)}`);
    } finally {
      setDeletingRentalId(null);
    }
  };

  return (
    <div>
      <PageHeader
        title="レンタル履歴管理"
        description={patient ? `${patient.name}さんのレンタル履歴を確認・更新します` : 'レンタル履歴を確認・更新します'}
        backHref={patientId ? `/admin/patients/${patientId}` : '/admin/patients'}
      />

      {errorMessage && (
        <div className="mb-4 rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive whitespace-pre-wrap">
          {errorMessage}
        </div>
      )}

      {successMessage && (
        <div className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700">
          {successMessage}
        </div>
      )}

      {isLoading ? (
        <div className="rounded-lg border bg-card p-6 text-sm text-muted-foreground">
          読み込み中です...
        </div>
      ) : (
        <SectionCard
          title="レンタル履歴"
          description={`登録済みのレンタル履歴：${rentals.length}件`}
        >
          {rentals.length === 0 ? (
            <div className="rounded-lg border bg-muted/30 p-4 text-sm text-muted-foreground">
              レンタル履歴はまだありません。
            </div>
          ) : (
            <div className="space-y-4">
              <div className="space-y-3">
                {currentRentals.map((rental) => {
                  const isEditing = editingRentalId === rental.id;

                  return (
                    <div key={rental.id} className="rounded-lg border p-4">
                      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="font-medium">{rental.productName}</p>
                            <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                              {rental.category}
                            </span>
                            <span className={`rounded-full px-2 py-0.5 text-xs ${getStatusBadgeClass(rental.status)}`}>
                              {rental.status}
                            </span>
                            {isEditing && (
                              <span className="rounded-full bg-blue-600 px-2 py-0.5 text-xs text-white">
                                編集中
                              </span>
                            )}
                          </div>

                          <p className="mt-2 text-sm text-muted-foreground">
                            開始相当: {formatDate(rental.rentalStartedAt)} / 最終更新: {formatDate(rental.rentalUpdatedAt)}
                          </p>

                          {rental.programSummary && (
                            <p className="mt-2 text-sm text-muted-foreground">
                              関連プログラム: {rental.programSummary}
                            </p>
                          )}

                          {isEditing ? (
                            <div className="mt-4 space-y-3">
                              <div className="space-y-2">
                                <label className="text-sm font-medium" htmlFor={`rental-status-${rental.id}`}>
                                  ステータス
                                </label>
                                <select
                                  id={`rental-status-${rental.id}`}
                                  value={editForm.status}
                                  onChange={(event) =>
                                    setEditForm((current) => ({ ...current, status: event.target.value }))
                                  }
                                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm md:max-w-xs"
                                >
                                  {rentalStatuses.map((status) => (
                                    <option key={status} value={status}>
                                      {status}
                                    </option>
                                  ))}
                                </select>
                              </div>

                              <div className="space-y-2">
                                <label className="text-sm font-medium" htmlFor={`rental-reason-${rental.id}`}>
                                  メモ・提案理由
                                </label>
                                <textarea
                                  id={`rental-reason-${rental.id}`}
                                  value={editForm.reason}
                                  onChange={(event) =>
                                    setEditForm((current) => ({ ...current, reason: event.target.value }))
                                  }
                                  className="flex min-h-[100px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                                  placeholder="例：次回来院時に返却予定、使用感を確認"
                                />
                              </div>
                            </div>
                          ) : (
                            rental.reason && (
                              <p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">
                                {rental.reason}
                              </p>
                            )
                          )}
                        </div>

                        <div className="flex flex-wrap gap-2 md:justify-end">
                          {isEditing ? (
                            <>
                              <Button
                                type="button"
                                size="sm"
                                disabled={isSaving}
                                onClick={() => handleUpdateRental(rental)}
                              >
                                <Save className="mr-2 h-4 w-4" />
                                {isSaving ? '保存中...' : '保存'}
                              </Button>
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                disabled={isSaving}
                                onClick={handleCancelEdit}
                              >
                                <X className="mr-2 h-4 w-4" />
                                キャンセル
                              </Button>
                            </>
                          ) : (
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              disabled={isSaving || deletingRentalId === rental.id}
                              onClick={() => handleEditRental(rental)}
                            >
                              <Pencil className="mr-2 h-4 w-4" />
                              編集
                            </Button>
                          )}

                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            disabled={isSaving || deletingRentalId === rental.id}
                            onClick={() => handleDeleteRental(rental)}
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            {deletingRentalId === rental.id ? '削除中...' : '削除'}
                          </Button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="flex flex-col gap-3 border-t pt-4 text-sm text-muted-foreground md:flex-row md:items-center md:justify-between">
                <p>
                  {rentalPage} / {rentalTotalPages} ページ
                </p>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={rentalPage <= 1}
                    onClick={() => setRentalPage((current) => Math.max(1, current - 1))}
                  >
                    前へ
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={rentalPage >= rentalTotalPages}
                    onClick={() =>
                      setRentalPage((current) => Math.min(rentalTotalPages, current + 1))
                    }
                  >
                    次へ
                  </Button>
                </div>
              </div>
            </div>
          )}
        </SectionCard>
      )}

      <div className="mt-6">
        <Link href={patientId ? `/admin/patients/${patientId}` : '/admin/patients'}>
          <Button type="button" variant="outline">
            <ChevronLeft className="mr-2 h-4 w-4" />
            患者詳細へ戻る
          </Button>
        </Link>
      </div>
    </div>
  );
}
