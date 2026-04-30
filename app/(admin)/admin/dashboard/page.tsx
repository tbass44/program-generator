'use client';

import Link from 'next/link';
import { Users, FileText, CreditCard, Plus, ArrowRight, CircleAlert as AlertCircle, ShoppingBag, TrendingUp } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { PageHeader, SectionCard, PatientAlertCard, SupportCategoryCard } from '@/components/admin';
import type { SupportProposal } from '@/components/admin';

const todayPatients = [
  { patientName: '山田 太郎', patientId: '1', reason: '3回目の施術。マットレス提案のフォローアップ', urgency: 'high' as const },
  { patientName: '佐藤 花子', patientId: '2', reason: 'サプリメント効果確認', urgency: 'medium' as const },
  { patientName: '鈴木 一郎', patientId: '3', reason: '初診カウンセリング', urgency: 'low' as const },
];

const recentPrograms = [
  { id: '1', patientName: '山田 太郎', createdAt: '2024-01-15', status: '提案済み', categories: ['物理療法（睡眠）', '栄養療法'] },
  { id: '2', patientName: '佐藤 花子', createdAt: '2024-01-14', status: '保存済み', categories: ['栄養療法'] },
  { id: '3', patientName: '田中 美咲', createdAt: '2024-01-13', status: '提案済み', categories: ['スキンケア', '運動療法'] },
];

const proposedSupports: SupportProposal[] = [
  { id: '1', category: '物理療法（睡眠）', name: '体圧分散マットレス', description: '中硬・厚み20cm以上', reason: '腰痛緩和のため', status: '提案中' },
  { id: '2', category: '栄養療法', name: 'マグネシウムサプリメント', description: '1日300mg', reason: '筋肉のリラックスと睡眠の質改善', status: '提案中' },
  { id: '3', category: '運動療法', name: 'バランスボール', description: '65cm径', reason: 'コア筋肉の強化', status: '検討中' },
  { id: '4', category: 'スキンケア', name: 'ボディローション', description: '保湿重視', reason: 'マッサージ時の保湿ケア', status: '提案中' },
];

const salesLeads = [
  { patientName: '山田 太郎', patientId: '1', item: '体圧分散マットレス', category: '物理療法（睡眠）', likelihood: 'high' },
  { patientName: '佐藤 花子', patientId: '2', item: 'オメガ3脂肪酸', category: '栄養療法', likelihood: 'medium' },
  { patientName: '田中 美咲', patientId: '4', item: 'ボディローション', category: 'スキンケア', likelihood: 'high' },
];

