'use client';

import { VisitList } from '@/components/patient';

const dummyVisits = [
  {
    id: '1',
    date: '2024年4月15日',
    memo: '腰の張りあり。ストレッチ指導。',
  },
  {
    id: '2',
    date: '2024年4月10日',
    memo: '肩こりの訴え。マッサージ実施。',
  },
  {
    id: '3',
    date: '2024年4月5日',
    memo: '睡眠の質低下について相談。生活指導。',
  },
  {
    id: '4',
    date: '2024年3月28日',
    memo: '定期検診。状態良好。',
  },
  {
    id: '5',
    date: '2024年3月15日',
    memo: '首の痛み。姿勢指導。',
  },
];

export default function VisitsPage() {
  return (
    <div className="max-w-lg mx-auto px-4 py-6">
      <header className="mb-6">
        <h1 className="text-xl font-bold text-gray-900">通院履歴</h1>
        <p className="text-sm text-gray-500">過去の通院記録</p>
      </header>

      <VisitList visits={dummyVisits} />
    </div>
  );
}
