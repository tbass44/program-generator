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
  url: '',
  status: '有効',
};

export default function AdminProductNewPage() {
  const router = useRouter();
  const [values, setValues] = useState<ProductFormValues>(initialValues);

  const updateField = (field: keyof ProductFormValues, value: string) => {
    setValues((prev) => ({ ...prev, [field]: value }));
  };

  const handleSave = () => {
    toast.success('新規商品を登録しました');
    router.push('/admin/products');
  };

  return (
    <div className="max-w-3xl mx-auto">
      <PageHeader title="新規商品登録" description="商品マスタを登録します" backHref="/admin/products" />

      <SectionCard>
        <ProductForm values={values} onChange={updateField} />

        <div className="mt-6 pt-4 border-t">
          <Button onClick={handleSave}>
            <Save className="h-4 w-4 mr-2" />
            登録
          </Button>
        </div>
      </SectionCard>
    </div>
  );
}
