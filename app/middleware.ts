import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';

/**
 * Clerk認証を必須にするルート。
 *
 * MVPではまず管理画面だけを保護する。
 * 患者側の /dashboard や /line は、LINE LIFF導線で動かしているため、
 * この段階ではClerk保護しない。
 */
const isAdminRoute = createRouteMatcher(['/admin(.*)']);

/**
 * Clerk Middleware。
 *
 * /admin 配下へアクセスした場合だけログイン必須にする。
 * 未ログインの場合はClerkのサインインへ誘導される。
 */
export default clerkMiddleware((auth, req) => {
  if (isAdminRoute(req)) {
    auth().protect();
  }
});

/**
 * Middlewareを適用する対象。
 *
 * _next/static や画像などの静的ファイルは除外し、
 * 通常ページとAPI Routeにだけ適用する。
 */
export const config = {
  matcher: [
    '/((?!.*\\..*|_next).*)',
    '/',
    '/(api|trpc)(.*)',
  ],
};
