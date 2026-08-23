'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  PageHeader,
  SectionCard,
  productCategories,
  productStatusColors,
  productStatusOptions,
} from '@/components/admin';
import type { ProductMaster } from '@/components/admin';

type ProductsResponse = {
  products?: ProductMaster[];
  error?: string;
  detail?: unknown;
};

function formatApiError(status: number, data: ProductsResponse) {
  const detail = typeof data.detail === 'string' ? ` / detail: ${data.detail}` : '';
  return `商品一覧を取得できませんでした（HTTP ${status} / error: ${data.error ?? 'unknown'}${detail}）`;
}

export default function AdminProductsPage() {
  const [categoryFilter, setCategoryFilter] = useState('すべて');
  const [statusFilter, setStatusFilter] = useState('すべて');
  const [products, setProducts] = useState<ProductMaster[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    const fetchProducts = async () => {
      try {
        setIsLoading(true);
        setErrorMessage(null);

        /**
         * 商品マスタ一覧をAPIから取得する。
         * MVPでは検索条件をAPIへ渡さず、画面側でカテゴリ・ステータスを絞り込む。
         */
        const response = await fetch('/api/admin/products');
        const data = (await response.json()) as ProductsResponse;

        if (!response.ok || !data.products) {
          setErrorMessage(formatApiError(response.status, data));
          setProducts([]);
          return;
        }

        setProducts(data.products);
      } catch (error) {
        console.error(error);
        setErrorMessage('商品一覧の取得中にエラーが発生しました。');
        setProducts([]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchProducts();
  }, []);

  const filteredProducts = products.filter((product) => {
    if (categoryFilter !== 'すべて' && product.category !== categoryFilter) return false;
    if (statusFilter !== 'すべて' && product.status !== statusFilter) return false;
    return true;
  });

  return (
    <div>
      <PageHeader
        title="商品管理"
        description="商品マスタの登録・編集を行います"
        actions={
          <Link href="/admin/products/new">
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              新規商品登録
            </Button>
          </Link>
        }
      />

      {errorMessage && (
        <div className="mb-4 rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
          {errorMessage}
        </div>
      )}

      <SectionCard title="フィルター" className="mb-6">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">カテゴリ</p>
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-[220px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="すべて">すべて</SelectItem>
                {productCategories.map((category) => (
                  <SelectItem key={category} value={category}>
                    {category}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">ステータス</p>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[160px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="すべて">すべて</SelectItem>
                {productStatusOptions.map((status) => (
                  <SelectItem key={status} value={status}>
                    {status}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </SectionCard>

      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>商品名</TableHead>
              <TableHead>カテゴリ</TableHead>
              <TableHead>説明</TableHead>
              <TableHead>対象の悩み</TableHead>
              <TableHead>価格</TableHead>
              <TableHead>在庫数</TableHead>
              <TableHead>商品URL</TableHead>
              <TableHead>ステータス</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && (
              <TableRow>
                <TableCell colSpan={9} className="py-8 text-center text-sm text-muted-foreground">
                  商品一覧を読み込み中です...
                </TableCell>
              </TableRow>
            )}

            {!isLoading && filteredProducts.length === 0 && (
              <TableRow>
                <TableCell colSpan={9} className="py-8 text-center text-sm text-muted-foreground">
                  商品が登録されていません。
                </TableCell>
              </TableRow>
            )}

            {!isLoading && filteredProducts.map((product) => (
              <TableRow key={product.id}>
                <TableCell className="font-medium">{product.name}</TableCell>
                <TableCell>
                  <Badge variant="secondary">{product.category}</Badge>
                </TableCell>
                <TableCell className="max-w-[220px] truncate">{product.description || '-'}</TableCell>
                <TableCell className="max-w-[180px] truncate">{product.concerns || '-'}</TableCell>
                <TableCell>¥{product.price.toLocaleString()}</TableCell>
                <TableCell>{product.inventoryCount.toLocaleString()}</TableCell>
                <TableCell>
                  {product.url ? (
                    <a
                      href={product.url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-primary hover:underline text-sm"
                    >
                      商品リンク
                    </a>
                  ) : (
                    <span className="text-sm text-muted-foreground">-</span>
                  )}
                </TableCell>
                <TableCell>
                  <Badge variant="outline" className={productStatusColors[product.status]}>
                    {product.status}
                  </Badge>
                </TableCell>
                <TableCell>
                  <Link href={`/admin/products/${product.id}/edit`}>
                    <Button variant="outline" size="sm">
                      編集
                    </Button>
                  </Link>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
