'use client';

import liff from '@line/liff';

const NEXT_PATH_STORAGE_KEY = 'patientNextPath';

// 認証後の遷移先は患者向けの公開画面だけに限定する。
function isSafePatientPath(value: string | null): value is string {
  return Boolean(value && /^\/(?:dashboard|programs(?:\/[0-9a-f-]{36})?|plans|visits|product-support(?:\/[0-9a-f-]{36})?|rentals|purchases)(?:\?.*)?$/i.test(value));
}

export function getPatientNextPath(): string {
  if (typeof window === 'undefined') return '/dashboard';

  const queryNext = new URLSearchParams(window.location.search).get('next');
  if (isSafePatientPath(queryNext)) return queryNext;

  try {
    const storedNext = window.sessionStorage.getItem(NEXT_PATH_STORAGE_KEY);
    if (isSafePatientPath(storedNext)) return storedNext;
  } catch (error) {
    console.error(error);
  }

  return '/dashboard';
}


/** 戻り先を使用した後は消し、次回のLINE入口で古い画面を開かないようにする。 */
export function clearPatientNextPath() {
  if (typeof window === 'undefined') return;

  try {
    window.sessionStorage.removeItem(NEXT_PATH_STORAGE_KEY);
  } catch (error) {
    console.error(error);
  }
}

/**
 * 患者ページを直接開いた場合も、LIFF認証後に戻れるよう現在地を保存する。
 * sessionStorageが利用できない場合もnextクエリで復帰先を引き継ぐ。
 */
export function redirectToLineEntry() {
  if (typeof window === 'undefined') return;

  const nextPath = `${window.location.pathname}${window.location.search}`;
  if (isSafePatientPath(nextPath)) {
    try {
      window.sessionStorage.setItem(NEXT_PATH_STORAGE_KEY, nextPath);
    } catch (error) {
      console.error('Could not save patient next path', error);
    }

    window.location.assign(`/line?next=${encodeURIComponent(nextPath)}`);
    return;
  }

  // /line/linkなどは復帰先にしない。直前に保存された患者画面を優先する。
  window.location.assign(`/line?next=${encodeURIComponent(getPatientNextPath())}`);
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
