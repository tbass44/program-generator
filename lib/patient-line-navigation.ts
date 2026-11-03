'use client';

import liff from '@line/liff';

const NEXT_PATH_STORAGE_KEY = 'patientNextPath';

/**
 * 患者ページを直接開いた場合も、LIFF認証後に戻れるよう現在地を保存する。
 * sessionStorageが利用できない場合もnextクエリで復帰先を引き継ぐ。
 */
export function redirectToLineEntry() {
  if (typeof window === 'undefined') return;

  const nextPath = `${window.location.pathname}${window.location.search}`;
  try {
    window.sessionStorage.setItem(NEXT_PATH_STORAGE_KEY, nextPath);
  } catch (error) {
    console.error('Could not save patient next path', error);
  }

  window.location.assign(`/line?next=${encodeURIComponent(nextPath)}`);
}

/** 期限切れ・失効したLINEログインを解除し、共通の入口から再認証する。 */
export function retryLineLogin() {
  try {
    if (liff.isLoggedIn()) {
      liff.logout();
    }
  } catch (error) {
    console.error(error);
  }

  redirectToLineEntry();
}
