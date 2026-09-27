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

type ProductRow = {
  id: string;
  name: string;
  category: string;
  description: string | null;
  product_url: string | null;
};

type ProgramRow = {
  id: string;
  summary: string | null;
};

type RecommendationRow = {
  id: string;
  program_id: string | null;
  product_id: string | null;
  category: string | null;
  reason: string | null;
  status: string;
  created_at: string;
  updated_at: string;
};

const rentalStatuses = ['rental_requested', 'renting', 'rental_returned'];

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

function uniq(values: Array<string | null>) {
  return Array.from(new Set(values.filter(Boolean))) as string[];
}

function attachRecommendationDetails(
  recommendations: RecommendationRow[] | null,
  products: ProductRow[] | null,
  programs: ProgramRow[] | null
) {
  const productMap = new Map((products ?? []).map((product) => [product.id, product]));
  const programMap = new Map((programs ?? []).map((program) => [program.id, program]));

  return (recommendations ?? []).map((recommendation) => {
    const product = recommendation.product_id
      ? productMap.get(recommendation.product_id) ?? null
      : null;
    const program = recommendation.program_id
      ? programMap.get(recommendation.program_id) ?? null
      : null;

    return {
      ...recommendation,
      product,
      program,
    };
  });
}

/**
 * POST /api/patient/dashboard
 *
 * 患者側ダッシュボードに表示するための情報を取得するAPI。
 *
 * LINE IDトークンを検証し、patients.line_user_id から本人の患者データを取得する。
 *
 * 返却するもの：
 * - 患者基本情報
 * - 最新の改善プログラム1件
 * - 現在のプラン
 * - 商品提案
 * - 直近通院履歴
 * - レンタル履歴
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

    const [
      programResult,
      planResult,
      recommendationsResult,
      visitsResult,
      rentalsResult,
    ] = await Promise.all([
      supabaseAdmin
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
        .maybeSingle(),
      supabaseAdmin
        .from('plans')
        .select(
          `
          id,
          type,
          name,
          total_count,
          remaining_count,
          start_date,
          end_date,
          status,
          created_at
        `
        )
        .eq('patient_id', patient.id)
        .eq('status', 'active')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabaseAdmin
        .from('patient_product_recommendations')
        .select(
          `
          id,
          program_id,
          product_id,
          category,
          reason,
          status,
          created_at,
          updated_at
        `
        )
        .eq('patient_id', patient.id)
        .order('updated_at', { ascending: false })
        .limit(6),
      supabaseAdmin
        .from('visits')
        .select(
          `
          id,
          visit_date,
          note,
          created_at,
          updated_at
        `
        )
        .eq('patient_id', patient.id)
        .order('visit_date', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(3),
      supabaseAdmin
        .from('patient_product_recommendations')
        .select(
          `
          id,
          program_id,
          product_id,
          category,
          reason,
          status,
          created_at,
          updated_at
        `
        )
        .eq('patient_id', patient.id)
        .in('status', rentalStatuses)
        .order('updated_at', { ascending: false })
        .limit(5),
    ]);

    if (programResult.error) {
      return NextResponse.json(
        {
          error: 'Failed to fetch current program',
          detail: programResult.error.message,
        },
        { status: 500 }
      );
    }

    if (planResult.error) {
      return NextResponse.json(
        {
          error: 'Failed to fetch current plan',
          detail: planResult.error.message,
        },
        { status: 500 }
      );
    }

    if (recommendationsResult.error) {
      return NextResponse.json(
        {
          error: 'Failed to fetch product recommendations',
          detail: recommendationsResult.error.message,
        },
        { status: 500 }
      );
    }

    if (visitsResult.error) {
      return NextResponse.json(
        {
          error: 'Failed to fetch recent visits',
          detail: visitsResult.error.message,
        },
        { status: 500 }
      );
    }

    if (rentalsResult.error) {
      return NextResponse.json(
        {
          error: 'Failed to fetch rentals',
          detail: rentalsResult.error.message,
        },
        { status: 500 }
      );
    }

    const allRecommendations = [
      ...((recommendationsResult.data ?? []) as RecommendationRow[]),
      ...((rentalsResult.data ?? []) as RecommendationRow[]),
    ];
    const productIds = uniq(allRecommendations.map((recommendation) => recommendation.product_id));
    const programIds = uniq(allRecommendations.map((recommendation) => recommendation.program_id));

    const [productsResult, programsResult] = await Promise.all([
      productIds.length > 0
        ? supabaseAdmin
            .from('products')
            .select('id, name, category, description, product_url')
            .in('id', productIds)
        : Promise.resolve({ data: [] as ProductRow[], error: null }),
      programIds.length > 0
        ? supabaseAdmin
            .from('programs')
            .select('id, summary')
            .in('id', programIds)
        : Promise.resolve({ data: [] as ProgramRow[], error: null }),
    ]);

    if (productsResult.error) {
      return NextResponse.json(
        {
          error: 'Failed to fetch recommendation products',
          detail: productsResult.error.message,
        },
        { status: 500 }
      );
    }

    if (programsResult.error) {
      return NextResponse.json(
        {
          error: 'Failed to fetch recommendation programs',
          detail: programsResult.error.message,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      lineProfile,
      patient,
      currentProgram: programResult.data,
      currentPlan: planResult.data,
      recommendations: attachRecommendationDetails(
        recommendationsResult.data as RecommendationRow[] | null,
        productsResult.data as ProductRow[] | null,
        programsResult.data as ProgramRow[] | null
      ),
      recentVisits: visitsResult.data ?? [],
      rentals: attachRecommendationDetails(
        rentalsResult.data as RecommendationRow[] | null,
        productsResult.data as ProductRow[] | null,
        programsResult.data as ProgramRow[] | null
      ),
    });
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      {
        error: 'Unexpected server error',
        detail: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
