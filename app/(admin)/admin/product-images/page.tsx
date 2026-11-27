'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import products from '@/scripts/product-thumbnails-manifest.json';

export default function ProductImageCheckPage() {
  const [search, setSearch] = useState('');
  const shown = useMemo(() => products.filter((product) =>
    product.name.toLocaleLowerCase('ja-JP').includes(search.trim().toLocaleLowerCase('ja-JP'))
  ), [search]);

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <div>
        <Link href="/admin/products" className="text-sm text-teal-700 hover:underline">
          ← 商品管理へ戻る
        </Link>
        <h1 className="mt-3 text-xl font-bold">商品サムネイル確認一覧</h1>
        <p className="mt-1 text-sm text-gray-600">
          登録済み187商品の画像を商品名と並べて確認できます。間違っている商品名だけ控えてください。
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <input
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="商品名で絞り込み"
          aria-label="商品名で検索"
          className="w-full max-w-sm rounded-md border bg-white px-3 py-2 text-sm"
        />
        <span className="text-sm text-gray-500">{shown.length} / {products.length} 商品</span>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
        {shown.map((product, index) => (
          <div key={product.id} className="overflow-hidden rounded-lg border bg-white">
            <a
              href={product.pdf_url || undefined}
              target="_blank"
              rel="noopener noreferrer"
              className="block"
              title={product.pdf_url ? '元PDFを開く' : '元PDFなし'}
              onClick={product.pdf_url ? undefined : (event) => event.preventDefault()}
            >
              <div className="flex aspect-square items-center justify-center bg-gray-50 p-2">
                <img
                  src={`/product-thumbnails/${product.id}.webp`}
                  alt={product.name}
                  loading="lazy"
                  className="h-full w-full object-contain"
                />
              </div>
            </a>
            <div className="space-y-1 p-3">
              <p className="min-h-[2.5rem] text-sm font-medium leading-5">{product.name}</p>
              {product.pdf_url ? (
                <a href={product.pdf_url} target="_blank" rel="noopener noreferrer"
                  className="text-xs text-teal-700 underline">
                  元PDFと比較
                </a>
              ) : (
                <span className="text-xs text-gray-500">元PDFなし・代替画像</span>
              )}
            </div>
          </div>
        ))}
      </div>
      {shown.length === 0 && <p className="text-sm text-gray-600">一致する商品がありません。</p>}
    </div>
  );
}
