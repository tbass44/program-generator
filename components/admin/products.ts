'use client';

import type { SupportStatus } from './SupportCategoryCard';

export type ProductCategory = '物理療法（睡眠）' | '栄養療法' | '運動療法' | 'スキンケア';
export type ProductMasterStatus = '有効' | '無効';

export interface ProductMaster {
  id: string;
  name: string;
  category: ProductCategory;
  description: string;
  concerns: string;
  reasonTemplate: string;
  price: number;
  url: string;
  status: ProductMasterStatus;
}

export interface PatientProductProposal {
  id: string;
  patientId: string;
  productId: string;
  productName: string;
  category: ProductCategory;
  reason: string;
  programLabel: string;
  status: SupportStatus;
}

export const productCategories: ProductCategory[] = [
  '物理療法（睡眠）',
  '栄養療法',
  '運動療法',
  'スキンケア',
];

export const productStatusOptions: ProductMasterStatus[] = ['有効', '無効'];

export const supportStatusOptions: SupportStatus[] = ['提案中', '検討中', '購入済み', '見送り'];

export const productStatusColors: Record<ProductMasterStatus, string> = {
  有効: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  無効: 'bg-gray-50 text-gray-600 border-gray-200',
};

export const supportStatusColors: Record<SupportStatus, string> = {
  提案中: 'bg-blue-50 text-blue-700 border-blue-200',
  検討中: 'bg-amber-50 text-amber-700 border-amber-200',
  購入済み: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  見送り: 'bg-gray-50 text-gray-600 border-gray-200',
};

export const dummyProducts: ProductMaster[] = [
  {
    id: '1',
    name: '体圧分散マットレス',
    category: '物理療法（睡眠）',
    description: '腰部の圧力分散を重視した中硬タイプのマットレス',
    concerns: '腰痛、睡眠の質低下',
    reasonTemplate: '寝姿勢を安定させて腰部負担を軽減するために提案します。',
    price: 39800,
    url: 'https://example.com/products/mattress',
    status: '有効',
  },
  {
    id: '2',
    name: 'マグネシウムサプリメント',
    category: '栄養療法',
    description: '就寝前の摂取を想定したマグネシウム300mg配合',
    concerns: '睡眠不足、筋緊張',
    reasonTemplate: '筋緊張緩和と睡眠の質改善を目的に提案します。',
    price: 3200,
    url: 'https://example.com/products/magnesium',
    status: '有効',
  },
  {
    id: '3',
    name: 'トレーニングチューブセット',
    category: '運動療法',
    description: '負荷2段階で自宅トレーニングを継続しやすいセット',
    concerns: '姿勢不良、運動不足',
    reasonTemplate: '自宅での継続運動を習慣化するために提案します。',
    price: 2500,
    url: 'https://example.com/products/tube',
    status: '有効',
  },
  {
    id: '4',
    name: '保湿ボディローション',
    category: 'スキンケア',
    description: '施術後の乾燥対策向けセラミド配合ローション',
    concerns: '乾燥、肌荒れ',
    reasonTemplate: '施術後の肌バリア維持のために提案します。',
    price: 2800,
    url: 'https://example.com/products/lotion',
    status: '無効',
  },
];
