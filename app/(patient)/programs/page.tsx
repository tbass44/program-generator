'use client';

import { ProgramCard } from '@/components/patient';

const dummyPrograms = [
  {
    id: '1',
    title: '腰痛改善プログラム',
    shortTerm: '姿勢改善とストレッチ集中期',
    longTerm: '筋力強化と生活習慣の改善',
    todayTask: '朝のストレッチ10分 + 夜の温熱パック',
  },
  {
    id: '2',
    title: '肩こり解消プログラム',
    shortTerm: '首周りの筋肉をほぐす集中期',
    longTerm: '肩甲骨周りの筋力強化',
    todayTask: '首のストレッチ5分 + 姿勢チェック',
  },
  {
    id: '3',
    title: '睡眠の質向上プログラム',
    shortTerm: '入浴とリラックス習慣の確立',
    longTerm: '睡眠環境の最適化と生活リズム改善',
    todayTask: '就寝90分前に入浴 + スマホを置く',
  },
];

export default function ProgramsPage() {
  return (
    <div className="max-w-lg mx-auto px-4 py-6">
      <header className="mb-6">
        <h1 className="text-xl font-bold text-gray-900">改善プログラム</h1>
        <p className="text-sm text-gray-500">AIが提案する改善プログラム一覧</p>
      </header>

      <div className="space-y-3">
        {dummyPrograms.map((program) => (
          <ProgramCard key={program.id} {...program} />
        ))}
      </div>
    </div>
  );
}
