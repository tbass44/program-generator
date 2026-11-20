'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Save, Trash2, Upload, FileText } from 'lucide-react';
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
 * 商品削除APIで扱うレスポンスの型。
 */
type PdfDocument = {
  id: string;
  title: string;
  pdf_url: string;
  created_at: string;
};

type PdfListResponse = {
  documents?: PdfDocument[];
  error?: string;
};

type DeleteProductResponse = {
  ok?: boolean;
  error?: string;
  detail?: unknown;
};

/**
 * APIエラーを画面表示しやすい文字列に整える。
 */
function formatApiError(status: number, data: ProductResponse | DeleteProductResponse) {
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
  const [isDeleting, setIsDeleting] = useState(false);
  const [isUploadingPdf, setIsUploadingPdf] = useState(false);
  const [pdfDocuments, setPdfDocuments] = useState<PdfDocument[]>([]);
  const [pdfTitle, setPdfTitle] = useState('');
  const [pdfError, setPdfError] = useState<string | null>(null);
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

        const documentsResponse = await fetch(`/api/admin/products/${params.id}/pdf`);
        const documentsData = (await documentsResponse.json()) as PdfListResponse;
        if (!documentsResponse.ok || !documentsData.documents) {
          setPdfError(documentsData.error ?? '商品資料を取得できませんでした');
        } else {
          setPdfDocuments(documentsData.documents);
          setPdfError(null);
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
          pdfUrl: data.product.pdfUrl ?? '',
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

  const uploadPdf = async (file: File) => {
    if (file.type !== 'application/pdf' || file.size > 10 * 1024 * 1024 || file.size === 0) {
      toast.error('10MB以下のPDFを選択してください');
      return;
    }
    const body = new FormData();
    body.append('file', file);
    body.append('title', pdfTitle.trim() || file.name.replace(/\.pdf$/i, ''));
    try {
      setIsUploadingPdf(true);
      const response = await fetch(`/api/admin/products/${params.id}/pdf`, {
        method: 'POST',
        body,
      });
      const result = (await response.json()) as { document?: PdfDocument; error?: string };
      if (!response.ok || !result.document) {
        toast.error(result.error ?? 'PDFを登録できませんでした');
        return;
      }
      setPdfDocuments((current) => [...current, result.document!]);
      setPdfTitle('');
      toast.success('商品資料を追加しました');
    } catch {
      toast.error('PDFのアップロード中にエラーが発生しました');
    } finally {
      setIsUploadingPdf(false);
    }
  };

  const removePdf = async (documentId: string) => {
    if (!window.confirm('このPDF資料を削除しますか？')) return;
    try {
      setIsUploadingPdf(true);
      const response = await fetch(
        `/api/admin/products/${params.id}/pdf?documentId=${encodeURIComponent(documentId)}`,
        { method: 'DELETE' }
      );
      if (!response.ok) throw new Error('Failed to remove PDF');
      setPdfDocuments((current) => current.filter((document) => document.id !== documentId));
      toast.success('PDFを削除しました');
    } catch {
      toast.error('PDFを削除できませんでした');
    } finally {
      setIsUploadingPdf(false);
    }
  };

  const handleDelete = async () => {
    const confirmed = window.confirm(
      `「${values.name || 'この商品'}」を削除します。よろしいですか？`
    );

    if (!confirmed) {
      return;
    }

    try {
      setIsDeleting(true);
      setErrorMessage(null);

      /**
       * 商品マスタを削除する。
       * 削除後は商品一覧へ戻し、一覧を再取得できるようにする。
       */
      const response = await fetch(`/api/admin/products/${params.id}`, {
        method: 'DELETE',
      });

      const data = (await response.json()) as DeleteProductResponse;

      if (!response.ok || !data.ok) {
        setErrorMessage(formatApiError(response.status, data));
        toast.error('商品を削除できませんでした');
        return;
      }

      toast.success('商品を削除しました');
      router.push('/admin/products');
      router.refresh();
    } catch (error) {
      console.error(error);
      setErrorMessage('商品の削除中にエラーが発生しました。');
      toast.error('商品を削除できませんでした');
    } finally {
      setIsDeleting(false);
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
        <div className="mt-6 space-y-3 rounded-lg border p-4">
          <p className="font-medium">商品資料（PDF・複数登録対応）</p>
          <p className="text-sm text-muted-foreground">
            PDFを1件ずつ追加できます。1ファイルあたり最大10MB。
          </p>
          {pdfError && <p className="text-sm text-destructive">{pdfError}</p>}
          <div className="space-y-1">
            <label htmlFor="pdfTitle" className="text-sm">資料名（任意）</label>
            <input
              id="pdfTitle"
              className="w-full rounded-md border bg-background px-3 py-2 text-sm"
              placeholder="例：商品カタログ、使用方法"
              value={pdfTitle}
              maxLength={100}
              onChange={(event) => setPdfTitle(event.target.value)}
            />
          </div>
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border px-4 py-2 text-sm hover:bg-muted">
            <Upload className="h-4 w-4" />
            {isUploadingPdf ? '処理中...' : 'PDFを追加'}
            <input
              type="file"
              accept="application/pdf,.pdf"
              className="sr-only"
              disabled={isUploadingPdf || isSaving || isDeleting}
              onChange={(event) => {
                const file = event.currentTarget.files?.[0];
                if (file) void uploadPdf(file);
                event.currentTarget.value = '';
              }}
            />
          </label>
          <div className="space-y-2">
            <p className="text-sm font-medium">登録済み資料（{pdfDocuments.length}件）</p>
            {pdfDocuments.length === 0 && (
              <p className="text-sm text-muted-foreground">PDFはまだ登録されていません。</p>
            )}
            {pdfDocuments.map((document) => (
              <div key={document.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border p-3">
                <a
                  href={document.pdf_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex min-w-0 items-center gap-2 text-sm text-primary underline"
                >
                  <FileText className="h-4 w-4 shrink-0" />
                  <span className="break-all">{document.title}</span>
                </a>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={isUploadingPdf || isSaving || isDeleting}
                  onClick={() => void removePdf(document.id)}
                >
                  削除
                </Button>
              </div>
            ))}
          </div>
        </div>
        <div className="mt-6 flex flex-col gap-3 border-t pt-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <Button onClick={handleSave} disabled={isSaving || isDeleting}>
              <Save className="h-4 w-4 mr-2" />
              {isSaving ? '保存中...' : '保存'}
            </Button>
            <Button
              variant="outline"
              onClick={() => router.push('/admin/products')}
              disabled={isSaving || isDeleting}
            >
              キャンセル
            </Button>
          </div>

          <Button variant="destructive" onClick={handleDelete} disabled={isSaving || isDeleting}>
            <Trash2 className="h-4 w-4 mr-2" />
            {isDeleting ? '削除中...' : '削除'}
          </Button>
        </div>
      </SectionCard>
    </div>
  );
}
