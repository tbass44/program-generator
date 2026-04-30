'use client';

import { PlanStatusCard, ProgramCard, SectionHeader, SupportCategoryCard } from '@/components/patient';
import { Moon, Apple, Dumbbell, Sparkles } from 'lucide-react';
import Link from 'next/link';

const currentProgram = {
  id: '1',
  title: '腰痛改善プログラム',
  shortTerm: '姿勢改善とストレッチ集中期',
  longTerm: '筋力強化と生活習慣の改善',
  todayTask: '朝のストレッチ10分 + 夜の温熱パック',
};

const supportCategories = [
  {
    href: '/product-support?category=sleep',
    icon: Moon,
    title: '物理療法（睡眠）',
    description: '睡眠の質を高めるサポート',
    recommendedSupport: 'マグネシウムサプリメント',
    relatedProgramId: '1',
    relatedProgramTitle: '腰痛改善プログラム',
    supportItems: [
      { name: 'マグネシウム', href: '/product-support?category=sleep&item=1' },
      { name: 'ホットパック', href: '/product-support?category=sleep&item=2' },
    ],
  },
  {
    href: '/product-support?category=nutrition',
    icon: Apple,
    title: '栄養療法',
    description: '内面から健康を支える栄養サポート',
    recommendedSupport: 'ビタミンDサプリメント',
    relatedProgramId: '1',
    relatedProgramTitle: '腰痛改善プログラム',
    supportItems: [
      { name: 'ビタミンD', href: '/product-support?category=nutrition&item=1' },
      { name: 'オメガ3', href: '/product-support?category=nutrition&item=2' },
    ],
  },
  {
    href: '/product-support?category=exercise',
    icon: Dumbbell,
    title: '運動療法',
    description: '体を動かして改善を促すサポート',
    recommendedSupport: '姿勢矯正ベルト',
    relatedProgramId: '2',
    relatedProgramTitle: '肩こり解消プログラム',
    supportItems: [
      { name: '矯正ベルト', href: '/product-support?category=exercise&item=1' },
      { name: 'ヨガマット', href: '/product-support?category=exercise&item=2' },
    ],
  },
  {
    href: '/product-support?category=skincare',
    icon: Sparkles,
    title: 'スキンケア',
    description: '肌の健康を保つケアサポート',
    recommendedSupport: '保湿クリーム',
    supportItems: [
      { name: '保湿クリーム', href: '/product-support?category=skincare&item=1' },
      { name: 'UVケア', href: '/product-support?category=skincare&item=2' },
    ],
  },
];

export default function DashboardPage() {
  return (
    <div className="max-w-lg mx-auto px-4 py-6">
      <header className="mb-6">
        <h1 className="text-xl font-bold text-gray-900">こんにちは</h1>
        <p className="text-sm text-gray-500">本日の状態を確認しましょう</p>
      </header>

      <section className="mb-6">
        <SectionHeader
          title="現在のプラン"
          action={
            <Link href="/plans" className="text-sm text-teal-600">
              詳細
            </Link>
          }
        />
        <PlanStatusCard type="ticket" remaining={5} />
      </section>

      <section className="mb-6">
        <SectionHeader
          title="現在の改善プログラム"
          action={
            <Link href="/programs" className="text-sm text-teal-600">
              すべて見る
            </Link>
          }
        />
        <ProgramCard {...currentProgram} />
      </section>

      <section>
        <SectionHeader
          title="商品サポート"
          action={
            <Link href="/product-support" className="text-sm text-teal-600">
              すべて見る
            </Link>
          }
        />
        <div className="space-y-3">
          {supportCategories.map((category) => (
            <SupportCategoryCard key={category.title} {...category} />
          ))}
        </div>
      </section>
    </div>
  );
}
