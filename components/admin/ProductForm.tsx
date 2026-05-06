'use client';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { productCategories, productStatusOptions } from './products';
import type { ProductCategory, ProductMasterStatus } from './products';

export interface ProductFormValues {
  name: string;
  category: ProductCategory;
  description: string;
  concerns: string;
  reasonTemplate: string;
  price: string;
  inventoryCount: string;
  url: string;
  status: ProductMasterStatus;
}

interface ProductFormProps {
  values: ProductFormValues;
  onChange: (field: keyof ProductFormValues, value: string) => void;
}

export function ProductForm({ values, onChange }: ProductFormProps) {
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="name">商品名</Label>
        <Input id="name" value={values.name} onChange={(e) => onChange('name', e.target.value)} />
      </div>

      <div className="space-y-2">
        <Label htmlFor="category">カテゴリ</Label>
        <Select value={values.category} onValueChange={(value) => onChange('category', value)}>
          <SelectTrigger id="category">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {productCategories.map((category) => (
              <SelectItem key={category} value={category}>
                {category}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">説明</Label>
        <Textarea
          id="description"
          className="min-h-[80px]"
          value={values.description}
          onChange={(e) => onChange('description', e.target.value)}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="concerns">対象の悩み</Label>
        <Input
          id="concerns"
          value={values.concerns}
          onChange={(e) => onChange('concerns', e.target.value)}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="reasonTemplate">提案理由テンプレート</Label>
        <Textarea
          id="reasonTemplate"
          className="min-h-[100px]"
          value={values.reasonTemplate}
          onChange={(e) => onChange('reasonTemplate', e.target.value)}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="price">価格</Label>
          <Input
            id="price"
            type="number"
            min="0"
            value={values.price}
            onChange={(e) => onChange('price', e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="inventoryCount">在庫数</Label>
          <Input
            id="inventoryCount"
            type="number"
            min="0"
            value={values.inventoryCount}
            onChange={(e) => onChange('inventoryCount', e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="status">ステータス</Label>
          <Select value={values.status} onValueChange={(value) => onChange('status', value)}>
            <SelectTrigger id="status">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {productStatusOptions.map((status) => (
                <SelectItem key={status} value={status}>
                  {status}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="url">商品URL</Label>
        <Input id="url" value={values.url} onChange={(e) => onChange('url', e.target.value)} />
      </div>
    </div>
  );
}
