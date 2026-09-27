'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { Copy, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { PageHeader, SectionCard } from '@/components/admin';

type PatientDetail = {
  id: string;
  name: string;
  line_user_id: string | null;
  line_display_name: string | null;
  line_picture_url: string | null;
  line_linked_at: string | null;
  line_link_code: string | null;
  line_link_code_expires_at: string | null;
};

type PatientDetailResponse = {
  patient?: PatientDetail;
  error?: string;
  detail?: unknown;
};

type LineLinkCodePatient = {
  id: string;
  name: string;
  lineUserId: string | null;
  lineDisplayName: string | null;
  linePictureUrl: string | null;
  lineLinkedAt: string | null;
  lineLinkCode: string | null;
  lineLinkCodeExpiresAt: string | null;
  updatedAt: string;
};

type LineLinkCodeResponse = {
  patient?: LineLinkCodePatient;
  lineLinkCode?: string;
  lineLinkCodeExpiresAt?: string;
  error?: string;
  detail?: unknown;
};

function buildApiErrorMessage(prefix: string, status: number, data: { error?: string; detail?: unknown }) {
  const detailText = data.detail ? ` / detail: ${String(data.detail)}` : '';
  const errorText = data.error ? ` / error: ${data.error}` : '';

  return `${prefix}（HTTP ${status}${errorText}${detailText}）`;
}

function formatDateTime(value: string | null | undefined) {
  if (!value) {
    return '未設定';
  }

  return new Date(value).toLocaleString('ja-JP');
}

