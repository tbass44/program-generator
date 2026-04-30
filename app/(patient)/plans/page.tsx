'use client';

import { PlanStatusCard } from '@/components/patient';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

const dummyPlan = {
  type: 'ticket' as const,
  name: '10回券パック',
  total: 10,
  used: 5,
  remaining: 5,
  purchasedAt: '2024年3月15日',
};

export default function PlansPage() {
  return (
    <div className="max-w-lg mx-auto px-4 py-6">
      <header className="mb-6">
        <h1 className="text-xl font-bold text-gray-900">プラン</h1>
        <p className="text-sm text-gray-500">現在のプラン状況</p>
      </header>

      <div className="space-y-4">
        <PlanStatusCard type={dummyPlan.type} remaining={dummyPlan.remaining} />

        <Card className="border-gray-200">
          <CardContent className="p-5">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h2 className="font-semibold text-gray-900">{dummyPlan.name}</h2>
                <p className="text-xs text-gray-500 mt-1">
                  購入日: {dummyPlan.purchasedAt}
                </p>
              </div>
              <Badge className="bg-teal-600">有効</Badge>
            </div>

            <div className="grid grid-cols-3 gap-4 text-center">
              <div className="p-3 bg-gray-50 rounded-lg">
                <p className="text-2xl font-bold text-gray-900">{dummyPlan.total}</p>
                <p className="text-xs text-gray-500">合計</p>
              </div>
              <div className="p-3 bg-gray-50 rounded-lg">
                <p className="text-2xl font-bold text-gray-600">{dummyPlan.used}</p>
                <p className="text-xs text-gray-500">使用済</p>
              </div>
              <div className="p-3 bg-teal-50 rounded-lg">
                <p className="text-2xl font-bold text-teal-700">{dummyPlan.remaining}</p>
                <p className="text-xs text-teal-600">残り</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-gray-200">
          <CardContent className="p-5">
            <h3 className="font-medium text-gray-900 mb-3">ご利用履歴</h3>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">2024年4月15日</span>
                <span className="text-gray-900">1回使用</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">2024年4月10日</span>
                <span className="text-gray-900">1回使用</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">2024年4月5日</span>
                <span className="text-gray-900">1回使用</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">2024年3月28日</span>
                <span className="text-gray-900">1回使用</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">2024年3月15日</span>
                <span className="text-gray-900">1回使用</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
