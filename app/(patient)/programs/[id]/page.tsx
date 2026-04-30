'use client';

import { Card, CardContent } from '@/components/ui/card';
import { ChevronLeft, Clock, Calendar, Sparkles } from 'lucide-react';
import Link from 'next/link';

const dummyProgram = {
  id: '1',
  date: '2024年4月15日',
  title: '腰痛改善プログラム',
  content: {
    shortTerm: {
      period: '3カ月',
      description: `姿勢改善とストレッチを中心とした集中期間です。

1カ月目: 姿勢の意識づけと基本ストレッチ
2カ月目: ストレッチの強化と日常動作の改善
3カ月目: 習慣化の定着と効果の確認

目標: 座位時の腰痛を5割軽減`,
    },
    longTerm: {
      period: '6カ月〜',
      description: `筋力強化と生活習慣の改善を進めます。

・コア筋群の強化エクササイズ
・日常の動作改善（立ち上がり、歩行）
・睡眠環境の見直し
・栄養バランスの改善

目標: 再発予防と生活の質の向上`,
    },
    todayTask: {
      items: [
        '朝: ストレッチ10分（膝抱え・猫のポーズ）',
        '昼: 1時間おきに立ち上がりストレッチ',
        '夜: 温熱パック15分 + 入浴',
        '就寝前: スマホ30分以内',
      ],
    },
    selfCare: `・寝る前のスマホは30分以内に
・枕の高さを見直す
・週2回の軽いウォーキング（20分程度）
・水分をこまめに摂る`,
    support: `・次回診察までに痛みが強まった場合は早めにご連絡ください
・ストレッチの方法について動画資料をお送りします
・ご不明な点があればLINEでご相談ください`,
    closing: `無理をせず、できることから始めていきましょう。小さな積み重ねが大きな変化につながります。

次回の診察を楽しみにしています。`,
  },
};

export default function ProgramDetailPage() {
  const program = dummyProgram;

  return (
    <div className="max-w-lg mx-auto px-4 py-6">
      <header className="mb-6">
        <Link
          href="/programs"
          className="flex items-center gap-1 text-sm text-gray-600 mb-3"
        >
          <ChevronLeft className="h-4 w-4" />
          戻る
        </Link>
        <p className="text-xs text-gray-500 mb-1">{program.date}</p>
        <h1 className="text-xl font-bold text-gray-900">{program.title}</h1>
      </header>

      <div className="space-y-4">
        <Card className="border-teal-200 bg-gradient-to-br from-teal-50 to-white">
          <CardContent className="p-5">
            <div className="flex items-center gap-2 mb-3">
              <Sparkles className="h-5 w-5 text-amber-600" />
              <h2 className="font-semibold text-gray-900">今日やること</h2>
            </div>
            <ul className="space-y-2">
              {program.content.todayTask.items.map((item, i) => (
                <li key={i} className="flex items-start gap-2">
                  <span className="w-5 h-5 rounded-full bg-amber-100 text-amber-700 text-xs flex items-center justify-center flex-shrink-0 mt-0.5">
                    {i + 1}
                  </span>
                  <span className="text-sm text-gray-700">{item}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        <Card className="border-gray-200">
          <CardContent className="p-5">
            <div className="flex items-center gap-2 mb-3">
              <Clock className="h-5 w-5 text-teal-600" />
              <h2 className="font-semibold text-gray-900">短期プログラム（3カ月）</h2>
            </div>
            <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">
              {program.content.shortTerm.description}
            </p>
          </CardContent>
        </Card>

        <Card className="border-gray-200">
          <CardContent className="p-5">
            <div className="flex items-center gap-2 mb-3">
              <Calendar className="h-5 w-5 text-teal-600" />
              <h2 className="font-semibold text-gray-900">長期プログラム</h2>
            </div>
            <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">
              {program.content.longTerm.description}
            </p>
          </CardContent>
        </Card>

        <Card className="border-gray-200">
          <CardContent className="p-5">
            <h2 className="font-semibold text-gray-900 mb-3">セルフケア</h2>
            <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">
              {program.content.selfCare}
            </p>
          </CardContent>
        </Card>

        <Card className="border-gray-200">
          <CardContent className="p-5">
            <h2 className="font-semibold text-gray-900 mb-3">サポート提案</h2>
            <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">
              {program.content.support}
            </p>
          </CardContent>
        </Card>

        <Card className="border-gray-200 bg-teal-50/50">
          <CardContent className="p-5">
            <h2 className="font-semibold text-gray-900 mb-3">締め</h2>
            <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">
              {program.content.closing}
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
