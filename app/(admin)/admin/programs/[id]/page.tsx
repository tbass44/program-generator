'use client';

import { useEffect, useState } from 'react';
import { ArrowLeft, Edit, Plus, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { PageHeader, SectionCard, ProgramSection } from '@/components/admin';
import { useRouter } from 'next/navigation';
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

type ProductOption = {
  id: string;
  name: string;
  category: string;
  description: string;
  concerns: string;
  reasonTemplate: string;
  price: number;
  inventoryCount: number;
  url: string;
  status: '有効' | '無効';
};

type RecommendationStatus = '提案中' | 'レンタル希望' | 'レンタル中' | '購入希望';

type ProgramRecommendation = {
  id: string;
  patientId: string;
  programId: string | null;
  productId: string | null;
  productName: string;
  category: string;
  reason: string;
  status: RecommendationStatus;
  createdAt: string;
  updatedAt: string;
};

type ProgramDetailResponse = {
  program?: ProgramDetail;
  patient?: ProgramPatient | null;
  error?: string;
  detail?: unknown;
};

type ProductsResponse = {
  products?: ProductOption[];
  error?: string;
  detail?: unknown;
};

type ProgramRecommendationsResponse = {
  recommendations?: ProgramRecommendation[];
  recommendation?: ProgramRecommendation;
  error?: string;
  detail?: unknown;
};

type RecommendationMutationResponse = {
  recommendation?: Partial<ProgramRecommendation> & {
    id: string;
    status?: RecommendationStatus;
    updatedAt?: string;
  };
  error?: string;
  detail?: unknown;
};

type DeleteRecommendationResponse = {
  deleted?: boolean;
  id?: string;
  error?: string;
  detail?: unknown;
};

const recommendationStatusOptions: RecommendationStatus[] = [
  '提案中',
  'レンタル希望',
  'レンタル中',
  '購入希望',
];

function formatApiError(status: number, data: ProgramDetailResponse) {
  const detail = typeof data.detail === 'string' ? ` / detail: ${data.detail}` : '';
  return `改善プログラムを取得できませんでした（HTTP ${status} / error: ${data.error ?? 'unknown'}${detail}）`;
}

function formatRecommendationApiError(
  status: number,
  data: ProgramRecommendationsResponse | RecommendationMutationResponse | DeleteRecommendationResponse
) {
  const detail = typeof data.detail === 'string' ? ` / detail: ${data.detail}` : '';
  return `商品提案を処理できませんでした（HTTP ${status} / error: ${data.error ?? 'unknown'}${detail}）`;
}

export default function AdminProgramDetailPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const [program, setProgram] = useState<ProgramDetail | null>(null);
  const [patient, setPatient] = useState<ProgramPatient | null>(null);
  const [products, setProducts] = useState<ProductOption[]>([]);
  const [recommendations, setRecommendations] = useState<ProgramRecommendation[]>([]);
  const [selectedProductId, setSelectedProductId] = useState('none');
  const [recommendationReason, setRecommendationReason] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingRecommendations, setIsLoadingRecommendations] = useState(true);
  const [isSavingRecommendation, setIsSavingRecommendation] = useState(false);
  const [updatingRecommendationId, setUpdatingRecommendationId] = useState<string | null>(null);
  const [deletingRecommendationId, setDeletingRecommendationId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [recommendationErrorMessage, setRecommendationErrorMessage] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    const fetchPageData = async () => {
      try {
        setIsLoading(true);
        setIsLoadingRecommendations(true);
        setErrorMessage(null);
        setRecommendationErrorMessage(null);

        const programResponse = await fetch(`/api/admin/programs/${params.id}`);
        const programData = (await programResponse.json()) as ProgramDetailResponse;

        if (!programResponse.ok || !programData.program) {
          setErrorMessage(formatApiError(programResponse.status, programData));
          setProgram(null);
          setPatient(null);
          setRecommendations([]);
          return;
        }

        setProgram(programData.program);
        setPatient(programData.patient ?? null);

        const [productsResponse, recommendationsResponse] = await Promise.all([
          fetch('/api/admin/products'),
          fetch(`/api/admin/programs/${params.id}/recommendations`),
        ]);

        const productsData = (await productsResponse.json()) as ProductsResponse;
        const recommendationsData =
          (await recommendationsResponse.json()) as ProgramRecommendationsResponse;

        if (!productsResponse.ok || !productsData.products) {
          setRecommendationErrorMessage('商品マスタを取得できませんでした。');
          setProducts([]);
        } else {
          setProducts(productsData.products.filter((product) => product.status === '有効'));
        }

        if (!recommendationsResponse.ok || !recommendationsData.recommendations) {
          setRecommendationErrorMessage(
            formatRecommendationApiError(recommendationsResponse.status, recommendationsData)
          );
          setRecommendations([]);
        } else {
          setRecommendations(recommendationsData.recommendations);
        }
      } catch (error) {
        console.error(error);
        setErrorMessage('改善プログラムの取得中にエラーが発生しました。');
        setProgram(null);
        setPatient(null);
        setRecommendations([]);
      } finally {
        setIsLoading(false);
        setIsLoadingRecommendations(false);
      }
    };

    fetchPageData();
  }, [params.id]);

  const handleProductChange = (productId: string) => {
    setSelectedProductId(productId);

    const selectedProduct = products.find((product) => product.id === productId);
    setRecommendationReason(selectedProduct?.reasonTemplate ?? '');
  };

  const handleDelete = async () => {
    const ok = window.confirm(
      'この改善プログラムを削除します。削除すると元に戻せません。よろしいですか？'
    );

    if (!ok) {
      return;
    }

    try {
      setIsDeleting(true);

      const response = await fetch(`/api/admin/programs/${params.id}`, {
        method: 'DELETE',
      });

      const data = await response.json();

      if (!response.ok || !data.deleted) {
        toast.error('改善プログラムを削除できませんでした');
        setErrorMessage(
          `削除に失敗しました（HTTP ${response.status} / error: ${data.error ?? 'unknown'}）`
        );
        return;
      }

      toast.success('改善プログラムを削除しました');
      router.push('/admin/programs');
      router.refresh();
    } catch (error) {
      console.error(error);
      toast.error('改善プログラムを削除できませんでした');
      setErrorMessage('改善プログラムの削除中にエラーが発生しました。');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleAddRecommendation = async () => {
    if (selectedProductId === 'none') {
      toast.error('提案する商品を選択してください');
      return;
    }

    try {
      setIsSavingRecommendation(true);
      setRecommendationErrorMessage(null);

      const response = await fetch(`/api/admin/programs/${params.id}/recommendations`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          productId: selectedProductId,
          reason: recommendationReason,
        }),
      });

      const data = (await response.json()) as ProgramRecommendationsResponse;

      if (!response.ok || !data.recommendation) {
        const message = formatRecommendationApiError(response.status, data);
        setRecommendationErrorMessage(message);
        toast.error('商品提案を追加できませんでした');
        return;
      }

      setRecommendations((prev) => [data.recommendation!, ...prev]);
      setSelectedProductId('none');
      setRecommendationReason('');
      toast.success('商品提案を追加しました');
    } catch (error) {
      console.error(error);
      setRecommendationErrorMessage('商品提案の追加中にエラーが発生しました。');
      toast.error('商品提案を追加できませんでした');
    } finally {
      setIsSavingRecommendation(false);
    }
  };

  const handleUpdateRecommendationStatus = async (
    recommendation: ProgramRecommendation,
    status: RecommendationStatus
  ) => {
    try {
      setUpdatingRecommendationId(recommendation.id);
      setRecommendationErrorMessage(null);

      const response = await fetch(
        `/api/admin/programs/${params.id}/recommendations/${recommendation.id}`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ status }),
        }
      );

      const data = (await response.json()) as RecommendationMutationResponse;

      if (!response.ok || !data.recommendation?.status) {
        const message = formatRecommendationApiError(response.status, data);
        setRecommendationErrorMessage(message);
        toast.error('商品提案ステータスを更新できませんでした');
        return;
      }

      setRecommendations((prev) =>
        prev.map((item) =>
          item.id === recommendation.id
            ? {
                ...item,
                status: data.recommendation?.status ?? status,
                updatedAt: data.recommendation?.updatedAt ?? item.updatedAt,
              }
            : item
        )
      );

      toast.success('商品提案ステータスを更新しました');
    } catch (error) {
      console.error(error);
      setRecommendationErrorMessage('商品提案ステータスの更新中にエラーが発生しました。');
      toast.error('商品提案ステータスを更新できませんでした');
    } finally {
      setUpdatingRecommendationId(null);
    }
  };

  const handleDeleteRecommendation = async (recommendation: ProgramRecommendation) => {
    const ok = window.confirm(
      `「${recommendation.productName}」の商品提案を削除します。よろしいですか？`
    );

    if (!ok) {
      return;
    }

    try {
      setDeletingRecommendationId(recommendation.id);
      setRecommendationErrorMessage(null);

      const response = await fetch(
        `/api/admin/programs/${params.id}/recommendations/${recommendation.id}`,
        {
          method: 'DELETE',
        }
      );

      const data = (await response.json()) as DeleteRecommendationResponse;

      if (!response.ok || !data.deleted) {
        const message = formatRecommendationApiError(response.status, data);
        setRecommendationErrorMessage(message);
        toast.error('商品提案を削除できませんでした');
        return;
      }

      setRecommendations((prev) => prev.filter((item) => item.id !== recommendation.id));
      toast.success('商品提案を削除しました');
    } catch (error) {
      console.error(error);
      setRecommendationErrorMessage('商品提案の削除中にエラーが発生しました。');
      toast.error('商品提案を削除できませんでした');
    } finally {
      setDeletingRecommendationId(null);
    }
  };

  if (isLoading) {
    return (
      <div className="max-w-4xl mx-auto">
        <PageHeader
          title="改善プログラム詳細"
          description="改善プログラムを読み込み中です"
          backHref="/admin/programs"
        />
        <SectionCard>
          <p className="text-sm text-muted-foreground">読み込み中です...</p>
        </SectionCard>
      </div>
    );
  }

  if (errorMessage || !program) {
    return (
      <div className="max-w-4xl mx-auto">
        <PageHeader
          title="改善プログラム詳細"
          description="改善プログラムを取得できませんでした"
          backHref="/admin/programs"
        />
        <SectionCard>
          <p className="text-sm text-destructive">
            {errorMessage ?? '改善プログラムが見つかりませんでした。'}
          </p>
        </SectionCard>
      </div>
    );
  }

  const patientName = patient?.name ?? '患者情報なし';
  const createdAt = new Date(program.created_at).toLocaleDateString('ja-JP');

  return (
    <div className="max-w-4xl mx-auto">
      <PageHeader
        title="改善プログラム詳細"
        description={`${patientName} - ${createdAt}`}
        backHref="/admin/programs"
        actions={
          <div className="flex items-center gap-2">
            <Link href={`/admin/programs/${program.id}/edit`}>
              <Button>
                <Edit className="h-4 w-4 mr-2" />
                編集
              </Button>
            </Link>

            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={isDeleting}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              {isDeleting ? '削除中...' : '削除'}
            </Button>
          </div>
        }
      />

      <SectionCard className="mb-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm text-muted-foreground">患者名</p>
            {patient ? (
              <Link
                href={`/admin/patients/${patient.id}`}
                className="font-medium text-primary hover:underline"
              >
                {patient.name}
              </Link>
            ) : (
              <p className="font-medium">患者情報なし</p>
            )}
            {patient?.kana && (
              <p className="text-xs text-muted-foreground">カナ: {patient.kana}</p>
            )}
          </div>

          <div className="md:text-right">
            <p className="text-sm text-muted-foreground">作成日</p>
            <p className="font-medium">{createdAt}</p>
            <p className="text-xs text-muted-foreground">
              作成方法: {program.create_mode === 'manual' ? '手動作成' : 'AI作成'}
            </p>
          </div>
        </div>
      </SectionCard>

      <SectionCard title="状態メモ" className="mb-6">
        <p className="whitespace-pre-wrap text-sm">
          {program.memo || '状態メモは未入力です。'}
        </p>
      </SectionCard>

      <div className="space-y-4 mb-6">
        <ProgramSection
          title="状態まとめ"
          content={program.summary || '状態まとめは未入力です。'}
        />
        <ProgramSection
          title="短期プログラム（3カ月）"
          content={program.short_term_program || '短期プログラムは未入力です。'}
        />
        <ProgramSection
          title="長期プログラム"
          content={program.long_term_program || '長期プログラムは未入力です。'}
        />
        <ProgramSection
          title="今日やること"
          content={program.today_task || '今日やることは未入力です。'}
        />
      </div>

      <SectionCard title="商品提案" className="mb-6">
        <div className="space-y-4">
          {recommendationErrorMessage && (
            <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
              {recommendationErrorMessage}
            </div>
          )}

          <div className="rounded-lg border bg-muted/20 p-4">
            <div className="grid gap-4 md:grid-cols-[260px_1fr]">
              <div className="space-y-2">
                <p className="text-sm font-medium">提案する商品</p>
                <Select value={selectedProductId} onValueChange={handleProductChange}>
                  <SelectTrigger>
                    <SelectValue placeholder="商品を選択" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">商品を選択</SelectItem>
                    {products.map((product) => (
                      <SelectItem key={product.id} value={product.id}>
                        {product.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <p className="text-sm font-medium">提案理由</p>
                <Textarea
                  className="min-h-[110px]"
                  value={recommendationReason}
                  onChange={(event) => setRecommendationReason(event.target.value)}
                  placeholder="この患者さんに提案する理由を入力します"
                />
              </div>
            </div>

            <div className="mt-4 flex justify-end">
              <Button
                onClick={handleAddRecommendation}
                disabled={isSavingRecommendation || selectedProductId === 'none'}
              >
                <Plus className="h-4 w-4 mr-2" />
                {isSavingRecommendation ? '追加中...' : '商品提案を追加'}
              </Button>
            </div>
          </div>

          <div className="space-y-3">
            {isLoadingRecommendations && (
              <p className="text-sm text-muted-foreground">商品提案を読み込み中です...</p>
            )}

            {!isLoadingRecommendations && recommendations.length === 0 && (
              <p className="text-sm text-muted-foreground">商品提案はまだ登録されていません。</p>
            )}

            {!isLoadingRecommendations && recommendations.map((recommendation) => (
              <div key={recommendation.id} className="rounded-lg border p-4">
                <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium">{recommendation.productName}</p>
                      <Badge variant="secondary">{recommendation.category}</Badge>
                    </div>
                    <p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">
                      {recommendation.reason || '提案理由は未入力です。'}
                    </p>
                    <p className="mt-2 text-xs text-muted-foreground">
                      追加日: {new Date(recommendation.createdAt).toLocaleDateString('ja-JP')}
                    </p>
                  </div>

                  <div className="flex flex-col gap-2 md:w-[190px]">
                    <div className="space-y-1">
                      <p className="text-xs text-muted-foreground">ステータス</p>
                      <Select
                        value={recommendation.status}
                        onValueChange={(value) =>
                          handleUpdateRecommendationStatus(
                            recommendation,
                            value as RecommendationStatus
                          )
                        }
                        disabled={updatingRecommendationId === recommendation.id}
                      >
                        <SelectTrigger className="h-9">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {recommendationStatusOptions.map((status) => (
                            <SelectItem key={status} value={status}>
                              {status}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDeleteRecommendation(recommendation)}
                      disabled={deletingRecommendationId === recommendation.id}
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      {deletingRecommendationId === recommendation.id ? '削除中...' : '削除'}
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </SectionCard>

      <div className="flex items-center gap-4">
        <Link href="/admin/programs">
          <Button variant="outline">
            <ArrowLeft className="h-4 w-4 mr-2" />
            一覧へ戻る
          </Button>
        </Link>

        {patient && (
          <Link href={`/admin/patients/${patient.id}`}>
            <Button variant="outline">患者詳細へ</Button>
          </Link>
        )}
      </div>
    </div>
  );
}
