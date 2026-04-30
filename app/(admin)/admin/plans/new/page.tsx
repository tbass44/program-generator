'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { PageHeader, SectionCard } from '@/components/admin';
import { toast } from 'sonner';

const dummyPatients = [
  { id: '1', name: '山田 太郎' },
  { id: '2', name: '佐藤 花子' },
  { id: '3', name: '鈴木 一郎' },
  { id: '4', name: '田中 美咲' },
  { id: '5', name: '高橋 健太' },
];

export default function AdminPlanNewPage() {
  const router = useRouter();
  const [planType, setPlanType] = useState<'ticket' | 'subscription'>('ticket');
  const [formData, setFormData] = useState({
    patientId: '',
    name: '',
    count: '10',
    duration: '1',
    durationUnit: 'month',
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    toast.success('プランを作成しました');
    router.push('/admin/patients/' + formData.patientId);
  };

  return (
    <div className="max-w-2xl mx-auto">
      <PageHeader
        title="プラン作成"
        description="新しいプランを作成します"
        backHref="/admin/dashboard"
      />

      <form onSubmit={handleSubmit}>
        {/* Patient Selection */}
        <SectionCard title="患者選択" className="mb-6">
          <div className="space-y-2">
            <Label htmlFor="patient">患者</Label>
            <Select
              value={formData.patientId}
              onValueChange={(value) =>
                setFormData({ ...formData, patientId: value })
              }
            >
              <SelectTrigger id="patient">
                <SelectValue placeholder="患者を選択してください" />
              </SelectTrigger>
              <SelectContent>
                {dummyPatients.map((patient) => (
                  <SelectItem key={patient.id} value={patient.id}>
                    {patient.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </SectionCard>

        {/* Plan Type */}
        <SectionCard title="プランタイプ" className="mb-6">
          <RadioGroup
            value={planType}
            onValueChange={(value) => setPlanType(value as 'ticket' | 'subscription')}
            className="grid grid-cols-2 gap-4"
          >
            <div>
              <RadioGroupItem
                value="ticket"
                id="ticket"
                className="peer sr-only"
              />
              <label
                htmlFor="ticket"
                className="flex flex-col items-center justify-center rounded-lg border-2 border-muted bg-popover p-6 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary cursor-pointer transition-colors"
              >
                <span className="text-lg font-semibold">回数券</span>
                <span className="text-sm text-muted-foreground mt-1">
                  指定回数分利用可能
                </span>
              </label>
            </div>
            <div>
              <RadioGroupItem
                value="subscription"
                id="subscription"
                className="peer sr-only"
              />
              <label
                htmlFor="subscription"
                className="flex flex-col items-center justify-center rounded-lg border-2 border-muted bg-popover p-6 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary cursor-pointer transition-colors"
              >
                <span className="text-lg font-semibold">サブスク</span>
                <span className="text-sm text-muted-foreground mt-1">
                  期間中無制限利用
                </span>
              </label>
            </div>
          </RadioGroup>
        </SectionCard>

        {/* Plan Details */}
        <SectionCard title="プラン詳細" className="mb-6">
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">プラン名</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
                placeholder="例: 10回券、1ヶ月サブスク"
                required
              />
            </div>

            {planType === 'ticket' ? (
              <div className="space-y-2">
                <Label htmlFor="count">回数</Label>
                <Select
                  value={formData.count}
                  onValueChange={(value) =>
                    setFormData({ ...formData, count: value })
                  }
                >
                  <SelectTrigger id="count">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="5">5回</SelectItem>
                    <SelectItem value="10">10回</SelectItem>
                    <SelectItem value="20">20回</SelectItem>
                    <SelectItem value="30">30回</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            ) : (
              <div className="space-y-2">
                <Label>期間</Label>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    value={formData.duration}
                    onChange={(e) =>
                      setFormData({ ...formData, duration: e.target.value })
                    }
                    className="w-24"
                    min="1"
                  />
                  <Select
                    value={formData.durationUnit}
                    onValueChange={(value) =>
                      setFormData({ ...formData, durationUnit: value })
                    }
                  >
                    <SelectTrigger className="w-32">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="month">ヶ月</SelectItem>
                      <SelectItem value="year">年</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}
          </div>
        </SectionCard>

        {/* Actions */}
        <div className="flex items-center gap-4">
          <Button type="submit" disabled={!formData.patientId || !formData.name}>
            <Save className="h-4 w-4 mr-2" />
            作成
          </Button>
          <Button type="button" variant="outline" onClick={() => router.back()}>
            キャンセル
          </Button>
        </div>
      </form>
    </div>
  );
}
