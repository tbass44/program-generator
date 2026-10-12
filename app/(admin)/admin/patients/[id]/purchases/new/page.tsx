'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ChevronLeft, Plus, Trash2 } from 'lucide-react';
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

type ProductMaster = {
  id: string;
  name: string;
  category: string;
  description: string;
  concerns: string;
  reasonTemplate: string;
  price: number;
  inventoryCount: number;
  url: string;
  status: string;
  createdAt: string;
  updatedAt: string;
};

type ProductsResponse = {
  products?: ProductMaster[];
  error?: string;
  detail?: unknown;
};

type PurchaseChoice = {
  value: string;
  source: 'recommendation' | 'product';
  id: string;
  productId: string | null;
  recommendationId: string | null;
  productName: string;
  category: string;
  status: string;
  reason: string;
  price: number | null;
};

type PurchaseProduct = {
  id: string;
  name: string;
  category: string;
  description: string | null;
  price: number | null;
  product_url: string | null;
};

type PurchaseProgram = {
  id: string;
  summary: string | null;
  created_at: string;
};

type PurchaseRecommendation = {
  id: string;
  product_id: string | null;
  program_id: string | null;
  reason: string | null;
  status: string;
};

type PurchaseHistory = {
  id: string;
  patientId: string;
  productId: string | null;
  recommendationId: string | null;
  programId: string | null;
  purchasedAt: string;
  quantity: number;
  unitPrice: number | null;
  totalPrice: number | null;
  note: string | null;
  createdAt: string;
  updatedAt: string;
  product: PurchaseProduct | null;
  program: PurchaseProgram | null;
  recommendation: PurchaseRecommendation | null;
};

type PatientPurchasesResponse = {
  purchases?: PurchaseHistory[];
  error?: string;
  detail?: unknown;
};

type CreatePurchaseResponse = {
  purchase?: {
    id: string;
  };
  purchases?: PurchaseHistory[];
  error?: string;
  detail?: unknown;
};

type DeletePurchaseResponse = {
  deleted?: boolean;
  id?: string;
  error?: string;
  detail?: unknown;
};

type PurchaseFormData = {
  purchaseChoice: string;
  purchasedAt: string;
  quantity: string;
  unitPrice: string;
  totalPrice: string;
  note: string;
};

const purchaseHistoryPageSize = 5;

