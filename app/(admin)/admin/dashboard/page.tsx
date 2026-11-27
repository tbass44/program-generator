'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { Users, FileText, CreditCard, ShoppingBag, RefreshCw, ChevronRight } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { PageHeader } from '@/components/admin';

/**
 * 管理ダッシュボード。
 * 初期サンプルにあった固定の患者・商品提案・プログラムなどは表示しない。
 * 実データ連動の一覧が必要になった場合は認証済みAPIから取得する。
 */
type PurchaseRequest = {
  id: string;
  patientId: string;
  patientName: string;
  productName: string;
  updatedAt: string;
  reviewedAt: string | null;
  adminNote: string;
};

type PurchaseRequestsResponse = {
  total?: number;
  requests?: PurchaseRequest[];
  error?: string;
};

export default function AdminDashboardPage() {
  const [purchaseRequests, setPurchaseRequests] = useState<PurchaseRequest[]>([]);
  const [purchaseRequestCount, setPurchaseRequestCount] = useState(0);
  const [loadingPurchaseRequests, setLoadingPurchaseRequests] = useState(true);
  const [purchaseRequestsError, setPurchaseRequestsError] = useState<string | null>(null);
  const [reviewFilter, setReviewFilter] = useState<'pending' | 'reviewed'>('pending');
  const [reviewUpdatingId, setReviewUpdatingId] = useState<string | null>(null);
  const [reviewUpdateError, setReviewUpdateError] = useState<string | null>(null);

  const loadPurchaseRequests = useCallback(async () => {
    setLoadingPurchaseRequests(true);
    setPurchaseRequestsError(null);
    try {
      const response = await fetch('/api/admin/purchase-requests', { cache: 'no-store' });
      const data = (await response.json()) as PurchaseRequestsResponse;
      if (!response.ok || !data.requests) {
        setPurchaseRequestsError('購入希望の商品を取得できませんでした。');
        return;
      }
      setPurchaseRequests(data.requests);
      setPurchaseRequestCount(data.total ?? data.requests.length);
    } catch (error) {
      console.error(error);
      setPurchaseRequestsError('購入希望の取得中に通信エラーが発生しました。');
    } finally {
      setLoadingPurchaseRequests(false);
    }
  }, []);

  useEffect(() => {
    void loadPurchaseRequests();
  }, [loadPurchaseRequests]);

  const pendingRequests = purchaseRequests.filter((item) => !item.reviewedAt);
  const reviewedRequests = purchaseRequests.filter((item) => Boolean(item.reviewedAt));
  const displayedRequests = reviewFilter === 'pending' ? pendingRequests : reviewedRequests;

  const updatePurchaseReview = async (id: string, reviewed: boolean) => {
    if (reviewUpdatingId !== null) return;
    setReviewUpdatingId(id);
    setReviewUpdateError(null);
    try {
      const response = await fetch(`/api/admin/purchase-requests/${id}/review`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reviewed }),
      });
      const data = (await response.json()) as { reviewedAt?: string | null };
      if (!response.ok) {
        setReviewUpdateError('変更できませんでした。最新の状況を再読み込みして確認してください。');
        await loadPurchaseRequests();
        return;
      }
      setPurchaseRequests((current) => current.map((item) => item.id === id
        ? { ...item, reviewedAt: data.reviewedAt ?? null }
        : item));
    } catch (error) {
      console.error(error);
      setReviewUpdateError('通信エラーのため変更できませんでした。');
    } finally {
      setReviewUpdatingId(null);
    }
  };

  return (
    <div>
      <PageHeader title="ダッシュボード" description="管理画面の概要" />

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

      <Card className="mb-8">
        <CardContent className="p-5">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <ShoppingBag className="h-5 w-5 text-teal-700" />
              <h2 className="text-base font-semibold">患者さんからの購入希望</h2>
              {!loadingPurchaseRequests && !purchaseRequestsError && (
                <span className="rounded-full bg-teal-50 px-2 py-0.5 text-xs font-medium text-teal-700">
                  {purchaseRequestCount}件
                </span>
              )}
            </div>
            <button
              type="button"
              onClick={() => void loadPurchaseRequests()}
              disabled={loadingPurchaseRequests}
              className="inline-flex items-center gap-1 text-xs text-teal-700 hover:underline disabled:opacity-50"
            >
              <RefreshCw className="h-3.5 w-3.5" />再読み込み
            </button>
          </div>

          {loadingPurchaseRequests && (
            <p className="text-sm text-gray-500">購入希望を確認しています...</p>
          )}
          {purchaseRequestsError && (
            <p role="alert" className="text-sm text-red-600">{purchaseRequestsError}</p>
          )}
          {!loadingPurchaseRequests && !purchaseRequestsError && (
            <>
              {purchaseRequestCount === 0 ? (
                <p className="text-sm text-gray-500">現在、購入希望の商品はありません。</p>
              ) : (
                <>
                  <div className="mb-3 flex flex-wrap gap-2" aria-label="購入希望の確認状況">
                    <button type="button" onClick={() => setReviewFilter('pending')}
                      className={`rounded-md px-3 py-2 text-sm ${reviewFilter === 'pending'
                        ? 'bg-teal-700 text-white' : 'bg-gray-100 text-gray-700'}`}>
                      未確認（{pendingRequests.length}）
                    </button>
                    <button type="button" onClick={() => setReviewFilter('reviewed')}
                      className={`rounded-md px-3 py-2 text-sm ${reviewFilter === 'reviewed'
                        ? 'bg-teal-700 text-white' : 'bg-gray-100 text-gray-700'}`}>
                      確認済み（{reviewedRequests.length}）
                    </button>
                  </div>
                  {reviewUpdateError && (
                    <p role="alert" className="mb-3 text-sm text-red-600">{reviewUpdateError}</p>
                  )}
                  {displayedRequests.length === 0 ? (
                    <p className="text-sm text-gray-500">この分類の購入希望はありません。</p>
                  ) : (
                    <div className="divide-y">
                      {displayedRequests.map((request) => (
                        <div key={request.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                          <Link href={`/admin/patients/${request.patientId}#purchase-request-${request.id}`}
                            className="flex min-w-0 flex-1 items-center justify-between gap-2 rounded-md text-sm hover:bg-gray-50">
                            <div className="min-w-0">
                              <p className="font-medium text-gray-900">{request.patientName}</p>
                              <p className="mt-0.5 truncate text-gray-600">{request.productName}</p>
                              <p className="mt-0.5 text-xs text-gray-400">
                                {new Date(request.updatedAt).toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' })}
                              </p>
                              {request.adminNote && (
                                <p className="mt-2 line-clamp-2 whitespace-pre-wrap text-xs text-teal-800">
                                  対応メモ：{request.adminNote}
                                </p>
                              )}
                            </div>
                            <ChevronRight className="h-4 w-4 shrink-0 text-gray-500" />
                          </Link>
                          <button type="button"
                            disabled={reviewUpdatingId !== null}
                            onClick={() => void updatePurchaseReview(request.id, !request.reviewedAt)}
                            className="shrink-0 rounded-md border border-teal-600 px-3 py-2 text-xs font-medium text-teal-700 hover:bg-teal-50 disabled:opacity-50">
                            {reviewUpdatingId === request.id ? '更新中...' :
                              request.reviewedAt ? '未確認に戻す' : '確認済みにする'}
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </>
          )}
          {!loadingPurchaseRequests && !purchaseRequestsError && purchaseRequestCount > purchaseRequests.length && (
            <p className="mt-2 text-xs text-gray-500">
              最新{purchaseRequests.length}件を表示しています。
            </p>
          )}
          <p className="mt-4 text-xs text-gray-500">
            確認済みは院側が内容を見た記録です。決済・注文確定・在庫変更とは異なります。
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
