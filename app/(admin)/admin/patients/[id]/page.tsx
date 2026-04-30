'use client';

import { Plus, FileText, ShoppingBag, Package, Calendar } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { PageHeader, SectionCard, EmptyState, PatientProductSupportSection } from '@/components/admin';
import type { PatientProductProposal } from '@/components/admin';

const patientData = {
  id: '1',
  name: '山田 太郎',
  kana: 'ヤマダ タロウ',
  phone: '090-1234-5678',
  email: 'yamada@example.com',
  birthdate: '1985-03-15',
  address: '東京都渋谷区代々木1-1-1',
  notes: '腰痛の既往あり。定期的なマッサージを希望。',
};

const currentPlan = {
  type: '回数券',
  name: '10回券',
  remaining: 7,
  total: 10,
  purchasedAt: '2024-01-01',
};

const currentProgram = {
  id: '1',
  createdAt: '2024-01-15',
  summary: '腰痛（慢性）と睡眠の質低下を主訴として来院。姿勢不良と寝環境の課題が根本原因と推定。',
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
};

const productSupportProposals: PatientProductProposal[] = [
  {
    id: '1',
    patientId: '1',
    productId: '1',
    category: '物理療法（睡眠）',
    productName: '体圧分散マットレス',
    reason: '腰痛緩和のため',
    programLabel: '2024-01-15作成プログラム',
    status: '提案中',
  },
  {
    id: '2',
    patientId: '1',
    productId: '2',
    category: '栄養療法',
    productName: 'マグネシウムサプリメント',
    reason: '筋肉のリラックスと睡眠の質改善',
    programLabel: '2024-01-15作成プログラム',
    status: '検討中',
  },
  {
    id: '3',
    patientId: '1',
    productId: '3',
    category: '運動療法',
    productName: 'トレーニングチューブセット',
    reason: 'コア筋肉の強化と姿勢改善',
    programLabel: '2024-01-01作成プログラム',
    status: '購入済み',
  },
  {
    id: '4',
    patientId: '1',
    productId: '4',
    category: 'スキンケア',
    productName: '保湿ボディローション',
    reason: '施術後の乾燥を防ぐため',
    programLabel: '2024-01-01作成プログラム',
    status: '見送り',
  },
];

const purchasedProducts = [
  { id: '1', name: 'ビタミンD3サプリメント', price: 5000, purchasedAt: '2024-01-15', category: '栄養療法' },
  { id: '2', name: 'ボディローション', price: 3000, purchasedAt: '2024-01-10', category: 'スキンケア' },
];

const rentalProducts = [
  { id: '1', name: '電気治療器', startDate: '2024-01-01', endDate: '2024-02-01', status: 'レンタル中', category: '物理療法（睡眠）' },
];

const visitHistory = [
  { id: '1', date: '2024-01-15', treatment: '整体マッサージ', duration: '60分' },
  { id: '2', date: '2024-01-08', treatment: '整体マッサージ', duration: '60分' },
  { id: '3', date: '2024-01-01', treatment: 'カウンセリング', duration: '30分' },
];

const programs = [
  { id: '1', createdAt: '2024-01-15', status: '提案済み', categories: ['物理療法（睡眠）', '栄養療法', '運動療法'] },
  { id: '2', createdAt: '2024-01-01', status: '保存済み', categories: ['運動療法'] },
];

const productHistory = [
  { id: '1', name: 'サプリメントA', price: 5000, purchasedAt: '2024-01-15' },
  { id: '2', name: 'マットレスB', price: 30000, purchasedAt: '2024-01-10' },
];

