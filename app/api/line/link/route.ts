import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

/**
 * LINE IDトークン検証APIのレスポンス型。
 *
 * sub：
 *   LINE userId
 *
 * name：
 *   LINE表示名
 *
 * picture：
 *   LINEプロフィール画像URL
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
 * 必須環境変数を取得する。
 * undefined の可能性をここで弾いて string に確定させる。
 */
function getRequiredEnv(key: string): string {
  const value = process.env[key];

  if (!value) {
    throw new Error(`${key} is not set`);
  }

  return value;
}

/**
 * LINE IDトークンを検証し、検証済みプロフィールを返す。
 *
 * フロントから lineUserId を直接受け取って信用するのではなく、
 * idToken をLINE公式APIで検証してから userId を使う。
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
 * POST /api/line/link
 *
 * 連携コードを使って、LINEアカウントと患者データを紐づける。
 *
 * 想定body：
 * {
 *   "idToken": "LINEのIDトークン",
 *   "linkCode": "患者ごとに発行した連携コード"
 * }
 */
export async function POST(request: Request) {
  try {
    const supabaseUrl = getRequiredEnv('NEXT_PUBLIC_SUPABASE_URL');
    const serviceRoleKey = getRequiredEnv('SUPABASE_SERVICE_ROLE_KEY');

    /**
     * service_role key を使う管理用Supabaseクライアント。
     * サーバー側API Route内だけで使う。
     */
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

    const body = await request.json();

    const idToken = body.idToken;
    const linkCode = body.linkCode;

    if (!idToken || typeof idToken !== 'string') {
      return NextResponse.json(
        { error: 'idToken is required' },
        { status: 400 }
      );
    }

    if (!linkCode || typeof linkCode !== 'string') {
      return NextResponse.json(
        { error: 'linkCode is required' },
        { status: 400 }
      );
    }

    /**
     * LINE IDトークンを検証して、本物のLINE userIdを取得する。
     */
    const lineProfile = await verifyLineIdToken(idToken);

    /**
     * 入力された連携コードに一致する患者を探す。
     *
     * 条件：
     * - line_link_code が一致
     * - まだ line_user_id が入っていない
     */
    const { data: patient, error: findError } = await supabaseAdmin
      .from('patients')
      .select(
        `
        id,
        name,
        line_user_id,
        line_link_code,
        line_link_code_expires_at
      `
      )
      .eq('line_link_code', linkCode.trim())
      .is('line_user_id', null)
      .maybeSingle();

    if (findError) {
      return NextResponse.json(
        {
          error: 'Failed to find patient by link code',
          detail: findError.message,
        },
        { status: 500 }
      );
    }

    if (!patient) {
      return NextResponse.json(
        { error: 'Invalid link code' },
        { status: 404 }
      );
    }

    /**
     * 有効期限チェック。
     * line_link_code_expires_at が null の場合は期限なしとして扱う。
     */
    if (patient.line_link_code_expires_at) {
      const expiresAt = new Date(patient.line_link_code_expires_at).getTime();
      const now = Date.now();

      if (expiresAt < now) {
        return NextResponse.json(
          { error: 'Link code has expired' },
          { status: 410 }
        );
      }
    }

    /**
     * 患者データにLINE情報を保存する。
     * 成功後はコードの再利用を防ぐため、line_link_code を null にする。
     */
    const { data: updatedPatient, error: updateError } = await supabaseAdmin
      .from('patients')
      .update({
        line_user_id: lineProfile.userId,
        line_display_name: lineProfile.displayName,
        line_picture_url: lineProfile.pictureUrl,
        line_linked_at: new Date().toISOString(),
        line_link_code: null,
        line_link_code_expires_at: null,
      })
      .eq('id', patient.id)
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
      .single();

    if (updateError) {
      return NextResponse.json(
        {
          error: 'Failed to link LINE account',
          detail: updateError.message,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      linked: true,
      patient: updatedPatient,
    });
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      { error: 'Unexpected server error' },
      { status: 500 }
    );
  }
}
