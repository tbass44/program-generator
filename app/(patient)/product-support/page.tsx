'use client';

import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { SectionHeader } from '@/components/patient';
import { Moon, Apple, Dumbbell, Sparkles, ChevronRight, Package, ShoppingBag, Star } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';

type Tab = 'purchased' | 'renting' | 'recommended';

const dummyPurchased = [
  {
    id: '1',
    name: 'マグネシウムサプリメント（30日分）',
    date: '2024年4月10日',
    price: '2,500円',
    category: 'sleep',
    categoryLabel: '物理療法（睡眠）',
  },
  {
    id: '2',
    name: 'ホットパック',
    date: '2024年3月28日',
    price: '1,500円',
    category: 'sleep',
    categoryLabel: '物理療法（睡眠）',
  },
  {
    id: '3',
    name: '姿勢矯正クッション',
    date: '2024年3月15日',
    price: '4,800円',
    category: 'exercise',
    categoryLabel: '運動療法',
  },
];

const dummyRenting = [
  {
    id: '1',
    name: '電気治療器',
    startDate: '2024年4月15日',
    endDate: '2024年5月15日',
    category: 'exercise',
    categoryLabel: '運動療法',
  },
  {
    id: '2',
    name: '姿勢矯正ベルト',
    startDate: '2024年4月1日',
    endDate: '2024年4月30日',
    category: 'exercise',
    categoryLabel: '運動療法',
  },
];

const dummyRecommended = [
  {
    id: '1',
    name: 'ビタミンDサプリメント',
    price: '1,980円',
    category: 'nutrition',
    categoryLabel: '栄養療法',
    reason: '腰痛改善に必要な栄養素を補給',
  },
  {
    id: '2',
    name: '保湿クリーム',
    price: '3,200円',
    category: 'skincare',
    categoryLabel: 'スキンケア',
    reason: '施術後の肌ケアに最適',
  },
  {
    id: '3',
    name: 'ヨガマット',
    price: '2,980円',
    category: 'exercise',
    categoryLabel: '運動療法',
    reason: '自宅でのストレッチに',
  },
];

const categoryIcons: Record<string, typeof Moon> = {
  sleep: Moon,
  nutrition: Apple,
  exercise: Dumbbell,
  skincare: Sparkles,
};

export default function ProductSupportPage() {
  const [activeTab, setActiveTab] = useState<Tab>('purchased');

  const tabs: { key: Tab; label: string; icon: typeof ShoppingBag }[] = [
    { key: 'purchased', label: '購入済み', icon: ShoppingBag },
    { key: 'renting', label: 'レンタル中', icon: Package },
    { key: 'recommended', label: 'おすすめ', icon: Star },
  ];

  return (
    <div className="max-w-lg mx-auto px-4 py-6">
      <header className="mb-6">
        <h1 className="text-xl font-bold text-gray-900">商品サポート</h1>
        <p className="text-sm text-gray-500">あなたに合った商品とサポート</p>
      </header>

      <div className="flex gap-2 mb-6">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-lg text-sm font-medium transition-colors ${
              activeTab === tab.key
                ? 'bg-teal-600 text-white'
                : 'bg-gray-100 text-gray-600'
            }`}
          >
            <tab.icon className="h-4 w-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'purchased' && (
        <div className="space-y-3">
          <SectionHeader title="購入済み商品" />
          {dummyPurchased.map((item) => {
            const Icon = categoryIcons[item.category] || Sparkles;
            return (
              <Card key={item.id} className="border-gray-200">
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <div className="p-2 rounded-lg bg-gray-100">
                      <Icon className="h-4 w-4 text-gray-600" />
                    </div>
                    <div className="flex-1">
                      <p className="text-xs text-gray-500 mb-0.5">{item.categoryLabel}</p>
                      <p className="font-medium text-gray-900">{item.name}</p>
                      <div className="flex justify-between items-center mt-1">
                        <p className="text-xs text-gray-500">{item.date}</p>
                        <p className="text-sm text-gray-600">{item.price}</p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {activeTab === 'renting' && (
        <div className="space-y-3">
          <SectionHeader title="レンタル中の商品" />
          {dummyRenting.map((item) => {
            const Icon = categoryIcons[item.category] || Sparkles;
            return (
              <Card key={item.id} className="border-teal-200 bg-teal-50/50">
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <div className="p-2 rounded-lg bg-teal-100">
                      <Icon className="h-4 w-4 text-teal-700" />
                    </div>
                    <div className="flex-1">
                      <div className="flex justify-between items-start mb-1">
                        <p className="text-xs text-gray-500">{item.categoryLabel}</p>
                        <Badge className="bg-teal-600 text-xs">レンタル中</Badge>
                      </div>
                      <p className="font-medium text-gray-900">{item.name}</p>
                      <p className="text-xs text-gray-600 mt-1">
                        {item.startDate} ~ {item.endDate}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {activeTab === 'recommended' && (
        <div className="space-y-3">
          <SectionHeader title="おすすめ商品" />
          {dummyRecommended.map((item) => {
            const Icon = categoryIcons[item.category] || Sparkles;
            return (
              <Card key={item.id} className="border-gray-200 hover:shadow-md transition-shadow cursor-pointer">
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <div className="p-2 rounded-lg bg-amber-100">
                      <Icon className="h-4 w-4 text-amber-700" />
                    </div>
                    <div className="flex-1">
                      <p className="text-xs text-gray-500 mb-0.5">{item.categoryLabel}</p>
                      <p className="font-medium text-gray-900">{item.name}</p>
                      <p className="text-xs text-amber-700 mt-0.5">{item.reason}</p>
                      <div className="flex justify-between items-center mt-2">
                        <p className="text-sm font-medium text-gray-700">{item.price}</p>
                        <span className="text-xs text-teal-600 flex items-center gap-0.5">
                          詳細 <ChevronRight className="h-3 w-3" />
                        </span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
