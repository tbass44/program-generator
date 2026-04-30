'use client';

import { RentalList } from '@/components/patient';

const dummyRentals = [
  {
    id: '1',
    name: '電気治療器',
    startDate: '2024年4月15日',
    endDate: '2024年5月15日',
    isActive: true,
  },
  {
    id: '2',
    name: '姿勢矯正ベルト',
    startDate: '2024年4月1日',
    endDate: '2024年4月30日',
    isActive: true,
  },
  {
    id: '3',
    name: '温熱マット',
    startDate: '2024年3月1日',
    endDate: '2024年3月31日',
    isActive: false,
  },
  {
    id: '4',
    name: 'マッサージクッション',
    startDate: '2024年2月1日',
    endDate: '2024年2月28日',
    isActive: false,
  },
];

export default function RentalsPage() {
  return (
    <div className="max-w-lg mx-auto px-4 py-6">
      <header className="mb-6">
        <h1 className="text-xl font-bold text-gray-900">レンタル</h1>
        <p className="text-sm text-gray-500">レンタル商品の状況</p>
      </header>

      <RentalList rentals={dummyRentals} />
    </div>
  );
}
