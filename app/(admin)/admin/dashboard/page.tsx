'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { Users, FileText, CreditCard, ShoppingBag, RefreshCw, ChevronRight, Search, X } from 'lucide-react';
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
  pendingCount?: number;
  reviewedCount?: number;
  filteredCount?: number;
  page?: number;
  pageSize?: number;
  requests?: PurchaseRequest[];
  error?: string;
};

export default function AdminDashboardPage() {
  const [purchaseRequests, setPurchaseRequests] = useState<PurchaseRequest[]>([]);
  const [purchaseRequestCount, setPurchaseRequestCount] = useState(0);
  const [loadingPurchaseRequests, setLoadingPurchaseRequests] = useState(true);
  const [purchaseRequestsError, setPurchaseRequestsError] = useState<string | null>(null);
  const [reviewFilter, setReviewFilter] = useState<'pending' | 'reviewed'>('pending');
  const [sortOrder, setSortOrder] = useState<'oldest' | 'newest'>('oldest');
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState('');
  const [activeSearch, setActiveSearch] = useState('');
  const [pendingCount, setPendingCount] = useState(0);
  const [reviewedCount, setReviewedCount] = useState(0);
  const [filteredCount, setFilteredCount] = useState(0);
  const pageSize = 20;
  const [reviewUpdatingId, setReviewUpdatingId] = useState<string | null>(null);
  const [reviewUpdateError, setReviewUpdateError] = useState<string | null>(null);
  const [loadedAt, setLoadedAt] = useState<number>(Date.now());

  const loadPurchaseRequests = useCallback(async () => {
    setLoadingPurchaseRequests(true);
    setPurchaseRequestsError(null);
    try {
      const response = await fetch(`/api/admin/purchase-requests?review=${reviewFilter}&page=${page}&sort=${sortOrder}&search=${encodeURIComponent(activeSearch)}`, {
        cache: 'no-store',
      });
      const data = (await response.json()) as PurchaseRequestsResponse;
      if (!response.ok || !data.requests) {
        setPurchaseRequestsError('購入希望の商品を取得できませんでした。');
        return;
      }
      setPurchaseRequests(data.requests);
      setPurchaseRequestCount(data.total ?? data.requests.length);
      setPendingCount(data.pendingCount ?? 0);
      setReviewedCount(data.reviewedCount ?? 0);
      setFilteredCount(data.filteredCount ?? data.requests.length);
      setLoadedAt(Date.now());
    } catch (error) {
      console.error(error);
      setPurchaseRequestsError('購入希望の取得中に通信エラーが発生しました。');
    } finally {
      setLoadingPurchaseRequests(false);
    }
  }, [reviewFilter, page, activeSearch, sortOrder]);

  useEffect(() => {
    void loadPurchaseRequests();
  }, [loadPurchaseRequests]);

  const displayedRequests = purchaseRequests;
  const applySearch = (term: string) => {
    const normalized = term.trim();
    setSearchInput(normalized);
    setPage(1);
    setActiveSearch(normalized);
  };
  const elapsedDays = (value: string) => {
    const timestamp = new Date(value).getTime();
    return Number.isFinite(timestamp) ? Math.max(0, Math.floor((loadedAt - timestamp) / 86400000)) : null;
  };
  const changeReviewFilter = (filter: 'pending' | 'reviewed') => {
    if (filter === reviewFilter) return;
    setPage(1);
    setReviewFilter(filter);
  };

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
      // The updated row belongs to the opposite tab, and may affect page bounds.
      // Always refresh exact counts and the current page from the server.
      if (page !== 1) setPage(1);
      else await loadPurchaseRequests();
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

          <form className="mb-4 flex flex-wrap items-center gap-2"
            onSubmit={(event) => { event.preventDefault(); applySearch(searchInput); }}>
            <label htmlFor="purchase-request-search" className="sr-only">
              患者名または商品名で購入希望を検索
            </label>
            <input id="purchase-request-search" type="search" maxLength={80}
              value={searchInput} onChange={(event) => setSearchInput(event.target.value)}
              placeholder="患者名・商品名で検索"
              className="min-w-0 flex-1 rounded-md border px-3 py-2 text-sm"
            />
            <button type="submit" disabled={loadingPurchaseRequests || reviewUpdatingId !== null}
              className="inline-flex items-center gap-1 rounded-md bg-teal-700 px-3 py-2 text-sm text-white disabled:opacity-40">
              <Search className="h-4 w-4" />検索
            </button>
            {activeSearch && (
              <button type="button" onClick={() => applySearch('')}
                disabled={loadingPurchaseRequests || reviewUpdatingId !== null}
                className="inline-flex items-center gap-1 rounded-md border px-3 py-2 text-sm disabled:opacity-40">
                <X className="h-4 w-4" />解除
              </button>
            )}
          </form>
          {activeSearch && !loadingPurchaseRequests && !purchaseRequestsError && (
            <p className="mb-3 text-xs text-gray-600">
              「{activeSearch}」の検索結果：合計{purchaseRequestCount}件（未確認{pendingCount}件・確認済み{reviewedCount}件）
            </p>
          )}
          {loadingPurchaseRequests && (
            <p className="text-sm text-gray-500">購入希望を確認しています...</p>
          )}
          {purchaseRequestsError && (
            <p role="alert" className="text-sm text-red-600">{purchaseRequestsError}</p>
          )}
          {!loadingPurchaseRequests && !purchaseRequestsError && (
            <>
              {purchaseRequestCount === 0 ? (
                <p className="text-sm text-gray-500">
                  {activeSearch ? '該当する購入希望はありません。' : '現在、購入希望の商品はありません。'}
                </p>
              ) : (
                <>
                  <div className="mb-3 flex flex-wrap gap-2" aria-label="購入希望の確認状況">
                    <button type="button" onClick={() => changeReviewFilter('pending')}
                      className={`rounded-md px-3 py-2 text-sm ${reviewFilter === 'pending'
                        ? 'bg-teal-700 text-white' : 'bg-gray-100 text-gray-700'}`}>
                      未確認（{pendingCount}）
                    </button>
                    <button type="button" onClick={() => changeReviewFilter('reviewed')}
                      className={`rounded-md px-3 py-2 text-sm ${reviewFilter === 'reviewed'
                        ? 'bg-teal-700 text-white' : 'bg-gray-100 text-gray-700'}`}>
                      確認済み（{reviewedCount}）
                    </button>
                  </div>
                  <div className="mb-3 flex flex-wrap items-center gap-2">
                    <label htmlFor="purchase-request-sort" className="text-sm text-gray-600">
                      受付順
                    </label>
                    <select id="purchase-request-sort" value={sortOrder}
                      onChange={(event) => {
                        setPage(1);
                        setSortOrder(event.target.value as 'oldest' | 'newest');
                      }}
                      disabled={loadingPurchaseRequests || reviewUpdatingId !== null}
                      className="rounded-md border bg-white px-3 py-2 text-sm disabled:opacity-40">
                      <option value="oldest">古い順（対応漏れ防止）</option>
                      <option value="newest">新しい順</option>
                    </select>
                  </div>
                  {reviewUpdateError && (
                    <p role="alert" className="mb-3 text-sm text-red-600">{reviewUpdateError}</p>
                  )}
                  {displayedRequests.length === 0 ? (
                    <p className="text-sm text-gray-500">
                      {filteredCount > 0
                        ? 'このページには表示できる購入希望がありません。前のページへ戻ってください。'
                        : 'この分類の購入希望はありません。'}
                    </p>
                  ) : (
                    <div className="divide-y">
                      {displayedRequests.map((request) => (
                        <div key={request.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                          <Link href={`/admin/patients/${request.patientId}#purchase-request-${request.id}`}
                            className="flex min-w-0 flex-1 items-center justify-between gap-2 rounded-md text-sm hover:bg-gray-50">
                            <div className="min-w-0">
                              <p className="font-medium text-gray-900">{request.patientName}</p>
                              <p className="mt-0.5 truncate text-gray-600">{request.productName}</p>
                              <p className="mt-0.5 text-xs text-gray-500">
                                受付: {new Date(request.updatedAt).toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' })}
                              </p>
                              {!request.reviewedAt && elapsedDays(request.updatedAt) !== null && (
                                <p className={`mt-1 text-xs font-medium ${elapsedDays(request.updatedAt)! >= 2
                                  ? 'text-amber-700' : 'text-gray-500'}`}>
                                  {elapsedDays(request.updatedAt) === 0
                                    ? '受付から24時間未満'
                                    : `受付から${elapsedDays(request.updatedAt)}日以上経過`}
                                </p>
                              )}
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
          {!loadingPurchaseRequests && !purchaseRequestsError && filteredCount > 0 && (
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t pt-3">
              <p className="text-xs text-gray-500">
                {filteredCount}件中 {Math.min((page - 1) * pageSize + 1, filteredCount)}〜
                {Math.min(page * pageSize, filteredCount)}件目
              </p>
              <div className="flex items-center gap-2">
                <button type="button" disabled={page <= 1 || loadingPurchaseRequests}
                  onClick={() => setPage((current) => Math.max(1, current - 1))}
                  className="rounded-md border px-3 py-2 text-sm disabled:opacity-40">
                  前へ
                </button>
                <span className="text-xs text-gray-600">
                  {page} / {Math.max(1, Math.ceil(filteredCount / pageSize))}ページ
                </span>
                <button type="button" disabled={page * pageSize >= filteredCount || loadingPurchaseRequests}
                  onClick={() => setPage((current) => current + 1)}
                  className="rounded-md border px-3 py-2 text-sm disabled:opacity-40">
                  次へ
                </button>
              </div>
            </div>
          )}
          <p className="mt-4 text-xs text-gray-500">
            確認済みは院側が内容を見た記録です。決済・注文確定・在庫変更とは異なります。
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
