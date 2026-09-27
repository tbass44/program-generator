import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

/**
 * LINEのIDトークン検証APIから返ってくるレスポンス型。
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

type PatientDashboardRequestBody = {
  idToken?: unknown;
};

/**
 * 必須環境変数を取得するための関数。
 *
 * process.env は TypeScript上では string | undefined になるため、
 * ここで undefined を弾いて string として扱えるようにする。
 */
function getRequiredEnv(key: string): string {
  const value = process.env[key];

  if (!value) {
    throw new Error(`${key} is not set`);
  }

  return value;
}

/**
 * LINE IDトークンをLINE公式APIで検証する。
 *
 * フロント側からLINE userIdを直接受け取るのではなく、
 * LIFFのidTokenを検証して、信頼できるLINE userIdを取得する。
 */
async function verifyLineIdToken(idToken: string): Promise<{
  userId: string;
  displayName: string | null;
  pictureUrl: string | null;
}> {
  const lineChannelId = getRequiredEnv('LINE_CHANNEL_ID');

  const params = new URLSearchParams();
  params.append('id_token', idToken);
  params.append('client_id', lineChannelId);

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

  if (!verifyResponse.ok || !verifyData.sub) {
    throw new Error('Failed to verify LINE id token');
  }

  return {
    userId: verifyData.sub,
    displayName: verifyData.name ?? null,
    pictureUrl: verifyData.picture ?? null,
  };
}

/**
 * POST /api/patient/dashboard
 *
 * 患者側ダッシュボードに表示するための情報を取得するAPI。
 *
 * 以前は /api/patient/dashboard?patientId=xxx のように患者IDを直接受け取っていたが、
 * STEP12ではLINE IDトークンを検証し、patients.line_user_id から本人の患者データを取得する。
 *
 * 現時点のMVPでは、以下を返す。
 * - 患者基本情報
 * - 最新の改善プログラム1件
 *
 * 今後の拡張予定：
 * - 現在のプラン
 * - 商品サポート提案
 * - 通院履歴
 * をこのAPIに追加していく。
 *
 * 注意：
 * service_role key を使うため、この処理はサーバー側だけで実行する。
 * ブラウザ側に service_role key を出してはいけない。
 */
export async function POST(request: Request) {
  try {
    const body = (await request.json()) as PatientDashboardRequestBody;
    const idToken = body.idToken;

    if (!idToken || typeof idToken !== 'string') {
      return NextResponse.json(
        { error: 'idToken is required' },
        { status: 400 }
      );
    }

    /**
     * LINE IDトークンを検証して、本人のLINE userIdを取得する。
     */
    const lineProfile = await verifyLineIdToken(idToken);

    /**
     * APIが呼ばれたタイミングで環境変数を読む。
     * build時にトップレベルで環境変数チェックを走らせないため。
     */
    const supabaseUrl = getRequiredEnv('NEXT_PUBLIC_SUPABASE_URL');
    const serviceRoleKey = getRequiredEnv('SUPABASE_SERVICE_ROLE_KEY');

    /**
     * 管理用Supabaseクライアント。
     * RLSの影響を受けずにサーバー側から必要な患者情報を取得する。
     */
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

    /**
     * 検証済みLINE userIdに紐づく患者基本情報を取得する。
     */
    const { data: patient, error: patientError } = await supabaseAdmin
      .from('patients')
      .select(
        `
        id,
        name,
        memo,
        line_user_id,
        line_display_name,
        line_picture_url,
        line_linked_at
      `
      )
      .eq('line_user_id', lineProfile.userId)
      .maybeSingle();

    if (patientError) {
      return NextResponse.json(
        {
          error: 'Failed to fetch patient',
          detail: patientError.message,
        },
        { status: 500 }
      );
    }

    if (!patient) {
      return NextResponse.json(
        {
          error: 'Patient not linked',
          detail: 'このLINEアカウントに紐づく患者データがありません。',
          lineProfile,
        },
        { status: 404 }
      );
    }

    /**
     * 最新の改善プログラムを1件取得する。
     * 患者側ダッシュボードの「現在の改善プログラム」に表示する。
     *
     * created_at の降順で1件だけ取得することで、直近作成されたプログラムを表示する。
     */
    const { data: currentProgram, error: programError } = await supabaseAdmin
      .from('programs')
      .select(
        `
        id,
        summary,
        short_term_program,
        long_term_program,
        today_task,
        created_at
      `
      )
      .eq('patient_id', patient.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (programError) {
      return NextResponse.json(
        {
          error: 'Failed to fetch current program',
          detail: programError.message,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      lineProfile,
      patient,
      currentProgram,
    });
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      { error: 'Unexpected server error' },
      { status: 500 }
    );
  }
}