const likelihoodConfig = {
  high: { label: '高', className: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  medium: { label: '中', className: 'bg-amber-50 text-amber-700 border-amber-200' },
  low: { label: '低', className: 'bg-gray-50 text-gray-600 border-gray-200' },
};

export default function AdminDashboardPage() {
  return (
    <div>
      <PageHeader
        title="ダッシュボード"
        description="管理画面の概要"
      />

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <Link href="/admin/patients/new">
          <Card className="hover:shadow-md transition-shadow cursor-pointer">
            <CardContent className="flex items-center gap-4 p-6">
              <div className="p-3 bg-primary/10 rounded-lg">
                <Users className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="font-medium">新規患者登録</p>
                <p className="text-sm text-muted-foreground">患者を追加</p>
              </div>
            </CardContent>
          </Card>
        </Link>

        <Link href="/admin/programs/new">
          <Card className="hover:shadow-md transition-shadow cursor-pointer">
            <CardContent className="flex items-center gap-4 p-6">
              <div className="p-3 bg-primary/10 rounded-lg">
                <FileText className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="font-medium">改善プログラム作成</p>
                <p className="text-sm text-muted-foreground">AI提案を生成</p>
              </div>
            </CardContent>
          </Card>
        </Link>

        <Link href="/admin/plans/new">
          <Card className="hover:shadow-md transition-shadow cursor-pointer">
            <CardContent className="flex items-center gap-4 p-6">
              <div className="p-3 bg-primary/10 rounded-lg">
                <CreditCard className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="font-medium">プラン作成</p>
                <p className="text-sm text-muted-foreground">プランを追加</p>
              </div>
            </CardContent>
          </Card>
        </Link>
      </div>

      {/* Today's Patients */}
      <SectionCard title="本日対応が必要な患者" className="mb-6" actions={
        <Link href="/admin/patients">
          <Button variant="ghost" size="sm">
            すべて見る
            <ArrowRight className="h-4 w-4 ml-1" />
          </Button>
        </Link>
      }>
        <div className="space-y-2">
          {todayPatients.map((patient) => (
            <PatientAlertCard
              key={patient.patientId}
              patientName={patient.patientName}
              patientId={patient.patientId}
              reason={patient.reason}
              urgency={patient.urgency}
              href={`/admin/patients/${patient.patientId}`}
            />
          ))}
        </div>
      </SectionCard>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Recent Programs */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-lg">最近の改善プログラム</CardTitle>
            <Link href="/admin/programs/new">
              <Button variant="ghost" size="sm">
                作成
                <Plus className="h-4 w-4 ml-1" />
              </Button>
            </Link>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {recentPrograms.map((program) => (
                <Link
                  key={program.id}
                  href={`/admin/programs/${program.id}`}
                  className="flex items-center justify-between p-3 rounded-lg border hover:bg-accent transition-colors"
                >
                  <div>
                    <p className="font-medium">{program.patientName}</p>
                    <p className="text-sm text-muted-foreground">
                      作成日: {program.createdAt}
                    </p>
                    <div className="flex gap-1 mt-1">
                      {program.categories.map((cat) => (
                        <Badge key={cat} variant="secondary" className="text-xs">
                          {cat}
                        </Badge>
                      ))}
                    </div>
                  </div>
                  <Badge variant={program.status === '保存済み' ? 'default' : 'secondary'}>
                    {program.status}
                  </Badge>
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Proposed Supports */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-lg">提案中の商品サポート</CardTitle>
            <Badge variant="secondary">{proposedSupports.length}件</Badge>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {proposedSupports.map((proposal) => (
                <div
                  key={proposal.id}
                  className="flex items-center justify-between p-3 rounded-lg border"
                >
                  <div>
                    <p className="font-medium text-sm">{proposal.name}</p>
                    <p className="text-xs text-muted-foreground">{proposal.category}</p>
                  </div>
                  <Badge
                    className={
                      proposal.status === '提案中'
                        ? 'bg-blue-50 text-blue-700 border-blue-200'
                        : 'bg-amber-50 text-amber-700 border-amber-200'
                    }
                    variant="outline"
                  >
                    {proposal.status}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Sales Leads */}
      <SectionCard
        title="購入/レンタルにつながりそうな患者"
        className="mb-6"
        actions={
          <div className="flex items-center gap-1 text-sm text-muted-foreground">
            <TrendingUp className="h-4 w-4" />
            <span>販売促進</span>
          </div>
        }
      >
        <div className="space-y-3">
          {salesLeads.map((lead) => {
            const config = likelihoodConfig[lead.likelihood as keyof typeof likelihoodConfig];
            return (
              <Link
                key={lead.patientId + lead.item}
                href={`/admin/patients/${lead.patientId}`}
                className="flex items-center justify-between p-4 rounded-lg border hover:bg-accent transition-colors"
              >
                <div className="flex items-center gap-4">
                  <div className="p-2 bg-primary/10 rounded-lg">
                    <ShoppingBag className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <p className="font-medium text-sm">{lead.patientName}</p>
                    <p className="text-xs text-muted-foreground">
                      {lead.item} ({lead.category})
                    </p>
                  </div>
                </div>
                <Badge className={config.className} variant="outline">
                  成約度: {config.label}
                </Badge>
              </Link>
            );
          })}
        </div>
      </SectionCard>
    </div>
  );
}
