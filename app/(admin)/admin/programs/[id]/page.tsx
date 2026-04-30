'use client';

import { CreditCard as Edit, ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { PageHeader, SectionCard, ProgramSection, SupportCategoryCard } from '@/components/admin';
import type { SupportProposal } from '@/components/admin';

const programData = {
  id: '1',
  patientName: '山田 太郎',
  patientId: '1',
  status: '提案済み',
  createdAt: '2024-01-15',
  memo: '腰痛あり、睡眠の質改善を希望。定期的なマッサージを受けている。',
  summary: '腰痛（慢性）と睡眠の質低下を主訴として来院。定期的なマッサージで一時的改善あり。姿勢不良と寝環境の課題が根本原因と推定。',
  shortTerm: `1ヶ月目: 姿勢評価と寝環境改善
- 体圧分散マットレスの導入
- 枕の高さ調整
- 1日10分のストレッチ習慣化

2ヶ月目: 栄養サポート開始
- ビタミンD3 2000IU/日
- マグネシウム 300mg/日
- オメガ3脂肪酸 1000mg/日

3ヶ月目: 運動療法の本格導入
- バランスボール 15分/日
- チューブエクササイズ 10分/日
- 週1回の施術継続`,
  longTerm: `3カ月以降:
- 継続的なコアトレーニング
- 月1回の姿勢評価
- サプリメントの効果測定と調整
- 睡眠の質の定期チェック

6カ月目標:
- 腰痛の頻度を50%以上減少
- 睡眠の質スコアの改善
- 自立したセルフケア習慣の確立`,
  todayTask: `1. 現在のマットレス・枕の状況をヒアリング
2. 姿勢の写真記録（正面・側面）
3. 体圧分散マットレスのカタログ提示
4. ビタミンD3のサンプル提供
5. ストレッチ指導（基本3種目）
6. 次回予約の確認`,
  supportProposals: [
    {
      id: '1',
      category: '物理療法（睡眠）',
      name: '体圧分散マットレス',
      description: '中硬・厚み20cm以上の体圧分散機能付きマットレス',
      reason: '腰痛緩和のため、適切な寝姿勢を維持できる体圧分散機能付きマットレスを推奨します。',
      status: '提案中' as const,
    },
    {
      id: '2',
      category: '物理療法（睡眠）',
      name: '高さ調整可能な枕',
      description: '首の高さに合わせて調整できる枕',
      reason: '頸部・腰椎のアライメント改善のため。',
      status: '検討中' as const,
    },
    {
      id: '3',
      category: '栄養療法',
      name: 'ビタミンD3サプリメント',
      description: '1日2000IUのビタミンD3',
      reason: '骨密度の維持と免疫サポートのため。',
      status: '購入済み' as const,
    },
    {
      id: '4',
      category: '栄養療法',
      name: 'マグネシウムサプリメント',
      description: '1日300mgのマグネシウム',
      reason: '筋肉のリラックスと睡眠の質改善のため。',
      status: '提案中' as const,
    },
    {
      id: '5',
      category: '運動療法',
      name: 'バランスボール',
      description: '65cm径のバランスボール',
      reason: 'コア筋肉の強化と姿勢改善に効果的です。',
      status: '提案中' as const,
    },
    {
      id: '6',
      category: '運動療法',
      name: 'トレーニングチューブ',
      description: '軽・中の2段階チューブセット',
      reason: '自宅での肩甲骨周り強化のため。',
      status: '見送り' as const,
    },
    {
      id: '7',
      category: 'スキンケア',
      name: 'ボディローション',
      description: '保湿重視のボディローション',
      reason: 'マッサージ時の保湿ケアとして。',
      status: '提案中' as const,
    },
  ] as SupportProposal[],
};

export default function AdminProgramDetailPage() {
  return (
    <div className="max-w-4xl mx-auto">
      <PageHeader
        title="改善プログラム詳細"
        description={`${programData.patientName} - ${programData.createdAt}`}
        backHref={`/admin/patients/${programData.patientId}`}
        actions={
          <Link href={`/admin/programs/${programData.id}/edit`}>
            <Button>
              <Edit className="h-4 w-4 mr-2" />
              編集
            </Button>
          </Link>
        }
      />

      {/* Patient & Status */}
      <SectionCard className="mb-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground">患者名</p>
            <Link
              href={`/admin/patients/${programData.patientId}`}
              className="font-medium text-primary hover:underline"
            >
              {programData.patientName}
            </Link>
          </div>
          <div className="text-right">
            <p className="text-sm text-muted-foreground">作成日</p>
            <p className="font-medium">{programData.createdAt}</p>
          </div>
        </div>
      </SectionCard>

      {/* Memo */}
      <SectionCard title="状態メモ" className="mb-6">
        <p className="whitespace-pre-wrap text-sm">{programData.memo}</p>
      </SectionCard>

      {/* Program Sections */}
      <div className="space-y-4 mb-6">
        <ProgramSection title="状態まとめ" content={programData.summary} />
        <ProgramSection title="短期プログラム（3カ月）" content={programData.shortTerm} />
        <ProgramSection title="長期プログラム" content={programData.longTerm} />
        <ProgramSection title="今日やること" content={programData.todayTask} />
      </div>

      {/* Support Proposals */}
      <div className="mb-6">
        <h2 className="text-lg font-semibold mb-4">商品サポート提案</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {programData.supportProposals.map((proposal) => (
            <SupportCategoryCard key={proposal.id} proposal={proposal} />
          ))}
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-4">
        <Link href={`/admin/patients/${programData.patientId}`}>
          <Button variant="outline">
            <ArrowLeft className="h-4 w-4 mr-2" />
            患者詳細へ
          </Button>
        </Link>
        <Link href={`/admin/programs/${programData.id}/edit`}>
          <Button variant="outline">
            <Edit className="h-4 w-4 mr-2" />
            編集
          </Button>
        </Link>
      </div>
    </div>
  );
}
