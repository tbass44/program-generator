'use client';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export type SupportStatus = '提案中' | '検討中' | '購入済み' | '見送り';

export interface SupportProposal {
  id: string;
  category: string;
  name: string;
  description: string;
  reason: string;
  status: SupportStatus;
}

const statusColors: Record<SupportStatus, string> = {
  '提案中': 'bg-blue-50 text-blue-700 border-blue-200',
  '検討中': 'bg-amber-50 text-amber-700 border-amber-200',
  '購入済み': 'bg-emerald-50 text-emerald-700 border-emerald-200',
  '見送り': 'bg-gray-50 text-gray-600 border-gray-200',
};

const categoryIcons: Record<string, string> = {
  '物理療法（睡眠）': '🛏️',
  '栄養療法': '💊',
  '運動療法': '🏋️',
  'スキンケア': '🧴',
};

interface SupportCategoryCardProps {
  proposal: SupportProposal;
}

export function SupportCategoryCard({ proposal }: SupportCategoryCardProps) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-lg">{categoryIcons[proposal.category] || '📦'}</span>
            <CardTitle className="text-base">{proposal.category}</CardTitle>
          </div>
          <Badge className={statusColors[proposal.status]} variant="outline">
            {proposal.status}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div>
          <p className="text-sm font-medium">{proposal.name}</p>
          <p className="text-sm text-muted-foreground mt-1">{proposal.description}</p>
        </div>
        <div className="pt-2 border-t">
          <p className="text-xs text-muted-foreground">提案理由</p>
          <p className="text-sm mt-1">{proposal.reason}</p>
        </div>
      </CardContent>
    </Card>
  );
}
