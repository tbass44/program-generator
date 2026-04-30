'use client';

import { Card, CardContent } from '@/components/ui/card';

interface PurchaseItem {
  id: string;
  name: string;
  date: string;
  price?: string;
}

interface PurchaseListProps {
  purchases: PurchaseItem[];
}

export function PurchaseList({ purchases }: PurchaseListProps) {
  return (
    <div className="space-y-3">
      {purchases.map((purchase) => (
        <Card key={purchase.id} className="border-gray-200">
          <CardContent className="p-4">
            <div className="flex justify-between items-center">
              <div>
                <p className="text-xs text-gray-500 mb-1">{purchase.date}</p>
                <p className="text-sm font-medium text-gray-900">{purchase.name}</p>
              </div>
              {purchase.price && (
                <span className="text-sm text-gray-600">{purchase.price}</span>
              )}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