export default function AdminPatientLineLinkPage() {
  const params = useParams();
  const patientId = typeof params.id === 'string' ? params.id : '';

  const [patient, setPatient] = useState<PatientDetail | null>(null);
  const [lineLinkCode, setLineLinkCode] = useState<string | null>(null);
  const [lineLinkCodeExpiresAt, setLineLinkCodeExpiresAt] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    const fetchPatient = async () => {
      if (!patientId) {
        setErrorMessage('患者IDを取得できませんでした。');
        setIsLoading(false);
        return;
      }

      try {
        setIsLoading(true);
        setErrorMessage(null);

        const response = await fetch(`/api/admin/patients/${patientId}`);
        const data = (await response.json()) as PatientDetailResponse;

        if (!response.ok || !data.patient) {
          console.error(data);
          setErrorMessage(buildApiErrorMessage('患者情報を取得できませんでした', response.status, data));
          setPatient(null);
          return;
        }

        setPatient(data.patient);
        setLineLinkCode(data.patient.line_link_code);
        setLineLinkCodeExpiresAt(data.patient.line_link_code_expires_at);
      } catch (error) {
        console.error(error);
        setErrorMessage(`患者情報の取得中にエラーが発生しました。${String(error)}`);
        setPatient(null);
      } finally {
        setIsLoading(false);
      }
    };

    fetchPatient();
  }, [patientId]);

  const handleGenerateCode = async () => {
    if (!patientId) {
      setErrorMessage('患者IDを取得できませんでした。');
      return;
    }

    try {
      setIsGenerating(true);
      setErrorMessage(null);
      setSuccessMessage(null);

      const response = await fetch(`/api/admin/patients/${patientId}/line-link-code`, {
        method: 'POST',
      });
      const data = (await response.json()) as LineLinkCodeResponse;

      if (!response.ok || !data.patient || !data.lineLinkCode) {
        console.error(data);
        setErrorMessage(buildApiErrorMessage('LINE連携コードを発行できませんでした', response.status, data));
        return;
      }

      setPatient((current) => {
        if (!current) {
          return current;
        }

        return {
          ...current,
          line_link_code: data.patient?.lineLinkCode ?? null,
          line_link_code_expires_at: data.patient?.lineLinkCodeExpiresAt ?? null,
        };
      });
      setLineLinkCode(data.lineLinkCode);
      setLineLinkCodeExpiresAt(data.lineLinkCodeExpiresAt ?? null);
      setSuccessMessage('LINE連携コードを発行しました。');
    } catch (error) {
      console.error(error);
      setErrorMessage(`LINE連携コードの発行中にエラーが発生しました。${String(error)}`);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCopyCode = async () => {
    if (!lineLinkCode) {
      return;
    }

    try {
      await navigator.clipboard.writeText(lineLinkCode);
      setSuccessMessage('LINE連携コードをコピーしました。');
    } catch (error) {
      console.error(error);
      setErrorMessage('コピーに失敗しました。画面上のコードを手動でコピーしてください。');
    }
  };

  if (isLoading) {
    return (
      <div>
        <PageHeader
          title="LINE連携コード発行"
          description="患者情報を読み込んでいます"
          backHref={patientId ? `/admin/patients/${patientId}` : '/admin/patients'}
        />
        <div className="rounded-lg border bg-card p-6 text-sm text-muted-foreground">
          患者情報を読み込み中です...
        </div>
      </div>
    );
  }

  if (!patient) {
    return (
      <div>
        <PageHeader
          title="LINE連携コード発行"
          description="患者情報を表示できませんでした"
          backHref="/admin/patients"
        />
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-6 text-sm text-destructive whitespace-pre-wrap">
          {errorMessage || '患者情報を取得できませんでした。'}
        </div>
      </div>
    );
  }

  const isLinked = Boolean(patient.line_user_id);

  return (
    <div>
      <PageHeader
        title="LINE連携コード発行"
        description={`${patient.name}さんのLINE連携用コード`}
        backHref={`/admin/patients/${patient.id}`}
      />

      {errorMessage && (
        <div className="mb-4 rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive whitespace-pre-wrap">
          {errorMessage}
        </div>
      )}

      {successMessage && (
        <div className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700">
          {successMessage}
        </div>
      )}

      <SectionCard title="患者情報" className="mb-6">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <p className="text-sm text-muted-foreground">患者名</p>
            <p className="font-medium">{patient.name}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">LINE連携</p>
            <div className="mt-1">
              <Badge variant={isLinked ? 'default' : 'secondary'}>
                {isLinked ? '連携済み' : '未連携'}
              </Badge>
            </div>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">LINE表示名</p>
            <p className="font-medium">{patient.line_display_name || '未登録'}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">LINE連携日時</p>
            <p className="font-medium">{formatDateTime(patient.line_linked_at)}</p>
          </div>
        </div>
      </SectionCard>

      <SectionCard title="連携コード">
        {isLinked ? (
          <div className="rounded-lg border bg-muted/40 p-4 text-sm text-muted-foreground">
            この患者さんはすでにLINE連携済みです。通常は連携コードの再発行は不要です。
          </div>
        ) : (
          <div className="space-y-6">
            <div className="rounded-lg border bg-amber-50 p-4 text-sm text-amber-800">
              患者さんにLINE公式アカウントから患者画面を開いてもらい、未連携の場合はこのコードを入力してもらいます。
              一度連携すると、次回以降はコード入力不要です。
            </div>

            {lineLinkCode ? (
              <div className="rounded-xl border p-6 text-center">
                <p className="text-sm text-muted-foreground">LINE連携コード</p>
                <p className="mt-2 text-4xl font-bold tracking-[0.35em]">{lineLinkCode}</p>
                <p className="mt-3 text-sm text-muted-foreground">
                  有効期限：{formatDateTime(lineLinkCodeExpiresAt)}
                </p>
                <div className="mt-5 flex flex-wrap justify-center gap-3">
                  <Button type="button" variant="outline" onClick={handleCopyCode}>
                    <Copy className="mr-2 h-4 w-4" />
                    コードをコピー
                  </Button>
                  <Button type="button" onClick={handleGenerateCode} disabled={isGenerating}>
                    <RefreshCw className="mr-2 h-4 w-4" />
                    {isGenerating ? '再発行中...' : 'コードを再発行'}
                  </Button>
                </div>
              </div>
            ) : (
              <div className="rounded-xl border p-6 text-center">
                <p className="text-sm text-muted-foreground">
                  まだLINE連携コードは発行されていません。
                </p>
                <Button type="button" className="mt-5" onClick={handleGenerateCode} disabled={isGenerating}>
                  <RefreshCw className="mr-2 h-4 w-4" />
                  {isGenerating ? '発行中...' : 'LINE連携コードを発行'}
                </Button>
              </div>
            )}

            <div className="rounded-lg border p-4 text-sm text-muted-foreground">
              <p className="font-medium text-foreground">患者さんへの案内例</p>
              <p className="mt-2 whitespace-pre-wrap">
                LINEの患者画面を開いていただき、連携コード入力画面で以下のコードを入力してください。{lineLinkCode ? `\n\n連携コード：${lineLinkCode}` : ''}
              </p>
            </div>
          </div>
        )}
      </SectionCard>

      <div className="mt-6">
        <Link href={`/admin/patients/${patient.id}`}>
          <Button type="button" variant="outline">患者詳細へ戻る</Button>
        </Link>
      </div>
    </div>
  );
}
