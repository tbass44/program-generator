import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { createClient } from '@supabase/supabase-js';

/**
 * 必須環境変数を取得するための関数。
 *
 * process.env は TypeScript上では string | undefined になるため、
 * ここで undefined を弾いて string として扱えるようにする。
 *
 * build時ではなくAPI実行時に呼ぶことで、
 * Vercel build中に環境変数チェックで落ちるのを避ける。
 */
function getRequiredEnv(key: string): string {
  const value = process.env[key];

  if (!value) {
    throw new Error(`${key} is not set`);
  }

  return value;
}

/**
 * Supabase profiles テーブルの最小型。
 *
 * STEP6では、まずClerkログインユーザーとprofiles.roleを照合する。
 * role が admin のユーザーだけ管理画面を使えるようにする準備。
 */
type AdminProfile = {
  id: string;
  clerk_user_id: string;
  role: 'admin' | 'patient';
  created_at: string;
  updated_at: string;
};

/**
 * GET /api/admin/me
 *
 * ログイン中のClerkユーザーと、Supabase profiles のroleを確認するAPI。
 *
 * 役割：
 * 1. Clerkの auth() からログイン中の userId を取得する
 * 2. profiles.clerk_user_id と照合する
 * 3. profile があれば role を返す
 * 4. profile がなければ、Supabaseに登録すべき clerkUserId を返す
 *
 * このAPIを使う理由：
 * - Clerkログインだけでは「管理者かどうか」は分からない
 * - Supabaseの profiles.role で admin / patient を管理するため
 * - まず自分の clerkUserId を確認し、SQL Editorで admin profile を作成する
 */
export async function GET() {
  try {
    /**
     * ClerkのログインユーザーIDを取得する。
     * 未ログインの場合、userId は null になる。
     */
    const { userId } = auth();

    if (!userId) {
      return NextResponse.json(
        {
          authenticated: false,
          clerkUserId: null,
          profile: null,
          isAdmin: false,
          message: 'Not signed in',
        },
        { status: 401 }
      );
    }

    /**
     * Supabase接続情報を取得する。
     * service_role key はサーバー側API Route内だけで使う。
     */
    const supabaseUrl = getRequiredEnv('NEXT_PUBLIC_SUPABASE_URL');
    const serviceRoleKey = getRequiredEnv('SUPABASE_SERVICE_ROLE_KEY');

    /**
     * 管理用Supabaseクライアント。
     * RLSの影響を受けずに profiles を確認するために使う。
     */
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

    /**
     * Clerk userId と profiles.clerk_user_id を照合する。
     */
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('id, clerk_user_id, role, created_at, updated_at')
      .eq('clerk_user_id', userId)
      .maybeSingle<AdminProfile>();

    if (profileError) {
      return NextResponse.json(
        {
          authenticated: true,
          clerkUserId: userId,
          profile: null,
          isAdmin: false,
          error: 'Failed to fetch profile',
          detail: profileError.message,
        },
        { status: 500 }
      );
    }

    /**
     * profile がない場合。
     * この時点ではClerkログインはできているが、Supabase側にrole登録がない。
     * 次の作業で、この clerkUserId を profiles に admin として登録する。
     */
    if (!profile) {
      return NextResponse.json({
        authenticated: true,
        clerkUserId: userId,
        profile: null,
        isAdmin: false,
        message: 'Profile not found. Create a profiles row with this clerkUserId.',
      });
    }

    return NextResponse.json({
      authenticated: true,
      clerkUserId: userId,
      profile,
      isAdmin: profile.role === 'admin',
    });
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      { error: 'Unexpected server error' },
      { status: 500 }
    );
  }
}
