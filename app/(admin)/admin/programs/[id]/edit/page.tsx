'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Save, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PageHeader, SectionCard } from '@/components/admin';
import type { SupportProposal, SupportStatus } from '@/components/admin';
import { toast } from 'sonner';

const categoryOptions = [
  '物理療法（睡眠）',
  '栄養療法',
  '運動療法',
  'スキンケア',
];

const statusOptions: SupportStatus[] = ['提案中', '検討中', '購入済み', '見送り'];

const initialProgramData = {
  id: '1',
  patientName: '山田 太郎',
  patientId: '1',
  memo: '腰痛あり、睡眠の質改善を希望。定期的なマッサージを受けている。',
  summary: '腰痛（慢性）と睡眠の質低下を主訴として来院。定期的なマッサージで一時的改善あり。姿勢不良と寝環境の課題が根本原因と推定。',
  shortTerm: `1ヶ月目: 姿勢評価と寝環境改善
- 体圧分散マットレスの導入
- 枕の高さ調整
- 1日10分のストレッチ習慣化

2ヶ月目: 栄養サポート開始
- ビタミンD3 2000IU/日
- マグネシウム 300mg/日

3ヶ月目: 運動療法の本格導入
- バランスボール 15分/日
- 週1回の施術継続`,
  longTerm: `3カ月以降:
- 継続的なコアトレーニング
- 月1回の姿勢評価
- サプリメントの効果測定と調整

6カ月目標:
- 腰痛の頻度を50%以上減少
- 自立したセルフケア習慣の確立`,
  todayTask: `1. 現在のマットレス・枕の状況をヒアリング
2. 姿勢の写真記録（正面・側面）
3. 体圧分散マットレスのカタログ提示
4. ビタミンD3のサンプル提供
5. ストレッチ指導（基本3種目）`,
  supportProposals: [
    {
      id: '1',
      category: '物理療法（睡眠）',
      name: '体圧分散マットレス',
      description: '中硬・厚み20cm以上の体圧分散機能付きマットレス',
      reason: '腰痛緩和のため、適切な寝姿勢を維持できるマットレスを推奨。',
      status: '提案中' as SupportStatus,
    },
    {
      id: '2',
      category: '栄養療法',
      name: 'ビタミンD3サプリメント',
      description: '1日2000IUのビタミンD3',
      reason: '骨密度の維持と免疫サポートのため。',
      status: '購入済み' as SupportStatus,
    },
    {
      id: '3',
      category: '運動療法',
      name: 'バランスボール',
      description: '65cm径のバランスボール',
      reason: 'コア筋肉の強化と姿勢改善に効果的です。',
      status: '提案中' as SupportStatus,
    },
  ] as SupportProposal[],
};

