import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';

/**
 * Clerk認証を必須にするルートを定義する。
 *
 * MVPでは、まず管理側の /admin 配下だけをログイン必須にする。
 * 患者側の /line や /dashboard はLINE LIFF導線で動かしているため、
 * この段階ではClerkの保護対象に入れない。
 */
const isAdminRoute = createRouteMatcher(['/admin(.*)']);

/**
 * Clerk Middleware。
 *
 * /admin 配下にアクセスした場合だけ auth().protect() を実行する。
 * 未ログインの場合は、Clerkのサインイン画面へ誘導される。
 *
 * ここでは「ログインしているか」だけを見る。
 * admin権限かどうかのrole判定は、次のSTEP6で profiles / role 設計と合わせて実装する。
 */
export default clerkMiddleware((auth, req) => {
  if (isAdminRoute(req)) {
    auth().protect();
  }
});

/**
 * Middlewareを適用するURL範囲。
 *
 * _next/static や画像・CSSなどの静的ファイルは除外し、
 * 通常ページとAPI Routeに適用する。
 */
export const config = {
  matcher: [
    '/((?!.*\\..*|_next).*)',
    '/',
    '/(api|trpc)(.*)',
  ],
};
