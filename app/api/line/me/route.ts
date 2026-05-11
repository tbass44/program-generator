import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

/**
 * LINEのIDトークン検証APIから返ってくるレスポンス型。
 *
 * 正常時：
 * - sub: LINE userId
 * - name: LINE表示名
 * - picture: LINEプロフィール画像URL
 *
 * 異常時：
 * - error
 * - error_description
 */
type LineVerifyResponse = {
  iss?: string;
  sub?: string;
  aud?: string;
  exp?: number;
  iat?: number;
  name?: string;
  picture?: string;
  error?: string;
  error_description?: string;
};

/**
 * 環境変数
 *
 * NEXT_PUBLIC_SUPABASE_URL：
 *   SupabaseプロジェクトURL。
 *   例：https://xxxxx.supabase.co
 *
 * SUPABASE_SERVICE_ROLE_KEY：
 *   Supabaseのservice_roleキー。
 *   RLSを回避してサーバー側から患者データを検索するために使う。
 *   絶対にブラウザへ出してはいけない。
 *
 * LINE_CHANNEL_ID：
 *   LINE LoginチャネルのChannel ID。
 *   Messaging APIチャネルではなく、LIFFを作成したLINE LoginチャネルのID。
 */
/**
 * 必須の環境変数を取得する関数。
 *
 * process.env の値は TypeScript上では string | undefined になるため、
 * ここで undefined を弾いて、戻り値を string に確定させる。
 */
function getRequiredEnv(key: string): string {
  const value = process.env[key];

  if (!value) {
    throw new Error(`${key} is not set`);
  }

  return value;
}

const supabaseUrl = getRequiredEnv('NEXT_PUBLIC_SUPABASE_URL');
const serviceRoleKey = getRequiredEnv('SUPABASE_SERVICE_ROLE_KEY');
const lineChannelId = getRequiredEnv('LINE_CHANNEL_ID');

/**
 * 管理用Supabaseクライアント。
 *
 * service_role keyを使うため、サーバー側でのみ使う。
 * このファイルは API Route なのでブラウザには送られない。
 *
 * 用途：
 * - patients.line_user_id を検索する
 * - 将来的にはLINE連携情報の保存にも使う
 */
const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

/**
 * POST /api/line/me
 *
 * 役割：
 * 1. フロント側のLIFFから idToken を受け取る
 * 2. LINEの検証APIに idToken を渡して、本物か確認する
 * 3. 検証済みのLINE userIdを取得する
 * 4. patients.line_user_id と照合する
 * 5. 紐づけ済みなら patient を返す
 * 6. 未紐づけなら linked: false を返す
 *
 * 重要：
 * LINE userIdだけをフロントから受け取って信用するのは危険。
 * 必ず idToken をサーバー側で検証してから使う。
 */
export async function POST(request: Request) {
  try {
    /**
     * フロントから送られてくるJSONを取得。
     *
     * 想定body：
     * {
     *   "idToken": "xxxxx"
     * }
     */
    const body = await request.json();
    const idToken = body.idToken;

    /**
     * idTokenがない場合は不正なリクエスト。
     */
    if (!idToken || typeof idToken !== 'string') {
      return NextResponse.json(
        { error: 'idToken is required' },
        { status: 400 }
      );
    }

    /**
     * LINEのIDトークン検証APIへ送るパラメータ。
     *
     * id_token：
     *   LIFFの liff.getIDToken() で取得したトークン
     *
     * client_id：
     *   LINE LoginチャネルのChannel ID
     */
    const params = new URLSearchParams();
    params.append('id_token', idToken);
    params.append('client_id', lineChannelId);

    /**
     * LINE公式のIDトークン検証APIに問い合わせる。
     *
     * 成功すると、LINE userId が sub に入って返る。
     */
    const verifyResponse = await fetch(
      'https://api.line.me/oauth2/v2.1/verify',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: params,
      }
    );

    const verifyData = (await verifyResponse.json()) as LineVerifyResponse;

    /**
     * 検証に失敗した場合。
     *
     * 例：
     * - idTokenが不正
     * - LINE_CHANNEL_IDが違う
     * - 期限切れ
     */
    if (!verifyResponse.ok || !verifyData.sub) {
      return NextResponse.json(
        {
          error: 'Failed to verify LINE id token',
          detail: verifyData,
        },
        { status: 401 }
      );
    }

    /**
     * LINE検証済みの userId。
     * これを patients.line_user_id と照合する。
     */
    const lineUserId = verifyData.sub;

    /**
     * patientsテーブルから、LINE userId が一致する患者を探す。
     *
     * maybeSingle()：
     * - 1件あればそのデータ
     * - 0件なら null
     * - 複数件ならエラー
     *
     * line_user_id には unique を付けているので、本来は複数件にならない。
     */
    const { data: patient, error: patientError } = await supabaseAdmin
      .from('patients')
      .select(
        `
        id,
        name,
        line_user_id,
        line_display_name,
        line_picture_url,
        line_linked_at
      `
      )
      .eq('line_user_id', lineUserId)
      .maybeSingle();

    /**
     * Supabase検索自体に失敗した場合。
     */
    if (patientError) {
      return NextResponse.json(
        {
          error: 'Failed to fetch patient',
          detail: patientError.message,
        },
        { status: 500 }
      );
    }

    /**
     * 正常レスポンス。
     *
     * linked:
     * - true：patients.line_user_id に一致する患者がいる
     * - false：まだ患者データとLINEが紐づいていない
     *
     * patient:
     * - linked true の場合は患者データ
     * - linked false の場合は null
     */
    return NextResponse.json({
      lineProfile: {
        userId: lineUserId,
        displayName: verifyData.name ?? null,
        pictureUrl: verifyData.picture ?? null,
      },
      linked: Boolean(patient),
      patient,
    });
  } catch (error) {
    /**
     * 想定外のエラー。
     * 詳細はサーバーログに出す。
     */
    console.error(error);

    return NextResponse.json(
      { error: 'Unexpected server error' },
      { status: 500 }
    );
  }
}
