'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';

const SITE_NAME = 'カイロシガ整体院';

/** Browser tab titles for administrator and patient screens. */
function getPageTitle(pathname: string): string {
  const segments = pathname.split('/').filter(Boolean);
  if (segments[0] === 'admin') {
    const section = segments[1] ?? 'dashboard';
    let page = '';
    switch (section) {
      case 'dashboard':
        page = 'ダッシュボード';
        break;
      case 'patients':
        page = segments[2] === 'new' ? '患者新規登録'
          : segments[3] === 'purchases' ? '患者購入履歴'
          : segments[3] === 'rentals' ? '患者レンタル履歴'
          : segments[2] ? '患者詳細'
          : '患者管理';
        break;
      case 'programs':
        page = segments[2] === 'new' ? '改善プログラム作成'
          : segments[2] ? '改善プログラム詳細' : '改善プログラム管理';
        break;
      case 'products':
        page = segments[2] === 'catalog-import' ? '商品PDF一括登録'
          : segments[2] === 'new' ? '商品新規登録'
          : segments[2] ? '商品編集' : '商品管理';
        break;
      case 'plans':
        page = segments[2] === 'new' ? 'プラン作成'
          : segments[2] ? 'プラン詳細' : 'プラン管理';
        break;
      default:
        page = '管理画面';
    }
    return `${page}｜管理画面｜${SITE_NAME}`;
  }

  const patientTitles: Record<string, string> = {
    dashboard: 'ホーム',
    programs: '改善プログラム',
    visits: '通院履歴',
    'product-support': '商品サポート',
    rentals: 'レンタル',
    plans: 'プラン',
    purchases: '購入履歴',
  };
  const section = segments[0];
  if (section && patientTitles[section]) {
    const isDetail = segments.length > 1;
    const title = isDetail && section === 'product-support' ? '商品詳細'
      : isDetail && section === 'programs' ? '改善プログラム詳細'
      : isDetail && section === 'visits' ? '通院詳細'
      : patientTitles[section];
    return `${title}｜${SITE_NAME}`;
  }

  return `改善プログラム｜${SITE_NAME}`;
}

export default function PageTitle() {
  const pathname = usePathname();

  useEffect(() => {
    document.title = getPageTitle(pathname ?? '/');
  }, [pathname]);

  return null;
}
