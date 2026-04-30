'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { SectionCard } from './SectionCard';
import {
  supportStatusColors,
  supportStatusOptions,
  type PatientProductProposal,
} from './products';
import type { SupportStatus } from './SupportCategoryCard';

interface PatientProductSupportSectionProps {
  proposals: PatientProductProposal[];
}

export function PatientProductSupportSection({ proposals }: PatientProductSupportSectionProps) {
  const [statuses, setStatuses] = useState<Record<string, SupportStatus>>(
    proposals.reduce(
      (acc, proposal) => ({
        ...acc,
        [proposal.id]: proposal.status,
      }),
      {} as Record<string, SupportStatus>
    )
  );

  const groupedProposals = useMemo(() => {
    const groups: Record<SupportStatus, PatientProductProposal[]> = {
      提案中: [],
      検討中: [],
      購入済み: [],
      見送り: [],
    };

    proposals.forEach((proposal) => {
      const currentStatus = statuses[proposal.id];
      groups[currentStatus].push({ ...proposal, status: currentStatus });
    });

    return groups;
  }, [proposals, statuses]);

  return (
    <SectionCard title="商品サポート提案" className="mb-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        {supportStatusOptions.map((status) => (
          <div key={status} className="rounded-lg border p-3 bg-card">
            <Badge variant="outline" className={supportStatusColors[status]}>
              {status}
            </Badge>
            <p className="text-2xl font-semibold mt-2">{groupedProposals[status].length}</p>
          </div>
        ))}
      </div>

      <div className="space-y-4">
        {proposals.map((proposal) => (
          <div key={proposal.id} className="rounded-lg border p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="font-medium">{proposal.productName}</p>
                <p className="text-sm text-muted-foreground mt-1">{proposal.category}</p>
              </div>
              <Badge variant="outline" className={supportStatusColors[statuses[proposal.id]]}>
                {statuses[proposal.id]}
              </Badge>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
              <div>
                <p className="text-xs text-muted-foreground">提案理由</p>
                <p className="text-sm mt-1">{proposal.reason}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">関連する改善プログラム</p>
                <p className="text-sm mt-1">{proposal.programLabel}</p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3 mt-4 pt-3 border-t">
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">ステータス変更UI</p>
                <Select
                  value={statuses[proposal.id]}
                  onValueChange={(value) =>
                    setStatuses((prev) => ({
                      ...prev,
                      [proposal.id]: value as SupportStatus,
                    }))
                  }
                >
                  <SelectTrigger className="w-[160px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {supportStatusOptions.map((status) => (
                      <SelectItem key={status} value={status}>
                        {status}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Link href={`/admin/products/${proposal.productId}`}>
                <Button variant="outline" size="sm">
                  商品詳細へのリンク
                  <ArrowRight className="h-4 w-4 ml-1" />
                </Button>
              </Link>
            </div>
          </div>
        ))}
      </div>
    </SectionCard>
  );
}
