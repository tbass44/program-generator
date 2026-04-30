'use client';

import { useState } from 'react';
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
  dummyProducts,
  productCategories,
  productStatusColors,
  productStatusOptions,
} from '@/components/admin';

export default function AdminProductsPage() {
  const [categoryFilter, setCategoryFilter] = useState('すべて');
  const [statusFilter, setStatusFilter] = useState('すべて');

  const filteredProducts = dummyProducts.filter((product) => {
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
              <TableHead>商品URL</TableHead>
              <TableHead>ステータス</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredProducts.map((product) => (
              <TableRow key={product.id}>
                <TableCell className="font-medium">{product.name}</TableCell>
                <TableCell>
                  <Badge variant="secondary">{product.category}</Badge>
                </TableCell>
                <TableCell className="max-w-[220px] truncate">{product.description}</TableCell>
                <TableCell className="max-w-[180px] truncate">{product.concerns}</TableCell>
                <TableCell>¥{product.price.toLocaleString()}</TableCell>
                <TableCell>
                  <a
                    href={product.url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-primary hover:underline text-sm"
                  >
                    商品リンク
                  </a>
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
