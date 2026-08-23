'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { SectionCard, PageHeader, ProductForm } from '@/components/admin';
import type { ProductFormValues } from '@/components/admin/ProductForm';
import { toast } from 'sonner';

const initialValues: ProductFormValues = {
  name: '',
  category: '物理療法（睡眠）',
  description: '',
  concerns: '',
  reasonTemplate: '',
  price: '',
  inventoryCount: '',
  url: '',
  status: '有効',
};

type CreateProductResponse = {
  product?: {
    id: string;
    name: string;
  };
  error?: string;
  detail?: unknown;
};

function formatApiError(status: number, data: CreateProductResponse) {
  const detail = typeof data.detail === 'string' ? ` / detail: ${data.detail}` : '';
  return `商品を登録できませんでした（HTTP ${status} / error: ${data.error ?? 'unknown'}${detail}）`;
}

export default function AdminProductNewPage() {
  const router = useRouter();
  const [values, setValues] = useState<ProductFormValues>(initialValues);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

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
       * 商品マスタをAPI経由で登録する。
       * UI側では日本語カテゴリ・日本語ステータスのまま送り、
       * DB保存用のenum変換はAPI側でまとめて行う。
       */
      const response = await fetch('/api/admin/products', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(values),
      });

      const data = (await response.json()) as CreateProductResponse;

      if (!response.ok || !data.product) {
        const message = formatApiError(response.status, data);
        setErrorMessage(message);
        toast.error('商品を登録できませんでした');
        return;
      }

      toast.success('新規商品を登録しました');
      router.push('/admin/products');
      router.refresh();
    } catch (error) {
      console.error(error);
      setErrorMessage('商品登録中にエラーが発生しました。');
      toast.error('商品を登録できませんでした');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto">
      <PageHeader title="新規商品登録" description="商品マスタを登録します" backHref="/admin/products" />

      {errorMessage && (
        <div className="mb-4 rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
          {errorMessage}
        </div>
      )}

      <SectionCard>
        <ProductForm values={values} onChange={updateField} />

        <div className="mt-6 pt-4 border-t">
          <Button onClick={handleSave} disabled={isSaving}>
            <Save className="h-4 w-4 mr-2" />
            {isSaving ? '登録中...' : '登録'}
          </Button>
        </div>
      </SectionCard>
    </div>
  );
}