export default function AdminPatientDetailPage() {
  return (
    <div>
      <PageHeader
        title={patientData.name}
        description="患者詳細情報"
        backHref="/admin/patients"
        actions={
          <Link href="/admin/programs/new">
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              プログラム作成
            </Button>
          </Link>
        }
      />

      {/* Basic Info */}
      <SectionCard title="基本情報" className="mb-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div>
            <p className="text-sm text-muted-foreground">氏名</p>
            <p className="font-medium">{patientData.name}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">カナ</p>
            <p className="font-medium">{patientData.kana}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">電話番号</p>
            <p className="font-medium">{patientData.phone}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">メール</p>
            <p className="font-medium">{patientData.email}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">生年月日</p>
            <p className="font-medium">{patientData.birthdate}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">住所</p>
            <p className="font-medium">{patientData.address}</p>
          </div>
        </div>
        {patientData.notes && (
          <div className="mt-4 pt-4 border-t">
            <p className="text-sm text-muted-foreground">備考</p>
            <p className="mt-1">{patientData.notes}</p>
          </div>
        )}
      </SectionCard>

      {/* Current Plan */}
      <SectionCard title="現在のプラン" className="mb-6">
        {currentPlan ? (
          <div className="flex items-center justify-between p-4 rounded-lg bg-primary/5">
            <div>
              <div className="flex items-center gap-2">
                <Badge>{currentPlan.type}</Badge>
                <span className="font-medium">{currentPlan.name}</span>
              </div>
              <p className="text-sm text-muted-foreground mt-1">
                購入日: {currentPlan.purchasedAt}
              </p>
            </div>
            <div className="text-right">
              <p className="text-2xl font-bold text-primary">
                {currentPlan.remaining} / {currentPlan.total}
              </p>
              <p className="text-sm text-muted-foreground">残り回数</p>
            </div>
          </div>
        ) : (
          <EmptyState
            title="プランなし"
            description="この患者はプランに加入していません"
            action={
              <Link href="/admin/plans/new">
                <Button size="sm">プラン作成</Button>
              </Link>
            }
          />
        )}
      </SectionCard>

      {/* Current Program */}
      <SectionCard
        title="現在の改善プログラム"
        className="mb-6"
        actions={
          <Link href={`/admin/programs/${currentProgram.id}`}>
            <Button variant="outline" size="sm">詳細</Button>
          </Link>
        }
      >
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <FileText className="h-4 w-4" />
            <span>作成日: {currentProgram.createdAt}</span>
          </div>
          <div>
            <p className="text-sm font-medium mb-1">状態まとめ</p>
            <p className="text-sm text-muted-foreground">{currentProgram.summary}</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-3 rounded-lg border">
              <p className="text-sm font-medium mb-2">短期プログラム（3カ月）</p>
              <p className="text-xs text-muted-foreground whitespace-pre-wrap line-clamp-4">
                {currentProgram.shortTerm}
              </p>
            </div>
            <div className="p-3 rounded-lg border">
              <p className="text-sm font-medium mb-2">長期プログラム</p>
              <p className="text-xs text-muted-foreground whitespace-pre-wrap line-clamp-4">
                {currentProgram.longTerm}
              </p>
            </div>
          </div>
        </div>
      </SectionCard>

      <PatientProductSupportSection proposals={productSupportProposals} />

      {/* Purchased Products */}
      <SectionCard title="購入済み商品" className="mb-6">
        {purchasedProducts.length > 0 ? (
          <div className="space-y-3">
            {purchasedProducts.map((product) => (
              <div
                key={product.id}
                className="flex items-center justify-between p-3 rounded-lg border"
              >
                <div>
                  <p className="font-medium text-sm">{product.name}</p>
                  <p className="text-xs text-muted-foreground">{product.category}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-medium">¥{product.price.toLocaleString()}</p>
                  <p className="text-xs text-muted-foreground">{product.purchasedAt}</p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState title="購入済み商品はありません" />
        )}
      </SectionCard>

      {/* Rental Products */}
      <SectionCard title="レンタル中の商品" className="mb-6">
        {rentalProducts.length > 0 ? (
          <div className="space-y-3">
            {rentalProducts.map((rental) => (
              <div
                key={rental.id}
                className="flex items-center justify-between p-3 rounded-lg border"
              >
                <div>
                  <p className="font-medium text-sm">{rental.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {rental.startDate} 〜 {rental.endDate}
                  </p>
                </div>
                <Badge variant="default">{rental.status}</Badge>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState title="レンタル中の商品はありません" />
        )}
      </SectionCard>

      {/* Tabs for History */}
      <Tabs defaultValue="visits" className="space-y-4">
        <TabsList>
          <TabsTrigger value="visits" className="gap-2">
            <Calendar className="h-4 w-4" />
            通院履歴
          </TabsTrigger>
          <TabsTrigger value="programs" className="gap-2">
            <FileText className="h-4 w-4" />
            プログラム一覧
          </TabsTrigger>
          <TabsTrigger value="products" className="gap-2">
            <ShoppingBag className="h-4 w-4" />
            商品サポート履歴
          </TabsTrigger>
          <TabsTrigger value="rentals" className="gap-2">
            <Package className="h-4 w-4" />
            レンタル履歴
          </TabsTrigger>
        </TabsList>

        <TabsContent value="visits">
          <SectionCard>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>日付</TableHead>
                  <TableHead>施術内容</TableHead>
                  <TableHead>時間</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visitHistory.map((visit) => (
                  <TableRow key={visit.id}>
                    <TableCell>{visit.date}</TableCell>
                    <TableCell>{visit.treatment}</TableCell>
                    <TableCell>{visit.duration}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </SectionCard>
        </TabsContent>

        <TabsContent value="programs">
          <SectionCard>
            <div className="space-y-3">
              {programs.map((program) => (
                <Link
                  key={program.id}
                  href={`/admin/programs/${program.id}`}
                  className="flex items-center justify-between p-4 rounded-lg border hover:bg-accent transition-colors"
                >
                  <div>
                    <p className="font-medium">作成日: {program.createdAt}</p>
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
          </SectionCard>
        </TabsContent>

        <TabsContent value="products">
          <SectionCard>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>商品名</TableHead>
                  <TableHead>価格</TableHead>
                  <TableHead>購入日</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {productHistory.map((product) => (
                  <TableRow key={product.id}>
                    <TableCell>{product.name}</TableCell>
                    <TableCell>¥{product.price.toLocaleString()}</TableCell>
                    <TableCell>{product.purchasedAt}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </SectionCard>
        </TabsContent>

        <TabsContent value="rentals">
          <SectionCard>
            <div className="space-y-3">
              {rentalProducts.map((rental) => (
                <div
                  key={rental.id}
                  className="flex items-center justify-between p-4 rounded-lg border"
                >
                  <div>
                    <p className="font-medium">{rental.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {rental.startDate} 〜 {rental.endDate}
                    </p>
                  </div>
                  <Badge variant="default">{rental.status}</Badge>
                </div>
              ))}
            </div>
          </SectionCard>
        </TabsContent>
      </Tabs>
    </div>
  );
}
