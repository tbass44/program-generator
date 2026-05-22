'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { PlanStatusCard, ProgramCard, SectionHeader, SupportCategoryCard } from '@/components/patient';
import { Moon, Apple, Dumbbell, Sparkles } from 'lucide-react';

/**
 * 患者ダッシュボードAPIから返ってくる患者情報。
 *
 * 現時点では、まず患者名を実データ表示するために使う。
 * 今後、改善プログラム・プラン・商品提案も同じAPIに追加していく予定。
 */
type DashboardPatient = {
  id: string;
  name: string;
  memo: string | null;
  line_user_id: string | null;
  line_display_name: string | null;
  line_picture_url: string | null;
  line_linked_at: string | null;
};

/**
 * /api/patient/dashboard のレスポンス型。
 */
type DashboardResponse = {
  patient?: DashboardPatient;
  error?: string;
  detail?: unknown;
};

/**
 * 改善プログラムはまだDB連携前なので、MVP初期表示用のダミーデータを残す。
 * 次の工程で programs テーブルから取得する形に差し替える。
 */
const currentProgram = {
  id: '1',
  title: '腰痛改善プログラム',
  shortTerm: '姿勢改善とストレッチ集中期',
  longTerm: '筋力強化と生活習慣の改善',
  todayTask: '朝のストレッチ10分 + 夜の温熱パック',
};

/**
 * 商品サポートもまだDB連携前なので、MVP初期表示用のダミーデータを残す。
 * 次の工程で patient_product_recommendations から取得する形に差し替える。
 */
const supportCategories = [
  {
    href: '/product-support?category=sleep',
    icon: Moon,
    title: '物理療法（睡眠）',
    description: '睡眠の質を高めるサポート',
    recommendedSupport: 'マグネシウムサプリメント',
    relatedProgramId: '1',
    relatedProgramTitle: '腰痛改善プログラム',
    supportItems: [
      { name: 'マグネシウム', href: '/product-support?category=sleep&item=1' },
      { name: 'ホットパック', href: '/product-support?category=sleep&item=2' },
    ],
  },
  {
    href: '/product-support?category=nutrition',
    icon: Apple,
    title: '栄養療法',
    description: '内面から健康を支える栄養サポート',
    recommendedSupport: 'ビタミンDサプリメント',
    relatedProgramId: '1',
    relatedProgramTitle: '腰痛改善プログラム',
    supportItems: [
      { name: 'ビタミンD', href: '/product-support?category=nutrition&item=1' },
      { name: 'オメガ3', href: '/product-support?category=nutrition&item=2' },
    ],
  },
  {
    href: '/product-support?category=exercise',
    icon: Dumbbell,
    title: '運動療法',
    description: '体を動かして改善を促すサポート',
    recommendedSupport: '姿勢矯正ベルト',
    relatedProgramId: '2',
    relatedProgramTitle: '肩こり解消プログラム',
    supportItems: [
      { name: '矯正ベルト', href: '/product-support?category=exercise&item=1' },
      { name: 'ヨガマット', href: '/product-support?category=exercise&item=2' },
    ],
  },
  {
    href: '/product-support?category=skincare',
    icon: Sparkles,
    title: 'スキンケア',
    description: '肌の健康を保つケアサポート',
    recommendedSupport: '保湿クリーム',
    supportItems: [
      { name: '保湿クリーム', href: '/product-support?category=skincare&item=1' },
      { name: 'UVケア', href: '/product-support?category=skincare&item=2' },
    ],
  },
];

/**
 * 患者側ダッシュボード。
 *
 * 現在の役割：
 * 1. /line から渡された patientId をURLクエリから受け取る
 * 2. /api/patient/dashboard から患者基本情報を取得する
 * 3. ヘッダーに患者名を表示する
 * 4. プラン・改善プログラム・商品サポートは一旦ダミー表示を維持する
 */
export default function DashboardPage() {
  /**
   * /dashboard?patientId=xxx の patientId を取得する。
   */
  const searchParams = useSearchParams();
  const patientId = searchParams.get('patientId');

  /**
   * APIから取得した患者情報。
   */
  const [patient, setPatient] = useState<DashboardPatient | null>(null);

  /**
   * 患者情報取得中の状態管理。
   */
  const [isLoading, setIsLoading] = useState(Boolean(patientId));

  /**
   * 患者情報取得に失敗した場合の表示用メッセージ。
   */
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    /**
     * patientId がない場合は、まだLINE導線から来ていない可能性がある。
     * その場合はダミーデータ表示を維持し、エラーにはしない。
     */
    if (!patientId) {
      setIsLoading(false);
      return;
    }

    /**
     * 患者ダッシュボードAPIから患者基本情報を取得する。
     */
    const fetchPatientDashboard = async () => {
      try {
        setIsLoading(true);
        setErrorMessage(null);

        const response = await fetch(`/api/patient/dashboard?patientId=${patientId}`);
        const data = (await response.json()) as DashboardResponse;

        if (!response.ok || !data.patient) {
          console.error(data);
          setErrorMessage('患者情報を取得できませんでした。');
          return;
        }

        setPatient(data.patient);
      } catch (error) {
        console.error(error);
        setErrorMessage('患者情報の取得中にエラーが発生しました。');
      } finally {
        setIsLoading(false);
      }
    };

    fetchPatientDashboard();
  }, [patientId]);

  return (
    <div className="max-w-lg mx-auto px-4 py-6">
      <header className="mb-6">
        <h1 className="text-xl font-bold text-gray-900">
          {patient ? `こんにちは、${patient.name}さん` : 'こんにちは'}
        </h1>
        <p className="text-sm text-gray-500">本日の状態を確認しましょう</p>

        {/*
          patientId付きURLで来た場合、患者情報の取得状態を簡単に表示する。
          MVP確認用なので、今後はより自然なUIに整理する。
        */}
        {isLoading && (
          <p className="mt-2 text-xs text-gray-400">患者情報を読み込み中です...</p>
        )}
        {errorMessage && (
          <p className="mt-2 text-xs text-red-500">{errorMessage}</p>
        )}
      </header>

      <section className="mb-6">
        <SectionHeader
          title="現在のプラン"
          action={
            <Link href="/plans" className="text-sm text-teal-600">
              詳細
            </Link>
          }
        />
        <PlanStatusCard type="ticket" remaining={5} />
      </section>

      <section className="mb-6">
        <SectionHeader
          title="現在の改善プログラム"
          action={
            <Link href="/programs" className="text-sm text-teal-600">
              すべて見る
            </Link>
          }
        />
        <ProgramCard {...currentProgram} />
      </section>

      <section>
        <SectionHeader
          title="商品サポート"
          action={
            <Link href="/product-support" className="text-sm text-teal-600">
              すべて見る
            </Link>
          }
        />
        <div className="space-y-3">
          {supportCategories.map((category) => (
            <SupportCategoryCard key={category.title} {...category} />
          ))}
        </div>
      </section>
    </div>
  );
}
