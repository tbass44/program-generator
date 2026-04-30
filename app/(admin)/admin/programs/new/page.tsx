'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Copy,
  Save,
  CreditCard as Edit,
  Sparkles,
  BedDouble,
  Pill,
  Dumbbell,
  Sparkle,
  PenLine,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PageHeader, SectionCard, ProgramSection } from '@/components/admin';
import type { SupportProposal, SupportStatus } from '@/components/admin';
import { toast } from 'sonner';

const dummyPatients = [
  { id: '1', name: '山田 太郎' },
  { id: '2', name: '佐藤 花子' },
  { id: '3', name: '鈴木 一郎' },
  { id: '4', name: '田中 美咲' },
  { id: '5', name: '高橋 健太' },
];

const supportCategories = [
  { id: 'physical', label: '物理療法（睡眠）', icon: BedDouble, description: 'マットレス、枕、寝具、レンタル品など' },
  { id: 'nutrition', label: '栄養療法', icon: Pill, description: 'サプリメント、栄養補助食品など' },
  { id: 'exercise', label: '運動療法', icon: Dumbbell, description: 'チューブ、運動器具、セルフケア用品など' },
  { id: 'skincare', label: 'スキンケア', icon: Sparkle, description: '化粧品、ボディケア用品など' },
];

const categoryOptions = ['物理療法（睡眠）', '栄養療法', '運動療法', 'スキンケア'];
const statusOptions: SupportStatus[] = ['提案中', '検討中', '購入済み', '見送り'];

