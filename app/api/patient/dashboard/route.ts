import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

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
 * GET /api/patient/dashboard?patientId=xxx
 *
 * 患者側ダッシュボードに表示するための患者基本情報を取得するAPI。
 *
 * 現時点のMVPでは、まず /line から渡された patientId を使って
 * 患者名を実データ表示するところまでを目的にする。
 *
 * 今後の拡張予定：
 * - 現在の改善プログラム
 * - 現在のプラン
 * - 商品サポート提案
 * - 通院履歴
 * をこのAPIに追加していく。
 *
 * 注意：
 * service_role key を使うため、この処理はサーバー側だけで実行する。
 * ブラウザ側に service_role key を出してはいけない。
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const patientId = searchParams.get('patientId');

    /**
     * patientId がない場合は、患者を特定できないため400を返す。
     */
    if (!patientId) {
      return NextResponse.json(
        { error: 'patientId is required' },
        { status: 400 }
      );
    }

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
     * 患者基本情報を取得する。
     * まずはダッシュボードの見出しに使う name を中心に取得する。
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
      .eq('id', patientId)
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
        { error: 'Patient not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ patient });
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      { error: 'Unexpected server error' },
      { status: 500 }
    );
  }
}
