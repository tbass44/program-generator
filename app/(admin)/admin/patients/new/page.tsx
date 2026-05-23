'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PageHeader, SectionCard } from '@/components/admin';

/**
 * 新規患者登録フォームの入力値。
 *
 * MVPでは、patients テーブルに存在する基本項目だけを保存する。
 * email / birthdate / address は現時点のDBにないため一旦扱わない。
 */
type PatientFormData = {
  name: string;
  kana: string;
  phone: string;
  memo: string;
};

/**
 * POST /api/admin/patients のレスポンス型。
 */
type CreatePatientResponse = {
  patient?: {
    id: string;
    name: string;
    kana: string | null;
    phone: string | null;
    memo: string | null;
  };
  error?: string;
  detail?: unknown;
};

/**
 * 管理側：新規患者登録ページ。
 *
 * 役割：
 * 1. 患者の基本情報を入力する
 * 2. POST /api/admin/patients に送信する
 * 3. 登録成功後、患者詳細ページへ遷移する
 *
 * 権限チェック：
 * - /admin 配下なので Clerkログイン必須
 * - 管理者roleチェックは layout と API 側で実施
 */
export default function AdminPatientNewPage() {
  const router = useRouter();

  /**
   * フォーム入力値。
   */
  const [formData, setFormData] = useState<PatientFormData>({
    name: '',
    kana: '',
    phone: '',
    memo: '',
  });

  /**
   * 送信中フラグ。
   * 二重送信防止とボタン表示に使う。
   */
  const [isSubmitting, setIsSubmitting] = useState(false);

  /**
   * 登録エラー表示用メッセージ。
   */
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  /**
   * フォーム送信処理。
   * 入力値をAPIへ送り、Supabaseのpatientsへ保存する。
   */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name.trim()) {
      setErrorMessage('氏名を入力してください。');
      return;
    }

    try {
      setIsSubmitting(true);
      setErrorMessage(null);

      const response = await fetch('/api/admin/patients', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: formData.name,
          kana: formData.kana,
          phone: formData.phone,
          memo: formData.memo,
        }),
      });

      const data = (await response.json()) as CreatePatientResponse;

      if (!response.ok || !data.patient) {
        console.error(data);
        setErrorMessage('患者登録に失敗しました。');
        return;
      }

      /**
       * 登録成功後は患者詳細ページへ移動する。
       */
      router.push(`/admin/patients/${data.patient.id}`);
    } catch (error) {
      console.error(error);
      setErrorMessage('患者登録中にエラーが発生しました。');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div>
      <PageHeader
        title="新規患者登録"
        description="新しい患者を登録します"
        backHref="/admin/patients"
      />

      {errorMessage && (
        <div className="mb-4 rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
          {errorMessage}
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <SectionCard title="基本情報" className="mb-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label htmlFor="name">氏名</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="山田 太郎"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="kana">カナ</Label>
              <Input
                id="kana"
                value={formData.kana}
                onChange={(e) => setFormData({ ...formData, kana: e.target.value })}
                placeholder="ヤマダ タロウ"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">電話番号</Label>
              <Input
                id="phone"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                placeholder="090-1234-5678"
              />
            </div>
          </div>
        </SectionCard>

        <SectionCard title="メモ" className="mb-6">
          <div className="space-y-2">
            <Label htmlFor="memo">備考</Label>
            <textarea
              id="memo"
              className="flex min-h-[100px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              value={formData.memo}
              onChange={(e) => setFormData({ ...formData, memo: e.target.value })}
              placeholder="特記事項があれば入力してください"
            />
          </div>
        </SectionCard>

        <div className="flex items-center gap-4">
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? '登録中...' : '登録する'}
          </Button>
          <Button type="button" variant="outline" onClick={() => router.back()}>
            キャンセル
          </Button>
        </div>
      </form>
    </div>
  );
}