const dummyResult = {
  summary: `腰痛（慢性）と睡眠の質低下を主訴として来院。定期的なマッサージで一時的改善あり。姿勢不良と寝環境の課題が根本原因と推定。`,
  shortTerm: `【3カ月プログラム】
1ヶ月目: 姿勢評価と寝環境改善
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
  longTerm: `【長期プログラム】
3カ月以降:
- 継続的なコアトレーニング
- 月1回の姿勢評価
- サプリメントの効果測定と調整
- 睡眠の質の定期チェック
- 必要に応じたマットレス・枕のメンテナンス

6カ月目標:
- 腰痛の頻度を50%以上減少
- 睡眠の質スコアの改善
- 自立したセルフケア習慣の確立`,
  todayTask: `【今日やること】
1. 現在のマットレス・枕の状況をヒアリング
2. 姿勢の写真記録（正面・側面）
3. 体圧分散マットレスのカタログ提示
4. ビタミンD3のサンプル提供
5. ストレッチ指導（基本3種目）
6. 次回予約の確認`,
  supportProposals: `【必要なサポート提案】

■ 物理療法（睡眠）
- 体圧分散マットレス（中硬・厚み20cm以上）
  → 腰痛緩和と寝姿勢維持のため
- 高さ調整可能な枕
  → 頸部・腰椎のアライメント改善のため

■ 栄養療法
- ビタミンD3サプリメント
  → 骨密度維持と免疫サポート
- マグネシウムサプリメント
  → 筋肉のリラックスと睡眠の質改善
- オメガ3脂肪酸
  → 抗炎症作用による腰痛緩和

■ 運動療法
- バランスボール
  → コア筋肉の強化と姿勢改善
- トレーニングチューブ（軽・中）
  → 自宅での肩甲骨周り強化

■ スキンケア
- ボディローション（保湿重視）
  → マッサージ時の保湿ケア`,
};

type Mode = 'ai' | 'manual';

export default function AdminProgramNewPage() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>('ai');

  // Common state
  const [selectedPatient, setSelectedPatient] = useState<string>('');
  const [status, setStatus] = useState<string>('');
  const [memo, setMemo] = useState('');

  // AI mode state
  const [aiEnabled, setAiEnabled] = useState(true);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [aiResult, setAiResult] = useState<typeof dummyResult | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);

  // Manual mode state
  const [manualSummary, setManualSummary] = useState('');
  const [manualShortTerm, setManualShortTerm] = useState('');
  const [manualLongTerm, setManualLongTerm] = useState('');
  const [manualTodayTask, setManualTodayTask] = useState('');
  const [manualProposals, setManualProposals] = useState<SupportProposal[]>([]);

  const canGenerate = selectedPatient !== '' && memo.trim() !== '';

  const handleCategoryChange = (categoryId: string, checked: boolean) => {
    if (checked) {
      setSelectedCategories([...selectedCategories, categoryId]);
    } else {
      setSelectedCategories(selectedCategories.filter((id) => id !== categoryId));
    }
  };

  const handleGenerate = async () => {
    if (!canGenerate) return;
    setIsGenerating(true);
    await new Promise((resolve) => setTimeout(resolve, 1500));
    setAiResult(dummyResult);
    setIsGenerating(false);
    toast.success('改善プログラムを生成しました');
  };

  const handleCopy = () => {
    const text = mode === 'ai' && aiResult
      ? [
          '【状態まとめ】', aiResult.summary, '',
          '【短期プログラム（3カ月）】', aiResult.shortTerm, '',
          '【長期プログラム】', aiResult.longTerm, '',
          '【今日やること】', aiResult.todayTask, '',
          '【必要なサポート提案】', aiResult.supportProposals,
        ].join('\n')
      : [
          '【状態まとめ】', manualSummary, '',
          '【短期プログラム（3カ月）】', manualShortTerm, '',
          '【長期プログラム】', manualLongTerm, '',
          '【今日やること】', manualTodayTask, '',
        ].join('\n');
    navigator.clipboard.writeText(text);
    toast.success('クリップボードにコピーしました');
  };

  const handleSave = () => {
    toast.success('改善プログラムを保存しました');
    router.push('/admin/patients/' + selectedPatient);
  };

  const handleEdit = () => {
    router.push('/admin/programs/new/edit');
  };

  const addManualProposal = () => {
    setManualProposals([
      ...manualProposals,
      {
        id: String(Date.now()),
        category: categoryOptions[0],
        name: '',
        description: '',
        reason: '',
        status: '提案中',
      },
    ]);
  };

  const removeManualProposal = (id: string) => {
    setManualProposals(manualProposals.filter((p) => p.id !== id));
  };

  const updateManualProposal = (id: string, field: keyof SupportProposal, value: string) => {
    setManualProposals(
      manualProposals.map((p) => (p.id === id ? { ...p, [field]: value } : p))
    );
  };

  const canSaveManual =
    selectedPatient !== '' &&
    manualSummary.trim() !== '' &&
    manualShortTerm.trim() !== '';

  return (
    <div className="max-w-4xl mx-auto">
      <PageHeader
        title="改善プログラム作成"
        description="AI提案または手動入力で改善プログラムを作成"
        backHref="/admin/dashboard"
      />

      {/* Mode Toggle */}
      <SectionCard className="mb-6">
        <div className="flex items-center gap-2">
          <Button
            variant={mode === 'ai' ? 'default' : 'outline'}
            onClick={() => setMode('ai')}
            className="flex-1"
          >
            <Sparkles className="h-4 w-4 mr-2" />
            AI生成モード
          </Button>
          <Button
            variant={mode === 'manual' ? 'default' : 'outline'}
            onClick={() => setMode('manual')}
            className="flex-1"
          >
            <PenLine className="h-4 w-4 mr-2" />
            手動入力モード
          </Button>
        </div>
        <p className="text-xs text-muted-foreground mt-2">
          {mode === 'ai'
            ? '状態メモを入力し、AIがプログラムと商品サポート提案を生成します'
            : '管理者が直接プログラム内容を入力して保存します'}
        </p>
      </SectionCard>

      {/* Patient Selection (common) */}
      <SectionCard title="患者選択" className="mb-6">
        <div className="space-y-2">
          <Label htmlFor="patient">患者</Label>
          <Select value={selectedPatient} onValueChange={setSelectedPatient}>
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

      {/* ===== AI MODE ===== */}
      {mode === 'ai' && (
        <>
          {/* Status & Memo */}
          <SectionCard title="状態・メモ" className="mb-6">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="status">状態</Label>
                <Select value={status} onValueChange={setStatus}>
                  <SelectTrigger id="status">
                    <SelectValue placeholder="状態を選択（任意）" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="initial">初診</SelectItem>
                    <SelectItem value="followup">再診</SelectItem>
                    <SelectItem value="maintenance">メンテナンス</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="memo">メモ</Label>
                <Textarea
                  id="memo"
                  value={memo}
                  onChange={(e) => setMemo(e.target.value)}
                  placeholder="施術後1分で入力。例：腰痛あり、睡眠の質改善を希望、定期的なマッサージを受けている"
                  className="min-h-[100px]"
                />
                <p className="text-xs text-muted-foreground">施術後すぐに入力できるシンプルな構成です</p>
              </div>
            </div>
          </SectionCard>

          {/* AI Settings */}
          <SectionCard title="AI提案設定" className="mb-6">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>AIに商品・サポート提案も任せる</Label>
                  <p className="text-sm text-muted-foreground">
                    ONにすると、AIがカテゴリに基づいて商品・サポート提案も生成します
                  </p>
                </div>
                <Switch checked={aiEnabled} onCheckedChange={setAiEnabled} />
              </div>

              {aiEnabled && (
                <div className="space-y-3 pt-4 border-t">
                  <Label>提案してよいサポートカテゴリ</Label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {supportCategories.map((category) => (
                      <div
                        key={category.id}
                        className="flex items-start space-x-3 p-3 rounded-lg border hover:bg-accent/50 transition-colors"
                      >
                        <Checkbox
                          id={category.id}
                          checked={selectedCategories.includes(category.id)}
                          onCheckedChange={(checked) =>
                            handleCategoryChange(category.id, checked as boolean)
                          }
                          className="mt-0.5"
                        />
                        <label htmlFor={category.id} className="cursor-pointer">
                          <div className="flex items-center gap-2">
                            <category.icon className="h-4 w-4 text-muted-foreground" />
                            <span className="text-sm font-medium">{category.label}</span>
                          </div>
                          <p className="text-xs text-muted-foreground mt-1">
                            {category.description}
                          </p>
                        </label>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </SectionCard>

          {/* Generate Button */}
          <div className="mb-6">
            <Button
              size="lg"
              className="w-full"
              disabled={!canGenerate || isGenerating}
              onClick={handleGenerate}
            >
              <Sparkles className="h-4 w-4 mr-2" />
              {isGenerating ? '生成中...' : '改善プログラムを生成'}
            </Button>
            {!canGenerate && (
              <p className="text-sm text-muted-foreground text-center mt-2">
                患者を選択し、メモを入力してください
              </p>
            )}
          </div>

          {/* AI Result */}
          {aiResult && (
            <div className="space-y-4 mb-6">
              <ProgramSection title="状態まとめ" content={aiResult.summary} />
              <ProgramSection title="短期プログラム（3カ月）" content={aiResult.shortTerm} />
              <ProgramSection title="長期プログラム" content={aiResult.longTerm} />
              <ProgramSection title="今日やること" content={aiResult.todayTask} />
              <SectionCard title="必要なサポート提案">
                <div className="whitespace-pre-wrap text-sm leading-relaxed">
                  {aiResult.supportProposals}
                </div>
              </SectionCard>

              <div className="flex items-center gap-2 pt-2">
                <Button variant="outline" onClick={handleCopy}>
                  <Copy className="h-4 w-4 mr-2" />
                  コピー
                </Button>
                <Button onClick={handleSave}>
                  <Save className="h-4 w-4 mr-2" />
                  保存
                </Button>
                <Button variant="outline" onClick={handleEdit}>
                  <Edit className="h-4 w-4 mr-2" />
                  編集へ
                </Button>
              </div>
            </div>
          )}
        </>
      )}

      {/* ===== MANUAL MODE ===== */}
      {mode === 'manual' && (
        <>
          {/* Status & Memo */}
          <SectionCard title="状態・メモ" className="mb-6">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="status-m">状態</Label>
                <Select value={status} onValueChange={setStatus}>
                  <SelectTrigger id="status-m">
                    <SelectValue placeholder="状態を選択（任意）" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="initial">初診</SelectItem>
                    <SelectItem value="followup">再診</SelectItem>
                    <SelectItem value="maintenance">メンテナンス</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="memo-m">メモ</Label>
                <Textarea
                  id="memo-m"
                  value={memo}
                  onChange={(e) => setMemo(e.target.value)}
                  placeholder="患者の状態や要望を入力"
                  className="min-h-[80px]"
                />
              </div>
            </div>
          </SectionCard>

          {/* Summary */}
          <SectionCard title="状態まとめ" className="mb-6">
            <div className="space-y-2">
              <Label htmlFor="summary">状態まとめ</Label>
              <Textarea
                id="summary"
                value={manualSummary}
                onChange={(e) => setManualSummary(e.target.value)}
                placeholder="患者の状態をまとめて入力してください"
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
                value={manualShortTerm}
                onChange={(e) => setManualShortTerm(e.target.value)}
                placeholder="3カ月間の改善プログラムを入力してください"
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
                value={manualLongTerm}
                onChange={(e) => setManualLongTerm(e.target.value)}
                placeholder="長期的な改善プログラムを入力してください"
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
                value={manualTodayTask}
                onChange={(e) => setManualTodayTask(e.target.value)}
                placeholder="今日実施する項目を入力してください"
                className="min-h-[120px] font-mono text-sm"
              />
            </div>
          </SectionCard>

          {/* Support Proposals */}
          <SectionCard
            title="商品サポート提案"
            className="mb-6"
            actions={
              <Button variant="outline" size="sm" onClick={addManualProposal}>
                <Sparkles className="h-4 w-4 mr-1" />
                追加
              </Button>
            }
          >
            <div className="space-y-4">
              {manualProposals.map((proposal, index) => (
                <Card key={proposal.id}>
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-sm">提案 {index + 1}</CardTitle>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-destructive"
                        onClick={() => removeManualProposal(proposal.id)}
                      >
                        x
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
                            updateManualProposal(proposal.id, 'category', value)
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
                            updateManualProposal(proposal.id, 'status', value)
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
                          updateManualProposal(proposal.id, 'name', e.target.value)
                        }
                        placeholder="商品名またはサポート名"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>説明</Label>
                      <Input
                        value={proposal.description}
                        onChange={(e) =>
                          updateManualProposal(proposal.id, 'description', e.target.value)
                        }
                        placeholder="商品の説明"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>提案理由</Label>
                      <Textarea
                        value={proposal.reason}
                        onChange={(e) =>
                          updateManualProposal(proposal.id, 'reason', e.target.value)
                        }
                        placeholder="なぜこの商品を提案するのか"
                        className="min-h-[60px]"
                      />
                    </div>
                  </CardContent>
                </Card>
              ))}

              {manualProposals.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  <p className="text-sm">商品サポート提案がありません</p>
                  <Button variant="outline" size="sm" className="mt-3" onClick={addManualProposal}>
                    <Sparkles className="h-4 w-4 mr-1" />
                    追加
                  </Button>
                </div>
              )}
            </div>
          </SectionCard>

          {/* Save */}
          <div className="flex items-center gap-2">
            <Button onClick={handleSave} disabled={!canSaveManual}>
              <Save className="h-4 w-4 mr-2" />
              保存
            </Button>
            <Button variant="outline" onClick={handleCopy} disabled={!canSaveManual}>
              <Copy className="h-4 w-4 mr-2" />
              コピー
            </Button>
          </div>
          {!canSaveManual && (
            <p className="text-sm text-muted-foreground mt-2">
              患者を選択し、状態まとめと短期プログラムを入力してください
            </p>
          )}
        </>
      )}
    </div>
  );
}
