'use client';

import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface RentalItem {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  isActive: boolean;
}

interface RentalListProps {
  rentals: RentalItem[];
}

export function RentalList({ rentals }: RentalListProps) {
  const activeRentals = rentals.filter((r) => r.isActive);
  const pastRentals = rentals.filter((r) => !r.isActive);

  return (
    <div className="space-y-6">
      {activeRentals.length > 0 && (
        <div>
          <h3 className="text-sm font-medium text-gray-700 mb-3">レンタル中</h3>
          <div className="space-y-3">
            {activeRentals.map((rental) => (
              <Card key={rental.id} className="border-teal-200 bg-teal-50/50">
                <CardContent className="p-4">
                  <div className="flex justify-between items-start mb-2">
                    <p className="font-medium text-gray-900">{rental.name}</p>
                    <Badge className="bg-teal-600">レンタル中</Badge>
                  </div>
                  <p className="text-xs text-gray-600">
                    {rental.startDate} ~ {rental.endDate}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {pastRentals.length > 0 && (
        <div>
          <h3 className="text-sm font-medium text-gray-700 mb-3">過去のレンタル</h3>
          <div className="space-y-3">
            {pastRentals.map((rental) => (
              <Card key={rental.id} className="border-gray-200">
                <CardContent className="p-4">
                  <p className="font-medium text-gray-900 mb-1">{rental.name}</p>
                  <p className="text-xs text-gray-500">
                    {rental.startDate} ~ {rental.endDate}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
