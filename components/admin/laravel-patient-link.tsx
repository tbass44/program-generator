'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

type Link = { id: string; external_user_id: string; verified_at: string };
type Preview = { id: string; name: string | null; kana: string | null; phone: string | null };
type ResponseBody = { link?: Link | null; preview?: Preview; revoked?: boolean; error?: string };

export function LaravelPatientLink({ patientId, patientName, patientKana, patientPhone }: {
  patientId: string;
  patientName: string;
  patientKana: string | null;
  patientPhone: string | null;
}) {
  const [id, setId] = useState('');
  const [active, setActive] = useState<Link | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const api = '/api/admin/patients/' + patientId + '/laravel-link';

  useEffect(() => {
    let disposed = false;
    setPreview(null);
    fetch(api, { cache: 'no-store' })
      .then(async response => {
        const data = (await response.json()) as ResponseBody;
        if (!disposed) {
          if (response.ok) setActive(data.link ?? null);
          else setMessage(data.error ?? '連携状態の取得に失敗しました');
        }
      })
      .catch(() => { if (!disposed) setMessage('連携状態の取得に失敗しました'); });
    return () => { disposed = true; };
  }, [api]);

  async function submit(payload: object, successMessage: string) {
    setBusy(true);
    setMessage('');
    try {
      const response = await fetch(api, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = (await response.json()) as ResponseBody;
      if (!response.ok) { setMessage(data.error ?? '処理に失敗しました'); return; }
      if (data.preview) setPreview(data.preview);
      if (data.link) { setActive(data.link); setPreview(null); }
      setMessage(successMessage);
    } catch {
      setMessage('通信エラーが発生しました');
    } finally { setBusy(false); }
  }

  async function unlink() {
    if (!window.confirm('Laravel患者との連携を解除します。続行しますか？')) return;
    setBusy(true);
    try {
      const response = await fetch(api, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirmRevoke: true }),
      });
      const data = (await response.json()) as ResponseBody;
      if (!response.ok) { setMessage(data.error ?? '解除に失敗しました'); return; }
      setActive(null);
      setPreview(null);
      setMessage('連携を解除しました');
    } catch { setMessage('通信エラーが発生しました'); }
    finally { setBusy(false); }
  }

  return (
    <section className="rounded-lg border p-5 space-y-4">
      <div>
        <h3 className="font-semibold">Laravel予約システムとの患者連携</h3>
        <p className="text-sm text-muted-foreground">
          自動照合は行いません。既存患者の情報を確認してから手動で連携してください。
        </p>
      </div>
      <p className="text-sm">
        MyCare患者: {patientName} / {patientKana ?? 'フリガナなし'} / {patientPhone ?? '電話番号なし'}
      </p>
      {active ? (
        <div className="space-y-2">
          <p className="text-sm">連携済み Laravel患者ID: {active.external_user_id}</p>
          <Button variant="outline" disabled={busy} onClick={unlink}>連携を解除</Button>
        </div>
      ) : (
        <>
          <div className="space-y-2">
            <Label htmlFor="laravel-patient-id">Laravelの既存患者ID</Label>
            <Input id="laravel-patient-id" value={id} onChange={e => { setId(e.target.value); setPreview(null); }} inputMode="numeric" placeholder="例: 123" />
            <Button variant="outline" disabled={busy || !/^[1-9][0-9]*$/.test(id)} onClick={() => submit({ laravelUserId: id, confirmed: false }, '照会しました。患者情報を目視で確認してください。')}>患者情報を照会</Button>
          </div>
          {preview && (
            <div className="space-y-3 rounded-md border p-3">
              <p className="font-semibold">Laravel側の照会結果</p>
              <p className="text-sm">氏名: {preview.name ?? '未登録'}</p>
              <p className="text-sm">フリガナ: {preview.kana ?? '未登録'}</p>
              <p className="text-sm">電話番号: {preview.phone ?? '未登録'}</p>
              <p className="text-sm text-muted-foreground">
                氏名・フリガナ・電話番号を照らし合わせ、必要に応じて別途本人確認してから確定してください。
              </p>
              <Button disabled={busy || !preview.name} onClick={() => {
                if (!window.confirm('MyCare患者とLaravel患者が同一人物であることを確認しましたか？')) return;
                submit({ laravelUserId: preview.id, expectedName: preview.name, confirmed: true }, '患者IDを連携しました');
              }}>本人確認済みとして連携を確定</Button>
            </div>
          )}
        </>
      )}
      {message && <p role="status" className="text-sm">{message}</p>}
    </section>
  );
}