export default function AdminProgramEditPage() {
  const router = useRouter();
  const [memo, setMemo] = useState(initialProgramData.memo);
  const [summary, setSummary] = useState(initialProgramData.summary);
  const [shortTerm, setShortTerm] = useState(initialProgramData.shortTerm);
  const [longTerm, setLongTerm] = useState(initialProgramData.longTerm);
  const [todayTask, setTodayTask] = useState(initialProgramData.todayTask);
  const [proposals, setProposals] = useState<SupportProposal[]>(
    initialProgramData.supportProposals
  );

  const handleSave = () => {
    toast.success('改善プログラムを更新しました');
    router.push(`/admin/programs/${initialProgramData.id}`);
  };

  const addProposal = () => {
    const newProposal: SupportProposal = {
      id: String(Date.now()),
      category: categoryOptions[0],
      name: '',
      description: '',
      reason: '',
      status: '提案中',
    };
    setProposals([...proposals, newProposal]);
  };

  const removeProposal = (id: string) => {
    setProposals(proposals.filter((p) => p.id !== id));
  };

  const updateProposal = (id: string, field: keyof SupportProposal, value: string) => {
    setProposals(
      proposals.map((p) => (p.id === id ? { ...p, [field]: value } : p))
    );
  };

  return (
    <div className="max-w-4xl mx-auto">
      <PageHeader
        title="改善プログラム編集"
        description={`${initialProgramData.patientName}のプログラムを編集`}
        backHref={`/admin/programs/${initialProgramData.id}`}
      />

      {/* Patient Info */}
      <SectionCard className="mb-6">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-primary/10 rounded-lg">
            <span className="text-sm font-medium text-primary">
              {initialProgramData.patientName}
            </span>
          </div>
        </div>
      </SectionCard>

      {/* Memo */}
      <SectionCard title="状態メモ" className="mb-6">
        <div className="space-y-2">
          <Label htmlFor="memo">状態・要望</Label>
          <Textarea
            id="memo"
            value={memo}
            onChange={(e) => setMemo(e.target.value)}
            placeholder="患者の状態や要望を入力"
            className="min-h-[80px]"
          />
        </div>
      </SectionCard>

      {/* Summary */}
      <SectionCard title="状態まとめ" className="mb-6">
        <div className="space-y-2">
          <Label htmlFor="summary">状態まとめ</Label>
          <Textarea
            id="summary"
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
            className="min-h-[80px]"
          />
        </div>
      </SectionCard>

      {/* Short Term */}
      <SectionCard title="短期プログラム（3カ月）" className="mb-6">
        <div className="space-y-2">
          <Label htmlFor="shortTerm">短期プログラム内容</Label>
          <Textarea
            id="shortTerm"
            value={shortTerm}
            onChange={(e) => setShortTerm(e.target.value)}
            className="min-h-[200px] font-mono text-sm"
          />
        </div>
      </SectionCard>

      {/* Long Term */}
      <SectionCard title="長期プログラム" className="mb-6">
        <div className="space-y-2">
          <Label htmlFor="longTerm">長期プログラム内容</Label>
          <Textarea
            id="longTerm"
            value={longTerm}
            onChange={(e) => setLongTerm(e.target.value)}
            className="min-h-[150px] font-mono text-sm"
          />
        </div>
      </SectionCard>

      {/* Today Task */}
      <SectionCard title="今日やること" className="mb-6">
        <div className="space-y-2">
          <Label htmlFor="todayTask">今日やること</Label>
          <Textarea
            id="todayTask"
            value={todayTask}
            onChange={(e) => setTodayTask(e.target.value)}
            className="min-h-[120px] font-mono text-sm"
          />
        </div>
      </SectionCard>

      {/* Support Proposals */}
      <SectionCard
        title="商品サポート提案"
        className="mb-6"
        actions={
          <Button variant="outline" size="sm" onClick={addProposal}>
            <Plus className="h-4 w-4 mr-1" />
            追加
          </Button>
        }
      >
        <div className="space-y-4">
          {proposals.map((proposal, index) => (
            <Card key={proposal.id}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm">提案 {index + 1}</CardTitle>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-muted-foreground hover:text-destructive"
                    onClick={() => removeProposal(proposal.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>カテゴリ</Label>
                    <Select
                      value={proposal.category}
                      onValueChange={(value) =>
                        updateProposal(proposal.id, 'category', value)
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {categoryOptions.map((cat) => (
                          <SelectItem key={cat} value={cat}>
                            {cat}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>ステータス</Label>
                    <Select
                      value={proposal.status}
                      onValueChange={(value) =>
                        updateProposal(proposal.id, 'status', value)
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {statusOptions.map((s) => (
                          <SelectItem key={s} value={s}>
                            {s}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>商品/サポート名</Label>
                  <Input
                    value={proposal.name}
                    onChange={(e) =>
                      updateProposal(proposal.id, 'name', e.target.value)
                    }
                    placeholder="商品名またはサポート名"
                  />
                </div>
                <div className="space-y-2">
                  <Label>説明</Label>
                  <Input
                    value={proposal.description}
                    onChange={(e) =>
                      updateProposal(proposal.id, 'description', e.target.value)
                    }
                    placeholder="商品の説明"
                  />
                </div>
                <div className="space-y-2">
                  <Label>提案理由</Label>
                  <Textarea
                    value={proposal.reason}
                    onChange={(e) =>
                      updateProposal(proposal.id, 'reason', e.target.value)
                    }
                    placeholder="なぜこの商品を提案するのか"
                    className="min-h-[60px]"
                  />
                </div>
              </CardContent>
            </Card>
          ))}

          {proposals.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              <p className="text-sm">商品サポート提案がありません</p>
              <Button variant="outline" size="sm" className="mt-3" onClick={addProposal}>
                <Plus className="h-4 w-4 mr-1" />
                追加
              </Button>
            </div>
          )}
        </div>
      </SectionCard>

      {/* Actions */}
      <div className="flex items-center gap-4">
        <Button onClick={handleSave}>
          <Save className="h-4 w-4 mr-2" />
          保存
        </Button>
        <Button variant="outline" onClick={() => router.back()}>
          キャンセル
        </Button>
      </div>
    </div>
  );
}
