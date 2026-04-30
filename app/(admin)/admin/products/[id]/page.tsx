'use client';

import Link from 'next/link';
import { notFound, useParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { PageHeader, SectionCard, dummyProducts, productStatusColors } from '@/components/admin';

export default function AdminProductDetailPage() {
  const params = useParams<{ id: string }>();
  const product = dummyProducts.find((item) => item.id === params.id);

  if (!product) {
    notFound();
  }

  return (
    <div className="max-w-3xl mx-auto">
      <PageHeader
        title="商品詳細"
        description={product.name}
        backHref="/admin/products"
        actions={
          <Link href={`/admin/products/${product.id}/edit`}>
            <Button>編集</Button>
          </Link>
        }
      />

      <SectionCard>
        <div className="space-y-4">
          <div>
            <p className="text-sm text-muted-foreground">商品名</p>
            <p className="font-medium text-lg">{product.name}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">カテゴリ</p>
            <p>{product.category}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">説明</p>
            <p>{product.description}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">対象の悩み</p>
            <p>{product.concerns}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">提案理由テンプレート</p>
            <p>{product.reasonTemplate}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">価格</p>
            <p>¥{product.price.toLocaleString()}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">商品URL</p>
            <a href={product.url} target="_blank" rel="noreferrer" className="text-primary hover:underline">
              {product.url}
            </a>
          </div>
          <div>
            <p className="text-sm text-muted-foreground mb-1">ステータス</p>
            <Badge variant="outline" className={productStatusColors[product.status]}>
              {product.status}
            </Badge>
          </div>
        </div>
      </SectionCard>
    </div>
  );
}