const categoryLabels: Record<string, string> = {
  physical_sleep: '物理療法（睡眠）',
  nutrition: '栄養療法',
  exercise: '運動療法',
  skincare: 'スキンケア',
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

function formatPrice(value: number | null | undefined) {
  if (typeof value !== 'number') {
    return '金額未設定';
  }

  return `${value.toLocaleString('ja-JP')}円`;
}

function formatCategory(value: string | null | undefined) {
  if (!value) {
    return 'カテゴリ未設定';
  }

  return categoryLabels[value] ?? value;
}

function shouldShowRecommendation(item: PatientProductRecommendation) {
  return item.status === '購入希望' || item.status === '提案中';
}

function buildRecommendationChoice(item: PatientProductRecommendation): PurchaseChoice {
  return {
    value: `recommendation:${item.id}`,
    source: 'recommendation',
    id: item.id,
    productId: item.productId,
    recommendationId: item.id,
    productName: item.productName,
    category: item.category,
    status: item.status,
    reason: item.reason,
    price: null,
  };
}

function buildProductChoice(product: ProductMaster): PurchaseChoice {
  return {
    value: `product:${product.id}`,
    source: 'product',
    id: product.id,
    productId: product.id,
    recommendationId: null,
    productName: product.name,
    category: product.category,
    status: product.status,
    reason: product.description || product.reasonTemplate,
    price: product.price,
  };
}

function getPurchaseProductName(purchase: PurchaseHistory) {
  return purchase.product?.name ?? '商品名未設定';
}

function getPurchaseCategory(purchase: PurchaseHistory) {
  return formatCategory(purchase.product?.category);
}

export default function AdminPatientPurchaseNewPage() {
  const params = useParams();
  const patientId = typeof params.id === 'string' ? params.id : '';

  const [patient, setPatient] = useState<PatientDetail | null>(null);
  const [recommendations, setRecommendations] = useState<PatientProductRecommendation[]>([]);
  const [products, setProducts] = useState<ProductMaster[]>([]);
  const [purchaseHistory, setPurchaseHistory] = useState<PurchaseHistory[]>([]);
  const [purchaseHistoryPage, setPurchaseHistoryPage] = useState(1);
  const [formData, setFormData] = useState<PurchaseFormData>({
    purchaseChoice: '',
    purchasedAt: getTodayDateString(),
    quantity: '1',
    unitPrice: '',
    totalPrice: '',
    note: '',
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [deletingPurchaseId, setDeletingPurchaseId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const recommendationChoices = useMemo(
    () => recommendations.filter(shouldShowRecommendation).map(buildRecommendationChoice),
    [recommendations]
  );

  const productChoices = useMemo(
    () => products.filter((item) => item.status === '有効').map(buildProductChoice),
    [products]
  );

  const allChoices = useMemo(
    () => [...recommendationChoices, ...productChoices],
    [recommendationChoices, productChoices]
  );

  const selectedChoice = useMemo(
    () => allChoices.find((item) => item.value === formData.purchaseChoice) ?? null,
    [allChoices, formData.purchaseChoice]
  );

  const purchaseHistoryTotalPages = Math.max(
    1,
    Math.ceil(purchaseHistory.length / purchaseHistoryPageSize)
  );

  const currentPurchaseHistory = useMemo(() => {
    const start = (purchaseHistoryPage - 1) * purchaseHistoryPageSize;
    return purchaseHistory.slice(start, start + purchaseHistoryPageSize);
  }, [purchaseHistory, purchaseHistoryPage]);

  useEffect(() => {
    if (purchaseHistoryPage > purchaseHistoryTotalPages) {
      setPurchaseHistoryPage(purchaseHistoryTotalPages);
    }
  }, [purchaseHistoryPage, purchaseHistoryTotalPages]);

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

        const [patientResponse, recommendationsResponse, productsResponse, purchasesResponse] = await Promise.all([
          fetch(`/api/admin/patients/${patientId}`),
          fetch(`/api/admin/patients/${patientId}/recommendations`),
          fetch('/api/admin/products'),
          fetch(`/api/admin/patients/${patientId}/purchases`),
        ]);

        const patientData = (await patientResponse.json()) as PatientDetailResponse;
        const recommendationsData =
          (await recommendationsResponse.json()) as PatientRecommendationsResponse;
        const productsData = (await productsResponse.json()) as ProductsResponse;
        const purchasesData = (await purchasesResponse.json()) as PatientPurchasesResponse;

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

        if (!productsResponse.ok || !productsData.products) {
          setErrorMessage(
            buildApiErrorMessage('商品マスタを取得できませんでした', productsResponse.status, productsData)
          );
          return;
        }

        if (!purchasesResponse.ok || !purchasesData.purchases) {
          setErrorMessage(
            buildApiErrorMessage('購入履歴を取得できませんでした', purchasesResponse.status, purchasesData)
          );
          return;
        }

        const nextRecommendations = recommendationsData.recommendations;
        const nextProducts = productsData.products;
        const nextRecommendationChoices = nextRecommendations
          .filter(shouldShowRecommendation)
          .map(buildRecommendationChoice);
        const nextProductChoices = nextProducts
          .filter((item) => item.status === '有効')
          .map(buildProductChoice);
        const firstChoice = nextRecommendationChoices[0] ?? nextProductChoices[0] ?? null;

        setPatient(patientData.patient);
        setRecommendations(nextRecommendations);
        setProducts(nextProducts);
        setPurchaseHistory(purchasesData.purchases);
        setPurchaseHistoryPage(1);

        if (firstChoice) {
          setFormData((current) => {
            const nextUnitPrice =
              current.unitPrice || typeof firstChoice.price === 'number'
                ? String(firstChoice.price ?? '')
                : current.unitPrice;

            const quantity = Number(current.quantity);
            const nextTotalPrice =
              nextUnitPrice && Number.isInteger(quantity) && quantity > 0
                ? String(quantity * Number(nextUnitPrice))
                : current.totalPrice;

            return {
              ...current,
              purchaseChoice: firstChoice.value,
              unitPrice: nextUnitPrice,
              totalPrice: nextTotalPrice,
            };
          });
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

  const handlePurchaseChoiceChange = (value: string) => {
    const nextChoice = allChoices.find((item) => item.value === value) ?? null;

    setFormData((current) => {
      const nextData = {
        ...current,
        purchaseChoice: value,
      };

      if (nextChoice?.source === 'product' && typeof nextChoice.price === 'number') {
        const quantity = Number(current.quantity);
        return {
          ...nextData,
          unitPrice: String(nextChoice.price),
          totalPrice:
            Number.isInteger(quantity) && quantity > 0
              ? String(quantity * nextChoice.price)
              : current.totalPrice,
        };
      }

      return nextData;
    });
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!patientId) {
      setErrorMessage('患者IDを取得できませんでした。');
      return;
    }

    if (!selectedChoice) {
      setErrorMessage('購入対象の商品を選択してください。');
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
          recommendationId: selectedChoice.recommendationId,
          productId: selectedChoice.productId,
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

      if (data.purchases) {
        setPurchaseHistory(data.purchases);
        setPurchaseHistoryPage(1);
      }

      setFormData((current) => ({
        ...current,
        purchasedAt: getTodayDateString(),
        quantity: '1',
        totalPrice: '',
        note: '',
      }));
      setSuccessMessage('購入記録を追加しました。下の購入履歴に反映されています。');
    } catch (error) {
      console.error(error);
      setErrorMessage(`購入記録の追加中にエラーが発生しました。${String(error)}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeletePurchase = async (purchase: PurchaseHistory) => {
    if (!patientId) {
      setErrorMessage('患者IDを取得できませんでした。');
      return;
    }

    const confirmed = window.confirm(
      `購入履歴「${getPurchaseProductName(purchase)}」を削除します。\nこの操作は元に戻せません。削除してもよろしいですか？`
    );

    if (!confirmed) {
      return;
    }

    try {
      setDeletingPurchaseId(purchase.id);
      setErrorMessage(null);
      setSuccessMessage(null);

      const response = await fetch(`/api/admin/patients/${patientId}/purchases/${purchase.id}`, {
        method: 'DELETE',
      });

      const data = (await response.json()) as DeletePurchaseResponse;

      if (!response.ok || !data.deleted) {
        setErrorMessage(buildApiErrorMessage('購入履歴を削除できませんでした', response.status, data));
        return;
      }

      setPurchaseHistory((current) => current.filter((item) => item.id !== purchase.id));
      setSuccessMessage('購入履歴を削除しました。');
    } catch (error) {
      console.error(error);
      setErrorMessage(`購入履歴の削除中にエラーが発生しました。${String(error)}`);
    } finally {
      setDeletingPurchaseId(null);
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
        <div className="space-y-6">
          <SectionCard title="購入内容">
            {allChoices.length === 0 ? (
              <div className="rounded-lg border bg-muted/30 p-4 text-sm text-muted-foreground">
                購入対象の商品がありません。先に商品マスタを登録してください。
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="purchase-choice">購入対象の商品</Label>
                  <select
                    id="purchase-choice"
                    value={formData.purchaseChoice}
                    onChange={(event) => handlePurchaseChoiceChange(event.target.value)}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    required
                  >
                    {recommendationChoices.length > 0 && (
                      <optgroup label="商品提案から選ぶ">
                        {recommendationChoices.map((item) => (
                          <option key={item.value} value={item.value}>
                            {item.productName} / {item.category} / {item.status}
                          </option>
                        ))}
                      </optgroup>
                    )}
                    {productChoices.length > 0 && (
                      <optgroup label="商品マスタから選ぶ">
                        {productChoices.map((item) => (
                          <option key={item.value} value={item.value}>
                            {item.productName} / {item.category}
                          </option>
                        ))}
                      </optgroup>
                    )}
                  </select>
                  {selectedChoice && (
                    <p className="text-xs text-muted-foreground">
                      {selectedChoice.source === 'recommendation' ? '商品提案' : '商品マスタ'}から登録：
                      {selectedChoice.reason || '説明・提案理由は未入力'}
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

          <SectionCard
            title="購入履歴"
            description={`登録済みの購入履歴：${purchaseHistory.length}件`}
          >
            {purchaseHistory.length === 0 ? (
              <div className="rounded-lg border bg-muted/30 p-4 text-sm text-muted-foreground">
                購入履歴はまだありません。
              </div>
            ) : (
              <div className="space-y-4">
                <div className="space-y-3">
                  {currentPurchaseHistory.map((purchase) => (
                    <div key={purchase.id} className="rounded-lg border p-4">
                      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="font-medium">{getPurchaseProductName(purchase)}</p>
                            <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                              {getPurchaseCategory(purchase)}
                            </span>
                            <span className="rounded-full bg-emerald-600 px-2 py-0.5 text-xs text-white">
                              購入済み
                            </span>
                          </div>
                          <p className="mt-2 text-sm text-muted-foreground">
                            購入日: {formatDate(purchase.purchasedAt)} / 数量: {purchase.quantity}
                          </p>
                          {purchase.note && (
                            <p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">
                              {purchase.note}
                            </p>
                          )}
                        </div>
                        <div className="flex flex-col gap-2 text-left text-sm md:items-end md:text-right">
                          <div>
                            <p className="font-medium">{formatPrice(purchase.totalPrice)}</p>
                            <p className="mt-1 text-xs text-muted-foreground">
                              単価: {formatPrice(purchase.unitPrice)}
                            </p>
                          </div>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            disabled={deletingPurchaseId === purchase.id}
                            onClick={() => handleDeletePurchase(purchase)}
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            {deletingPurchaseId === purchase.id ? '削除中...' : '削除'}
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="flex flex-col gap-3 border-t pt-4 text-sm text-muted-foreground md:flex-row md:items-center md:justify-between">
                  <p>
                    {purchaseHistoryPage} / {purchaseHistoryTotalPages} ページ
                  </p>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={purchaseHistoryPage <= 1}
                      onClick={() => setPurchaseHistoryPage((current) => Math.max(1, current - 1))}
                    >
                      前へ
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={purchaseHistoryPage >= purchaseHistoryTotalPages}
                      onClick={() =>
                        setPurchaseHistoryPage((current) =>
                          Math.min(purchaseHistoryTotalPages, current + 1)
                        )
                      }
                    >
                      次へ
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </SectionCard>
        </div>
      )}
    </div>
  );
}
