'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PageHeader, ProductForm, SectionCard } from '@/components/admin';
import type { ProductFormValues } from '@/components/admin/ProductForm';
import { toast } from 'sonner';

/**
 * 商品編集ページで扱うAPIレスポンスの型。
 * /api/admin/products/[id] は product を返す。
 */
type ProductResponse = {
  product?: ProductFormValues & {
    id: string;
    createdAt?: string;
    updatedAt?: string;
  };
  error?: string;
  detail?: unknown;
};

/**
 * APIエラーを画面表示しやすい文字列に整える。
 */
function formatApiError(status: number, data: ProductResponse) {
  const detail = typeof data.detail === 'string' ? ` / detail: ${data.detail}` : '';
  return `商品情報を取得できませんでした（HTTP ${status} / error: ${data.error ?? 'unknown'}${detail}）`;
}

/**
 * 商品編集ページ。
 * 一覧から渡されたidを使ってDBの商品を取得し、保存時はPATCHで更新する。
 */
export default function AdminProductEditPage({ params }: { params: { id: string } }) {
  const router = useRouter();

  const [values, setValues] = useState<ProductFormValues>({
    name: '',
    category: '物理療法（睡眠）',
    description: '',
    concerns: '',
    reasonTemplate: '',
    price: '',
    inventoryCount: '',
    url: '',
    status: '有効',
  });

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    const fetchProduct = async () => {
      try {
        setIsLoading(true);
        setErrorMessage(null);

        /**
         * 編集対象の商品IDでAPIから実データを取得する。
         * ここでdummyProductsを使うと、一覧の商品と編集画面の商品がズレる。
         */
        const response = await fetch(`/api/admin/products/${params.id}`);
        const data = (await response.json()) as ProductResponse;

        if (!response.ok || !data.product) {
          setErrorMessage(formatApiError(response.status, data));
          return;
        }

        setValues({
          name: data.product.name,
          category: data.product.category,
          description: data.product.description,
          concerns: data.product.concerns,
          reasonTemplate: data.product.reasonTemplate,
          price: String(data.product.price),
          inventoryCount: String(data.product.inventoryCount),
          url: data.product.url,
          status: data.product.status,
        });
      } catch (error) {
        console.error(error);
        setErrorMessage('商品情報の取得中にエラーが発生しました。');
      } finally {
        setIsLoading(false);
      }
    };

    fetchProduct();
  }, [params.id]);

  const updateField = (field: keyof ProductFormValues, value: string) => {
    setValues((prev) => ({ ...prev, [field]: value }));
  };

  const handleSave = async () => {
    if (!values.name.trim()) {
      toast.error('商品名を入力してください');
      return;
    }

    try {
      setIsSaving(true);
      setErrorMessage(null);

      /**
       * 入力内容をそのままAPIへ送り、API側でDB保存値へ変換する。
       * UIは日本語カテゴリ・日本語ステータスのまま扱う。
       */
      const response = await fetch(`/api/admin/products/${params.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(values),
      });

      const data = (await response.json()) as ProductResponse;

      if (!response.ok || !data.product) {
        setErrorMessage(formatApiError(response.status, data));
        toast.error('商品情報を更新できませんでした');
        return;
      }

      toast.success('商品情報を更新しました');
      router.push('/admin/products');
      router.refresh();
    } catch (error) {
      console.error(error);
      setErrorMessage('商品情報の更新中にエラーが発生しました。');
      toast.error('商品情報を更新できませんでした');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="max-w-3xl mx-auto">
        <PageHeader title="商品編集" description="商品情報を読み込み中です" backHref="/admin/products" />
        <SectionCard>
          <p className="text-sm text-muted-foreground">読み込み中です...</p>
        </SectionCard>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto">
      <PageHeader title="商品編集" description={values.name || '商品情報を編集'} backHref="/admin/products" />

      {errorMessage && (
        <div className="mb-4 rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
          {errorMessage}
        </div>
      )}

      <SectionCard>
        <ProductForm values={values} onChange={updateField} />
        <div className="mt-6 flex items-center gap-4 border-t pt-4">
          <Button onClick={handleSave} disabled={isSaving}>
            <Save className="h-4 w-4 mr-2" />
            {isSaving ? '保存中...' : '保存'}
          </Button>
          <Button variant="outline" onClick={() => router.push('/admin/products')} disabled={isSaving}>
            キャンセル
          </Button>
        </div>
      </SectionCard>
    </div>
  );
}
