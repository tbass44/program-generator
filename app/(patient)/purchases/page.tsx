'use client';

import { PurchaseList } from '@/components/patient';

const dummyPurchases = [
  {
    id: '1',
    name: '腰痛用サポーター',
    date: '2024年4月15日',
    price: '3,980円',
  },
  {
    id: '2',
    name: 'マグネシウムサプリメント（30日分）',
    date: '2024年4月10日',
    price: '2,500円',
  },
  {
    id: '3',
    name: 'ホットパック',
    date: '2024年3月28日',
    price: '1,500円',
  },
  {
    id: '4',
    name: '姿勢矯正クッション',
    date: '2024年3月15日',
    price: '4,800円',
  },
];

export default function PurchasesPage() {
  return (
    <div className="max-w-lg mx-auto px-4 py-6">
      <header className="mb-6">
        <h1 className="text-xl font-bold text-gray-900">購入履歴</h1>
        <p className="text-sm text-gray-500">商品の購入記録</p>
      </header>

      <PurchaseList purchases={dummyPurchases} />
    </div>
  );
}
