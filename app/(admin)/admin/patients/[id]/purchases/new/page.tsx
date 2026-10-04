'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { ChevronLeft, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PageHeader, SectionCard } from '@/components/admin';

type PatientDetail = {
  id: string;
  name: string;
};

type PatientDetailResponse = {
  patient?: PatientDetail;
  error?: string;
  detail?: unknown;
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

type PatientRecommendationsResponse = {
  recommendations?: PatientProductRecommendation[];
  error?: string;
  detail?: unknown;
};

type CreatePurchaseResponse = {
  purchase?: {
    id: string;
  };
  purchases?: unknown[];
  error?: string;
  detail?: unknown;
};

type PurchaseFormData = {
  recommendationId: string;
  purchasedAt: string;
  quantity: string;
  unitPrice: string;
  totalPrice: string;
  note: string;
};

function getTodayDateString() {
  return new Date().toISOString().slice(0, 10);
}

function buildApiErrorMessage(prefix: string, status: number, data: { error?: string; detail?: unknown }) {
  const detailText = data.detail ? ` / detail: ${String(data.detail)}` : '';
  const errorText = data.error ? ` / error: ${data.error}` : '';

  return `${prefix}（HTTP ${status}${errorText}${detailText}）`;
}

function toNumberOrNull(value: string) {
  if (!value.trim()) {
    return null;
  }

  return Number(value);
}

export default function AdminPatientPurchaseNewPage() {
  const params = useParams();
  const router = useRouter();
  const patientId = typeof params.id === 'string' ? params.id : '';

  const [patient, setPatient] = useState<PatientDetail | null>(null);
  const [recommendations, setRecommendations] = useState<PatientProductRecommendation[]>([]);
  const [formData, setFormData] = useState<PurchaseFormData>({
    recommendationId: '',
    purchasedAt: getTodayDateString(),
    quantity: '1',
    unitPrice: '',
    totalPrice: '',
    note: '',
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const purchaseRecommendations = useMemo(
    () => recommendations.filter((item) => item.status === '購入希望'),
    [recommendations]
  );

  const selectedRecommendation = useMemo(
    () => recommendations.find((item) => item.id === formData.recommendationId) ?? null,
    [formData.recommendationId, recommendations]
  );

  useEffect(() => {
    const fetchInitialData = async () => {
      if (!patientId) {
        setErrorMessage('患者IDを取得できませんでした。');
        setIsLoading(false);
        return;
      }

      try {
        setIsLoading(true);
        setErrorMessage(null);

        const [patientResponse, recommendationsResponse] = await Promise.all([
          fetch(`/api/admin/patients/${patientId}`),
          fetch(`/api/admin/patients/${patientId}/recommendations`),
        ]);

        const patientData = (await patientResponse.json()) as PatientDetailResponse;
        const recommendationsData =
          (await recommendationsResponse.json()) as PatientRecommendationsResponse;

        if (!patientResponse.ok || !patientData.patient) {
          setErrorMessage(
            buildApiErrorMessage('患者情報を取得できませんでした', patientResponse.status, patientData)
          );
          return;
        }

        if (!recommendationsResponse.ok || !recommendationsData.recommendations) {
          setErrorMessage(
            buildApiErrorMessage(
              '商品提案を取得できませんでした',
              recommendationsResponse.status,
              recommendationsData
            )
          );
          return;
        }

        setPatient(patientData.patient);
        setRecommendations(recommendationsData.recommendations);

        const firstPurchaseRequest = recommendationsData.recommendations.find(
          (item) => item.status === '購入希望'
        );

        if (firstPurchaseRequest) {
          setFormData((current) => ({
            ...current,
            recommendationId: firstPurchaseRequest.id,
          }));
        }
      } catch (error) {
        console.error(error);
        setErrorMessage(`初期データの取得中にエラーが発生しました。${String(error)}`);
      } finally {
        setIsLoading(false);
      }
    };

    fetchInitialData();
  }, [patientId]);

  const handleQuantityOrUnitPriceChange = (nextData: Partial<PurchaseFormData>) => {
    setFormData((current) => {
      const merged = { ...current, ...nextData };
      const quantity = Number(merged.quantity);
      const unitPrice = Number(merged.unitPrice);

      if (
        Number.isInteger(quantity) &&
        quantity > 0 &&
        Number.isInteger(unitPrice) &&
        unitPrice >= 0
      ) {
        return {
          ...merged,
          totalPrice: String(quantity * unitPrice),
        };
      }

      return merged;
    });
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!patientId) {
      setErrorMessage('患者IDを取得できませんでした。');
      return;
    }

    if (!formData.recommendationId) {
      setErrorMessage('購入対象の商品提案を選択してください。');
      return;
    }

    if (!formData.purchasedAt) {
      setErrorMessage('購入日を入力してください。');
      return;
    }

    const quantity = Number(formData.quantity);

    if (!Number.isInteger(quantity) || quantity <= 0) {
      setErrorMessage('数量は1以上の整数で入力してください。');
      return;
    }

    try {
      setIsSaving(true);
      setErrorMessage(null);
      setSuccessMessage(null);

      const response = await fetch(`/api/admin/patients/${patientId}/purchases`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          recommendationId: formData.recommendationId,
          purchasedAt: formData.purchasedAt,
          quantity,
          unitPrice: toNumberOrNull(formData.unitPrice),
          totalPrice: toNumberOrNull(formData.totalPrice),
          note: formData.note,
        }),
      });

      const data = (await response.json()) as CreatePurchaseResponse;

      if (!response.ok || !data.purchase) {
        setErrorMessage(buildApiErrorMessage('購入記録を追加できませんでした', response.status, data));
        return;
      }

      setSuccessMessage('購入記録を追加しました。患者側の購入履歴に表示されます。');
      window.setTimeout(() => {
        router.push(`/admin/patients/${patientId}`);
      }, 600);
    } catch (error) {
      console.error(error);
      setErrorMessage(`購入記録の追加中にエラーが発生しました。${String(error)}`);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div>
      <PageHeader
        title="購入記録を追加"
        description={patient ? `${patient.name}さんの商品購入履歴を登録します` : '商品購入履歴を登録します'}
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
        <SectionCard title="購入内容">
          {purchaseRecommendations.length === 0 ? (
            <div className="rounded-lg border bg-muted/30 p-4 text-sm text-muted-foreground">
              購入希望の商品提案がありません。先に商品提案を「購入希望」にしてください。
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="recommendation">購入対象の商品提案</Label>
                <select
                  id="recommendation"
                  value={formData.recommendationId}
                  onChange={(event) =>
                    setFormData({ ...formData, recommendationId: event.target.value })
                  }
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  required
                >
                  {purchaseRecommendations.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.productName} / {item.category}
                    </option>
                  ))}
                </select>
                {selectedRecommendation && (
                  <p className="text-xs text-muted-foreground">
                    提案理由: {selectedRecommendation.reason || '未入力'}
                  </p>
                )}
              </div>

              <div className="grid gap-4 md:grid-cols-3">
                <div className="space-y-2">
                  <Label htmlFor="purchased-at">購入日</Label>
                  <Input
                    id="purchased-at"
                    type="date"
                    value={formData.purchasedAt}
                    onChange={(event) =>
                      setFormData({ ...formData, purchasedAt: event.target.value })
                    }
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="quantity">数量</Label>
                  <Input
                    id="quantity"
                    type="number"
                    min="1"
                    step="1"
                    value={formData.quantity}
                    onChange={(event) =>
                      handleQuantityOrUnitPriceChange({ quantity: event.target.value })
                    }
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="unit-price">単価</Label>
                  <Input
                    id="unit-price"
                    type="number"
                    min="0"
                    step="1"
                    value={formData.unitPrice}
                    onChange={(event) =>
                      handleQuantityOrUnitPriceChange({ unitPrice: event.target.value })
                    }
                    placeholder="例：2500"
                  />
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="total-price">合計金額</Label>
                  <Input
                    id="total-price"
                    type="number"
                    min="0"
                    step="1"
                    value={formData.totalPrice}
                    onChange={(event) =>
                      setFormData({ ...formData, totalPrice: event.target.value })
                    }
                    placeholder="自動計算、または手入力"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="note">メモ</Label>
                <textarea
                  id="note"
                  className="flex min-h-[100px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={formData.note}
                  onChange={(event) => setFormData({ ...formData, note: event.target.value })}
                  placeholder="例：1ヶ月分購入、次回来院時に継続確認"
                />
              </div>

              <div className="flex flex-wrap gap-3">
                <Button type="submit" disabled={isSaving}>
                  <Plus className="mr-2 h-4 w-4" />
                  {isSaving ? '追加中...' : '購入記録を追加'}
                </Button>
                <Link href={`/admin/patients/${patientId}`}>
                  <Button type="button" variant="outline" disabled={isSaving}>
                    <ChevronLeft className="mr-2 h-4 w-4" />
                    患者詳細へ戻る
                  </Button>
                </Link>
              </div>
            </form>
          )}
        </SectionCard>
      )}
    </div>
  );
}
