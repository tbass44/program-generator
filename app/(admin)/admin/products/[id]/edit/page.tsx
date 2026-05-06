'use client';

import { useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PageHeader, ProductForm, SectionCard, dummyProducts } from '@/components/admin';
import type { ProductFormValues } from '@/components/admin/ProductForm';
import { toast } from 'sonner';

export default function AdminProductEditPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();

  const currentProduct = useMemo(
    () => dummyProducts.find((item) => item.id === params.id) ?? dummyProducts[0],
    [params.id]
  );

  const [values, setValues] = useState<ProductFormValues>({
    name: currentProduct.name,
    category: currentProduct.category,
    description: currentProduct.description,
    concerns: currentProduct.concerns,
    reasonTemplate: currentProduct.reasonTemplate,
    price: String(currentProduct.price),
    inventoryCount: String(currentProduct.inventoryCount),
    url: currentProduct.url,
    status: currentProduct.status,
  });

  const updateField = (field: keyof ProductFormValues, value: string) => {
    setValues((prev) => ({ ...prev, [field]: value }));
  };

  const handleSave = () => {
    toast.success('商品情報を更新しました');
    router.push(`/admin/products/${params.id}`);
  };

  return (
    <div className="max-w-3xl mx-auto">
      <PageHeader title="商品編集" description={currentProduct.name} backHref={`/admin/products/${params.id}`} />

      <SectionCard>
        <ProductForm values={values} onChange={updateField} />
        <div className="mt-6 pt-4 border-t">
          <Button onClick={handleSave}>
            <Save className="h-4 w-4 mr-2" />
            保存
          </Button>
        </div>
      </SectionCard>
    </div>
  );
}
