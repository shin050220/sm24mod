import Anthropic from '@anthropic-ai/sdk'
import { betaZodOutputFormat } from '@anthropic-ai/sdk/helpers/beta/zod'
import { z } from 'zod'
import {
  ARTICLE_CATEGORIES,
  summarize,
  type Article,
  type ArticleCategory,
  type DataRecord,
  type FieldValue,
  type RecordKind,
  type Settings,
} from './types'

function client(settings: Settings) {
  if (!settings.apiKey.trim()) throw new Error('設定画面で Claude の API キーを入力してください。')
  // 個人用アプリなのでキーはこの端末のブラウザにだけ保存し、ブラウザから直接 API を呼ぶ
  return new Anthropic({ apiKey: settings.apiKey.trim(), dangerouslyAllowBrowser: true })
}

/** 安全判定で断られたときに別モデルへ自動で切り替える設定（サーバー側フォールバック） */
const FALLBACK = {
  betas: ['server-side-fallback-2026-07-01'],
  fallbacks: 'default' as const,
}

export function describeError(e: unknown): string {
  if (e instanceof Anthropic.AuthenticationError) return 'API キーが正しくありません。設定を確認してください。'
  if (e instanceof Anthropic.PermissionDeniedError) return 'この API キーでは利用できません（権限エラー）。'
  if (e instanceof Anthropic.RateLimitError) return 'リクエストが多すぎます。少し待ってからもう一度試してください。'
  if (e instanceof Anthropic.BadRequestError) return `リクエストエラー: ${e.message}`
  if (e instanceof Anthropic.APIConnectionError) return '通信に失敗しました。ネット接続を確認してください。'
  if (e instanceof Anthropic.APIError) return `API エラー (${e.status ?? '?'}): ${e.message}`
  if (e instanceof Error) return e.message
  return String(e)
}

// ---------- スクリーンショットの読み取り ----------

const str = z.string().nullable()
const num = z.number().nullable()

const ExtractSchema = z.object({
  screenDescription: z.string().describe('画像がどの画面か（例: 試合結果、移籍履歴、選手成績、リーグ順位表）'),
  matches: z.array(
    z.object({
      season: str, date: str, competition: str, round: str,
      home: z.string(), away: z.string(), homeScore: num, awayScore: num,
      scorers: str.describe("得点者。例: 山田(ホーム)23', 佐藤(アウェー)67'"),
      note: str,
    }),
  ),
  transfers: z.array(
    z.object({
      season: str, date: str, player: z.string(), position: str, age: num,
      from: str, to: str, fee: str, type: str.describe('完全移籍 / レンタル / フリー / 契約延長 など'),
      note: str,
    }),
  ),
  playerStats: z.array(
    z.object({
      season: str, player: z.string(), club: str, position: str,
      apps: num, goals: num, assists: num, rating: num, note: str,
    }),
  ),
  standings: z.array(
    z.object({
      season: str, competition: str, rank: num, club: z.string(),
      played: num, won: num, drawn: num, lost: num, gf: num, ga: num, points: num,
    }),
  ),
})

export interface ExtractedItem {
  kind: RecordKind
  data: Record<string, FieldValue>
}

export interface ImageInput {
  mediaType: 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif'
  base64: string
}

const EXTRACT_SYSTEM = `あなたはスマホゲーム「Soccer Manager 2024」(SM24) のスクリーンショットからデータを読み取る担当です。
- 画像に実際に写っている情報だけを読み取り、推測で値を作らないでください。読めない項目は null にします。
- 画面の種類に合う配列だけに入れ、関係ない配列は空配列にします。
- 選手名・クラブ名・大会名は画面の表記どおりに書きます（英語表記なら英語のまま）。
- 金額は画面の表記どおり（例: £45M, €12.5M）。
- 順位表は写っている全クラブを読み取ります。選手成績も写っている全選手を読み取ります。
- 同じ情報が複数の画像に重複して写っていても一度だけ出力します。`

export async function extractFromImages(
  settings: Settings,
  images: ImageInput[],
  hint: string,
): Promise<{ description: string; items: ExtractedItem[] }> {
  const c = client(settings)
  const context = [
    settings.myClub && `ユーザーが監督しているクラブ: ${settings.myClub}`,
    settings.season && `現在のシーズン: ${settings.season}（画面にシーズンが無い場合はこれを使う）`,
    hint && `ユーザーからの補足: ${hint}`,
  ]
    .filter(Boolean)
    .join('\n')

  const response = await c.beta.messages.parse({
    model: settings.model,
    max_tokens: 16000,
    ...FALLBACK,
    output_config: { effort: 'medium', format: betaZodOutputFormat(ExtractSchema) },
    system: EXTRACT_SYSTEM,
    messages: [
      {
        role: 'user',
        content: [
          ...images.map((img) => ({
            type: 'image' as const,
            source: { type: 'base64' as const, media_type: img.mediaType, data: img.base64 },
          })),
          { type: 'text' as const, text: `${context}\n\nこれらのスクリーンショットからデータを読み取ってください。` },
        ],
      },
    ],
  })

  if (response.stop_reason === 'refusal') throw new Error('この画像は読み取れませんでした（AI が処理を断りました）。')
  if (response.stop_reason === 'max_tokens') throw new Error('画像の情報量が多すぎて途中で切れました。枚数を減らしてください。')
  const out = response.parsed_output
  if (!out) throw new Error('読み取り結果を解析できませんでした。もう一度試してください。')

  const fillSeason = <T extends { season: string | null }>(x: T) => ({ ...x, season: x.season || settings.season || null })
  const items: ExtractedItem[] = [
    ...out.matches.map((m) => ({ kind: 'match' as const, data: fillSeason(m) })),
    ...out.transfers.map((t) => ({ kind: 'transfer' as const, data: fillSeason(t) })),
    ...out.playerStats.map((s) => ({ kind: 'stat' as const, data: fillSeason(s) })),
    ...out.standings.map((s) => ({ kind: 'standing' as const, data: fillSeason(s) })),
  ]
  return { description: out.screenDescription, items }
}

// ---------- 記事の作成 ----------

export const STYLES = [
  { id: 'sports', label: 'スポーツ紙', prompt: '日本のスポーツ新聞風。見出しは大きく派手に、体言止めや「！」も使い、熱量のある文体。' },
  { id: 'general', label: '一般紙', prompt: '一般紙のスポーツ面風。落ち着いた客観的な報道文体。' },
  { id: 'foreign', label: '海外メディア風', prompt: '英国のサッカー専門メディアを日本語訳したような文体。戦術や数字に触れ、皮肉も少し効かせる。' },
  { id: 'breaking', label: '速報', prompt: 'ネットニュースの速報風。短く要点を先に、箇条書きも可。' },
  { id: 'column', label: '辛口コラム', prompt: 'ベテラン記者の辛口コラム。監督の采配やクラブの方針に鋭く切り込む。' },
] as const

export const LENGTHS = [
  { id: 'short', label: '短め', prompt: '本文は各200〜300字程度。' },
  { id: 'normal', label: '普通', prompt: '本文は各400〜700字程度。' },
  { id: 'long', label: '長め', prompt: '本文は各900〜1400字程度。' },
] as const

const ArticlesSchema = z.object({
  articles: z.array(
    z.object({
      category: z.enum(ARTICLE_CATEGORIES),
      headline: z.string(),
      subheadline: z.string(),
      body: z.string().describe('本文。段落は改行2つで区切る'),
      tags: z.array(z.string()),
      sourceNumbers: z.array(z.number().int()).describe('この記事が使ったデータの番号'),
    }),
  ),
})

export interface WriteOptions {
  styleId: string
  lengthId: string
  mode: 'single' | 'multi'
  allowQuotes: boolean
  instructions: string
}

export async function writeArticles(
  settings: Settings,
  selected: DataRecord[],
  context: { recentHeadlines: string[]; standings: DataRecord[] },
  opts: WriteOptions,
): Promise<Omit<Article, 'id' | 'createdAt'>[]> {
  const c = client(settings)
  const style = STYLES.find((s) => s.id === opts.styleId) ?? STYLES[0]
  const length = LENGTHS.find((l) => l.id === opts.lengthId) ?? LENGTHS[1]

  const system = `あなたは新聞「${settings.paperName || 'SM24 スポーツ'}」の記者です。ユーザーがスマホゲーム「Soccer Manager 2024」で進めているキャリアの出来事を、本物のサッカーニュースのような記事にします。
ルール:
- 事実（スコア、得点者、移籍金、成績の数字、順位）は渡されたデータだけを使い、データに無い数字や出来事を作らない。
- 文脈や盛り上げ（意味づけ、展望、雰囲気の描写）は自由に書いてよい。
- ${opts.allowQuotes ? '談話を入れてもよいが、話し手は「クラブ関係者」「サポーター」「監督（ユーザー本人）」など匿名または架空の人物に限る。実在の選手や人物の発言は作らない。' : '談話（カギカッコの発言）は入れない。'}
- 文体: ${style.prompt}
- ${length.prompt}
- 見出しは30字以内、サブ見出しは50字以内。
- 日本語で書く。選手名・クラブ名はデータの表記をそのまま使ってよいが、日本で一般的なカタカナ表記があればそちらを使う。
- sourceNumbers には、その記事で使ったデータの番号をすべて入れる。`

  const lines = selected.map((r, i) => `[${i + 1}] (${r.kind}) ${summarize(r)} :: ${JSON.stringify(r.data)}`)
  const standingLines = context.standings.map((r) => `- ${summarize(r)}`)
  const user = [
    settings.myClub && `ユーザーが監督しているクラブ: ${settings.myClub}`,
    settings.season && `現在のシーズン: ${settings.season}`,
    `記事にするデータ:\n${lines.join('\n')}`,
    standingLines.length > 0 && `参考: 最新の順位表\n${standingLines.join('\n')}`,
    context.recentHeadlines.length > 0 &&
      `最近掲載した見出し（同じ言い回しを避ける）:\n${context.recentHeadlines.map((h) => `- ${h}`).join('\n')}`,
    opts.mode === 'single'
      ? 'これらのデータをまとめて記事を1本書いてください。'
      : 'これらのデータから、ニュース価値の高い順に記事を書いてください。同じ話題はまとめ、話題ごとに1本、最大6本まで。小さな話題は「ニュースまとめ」として1本にまとめてもよい。',
    opts.instructions && `ユーザーからの追加リクエスト: ${opts.instructions}`,
  ]
    .filter(Boolean)
    .join('\n\n')

  const response = await c.beta.messages.parse({
    model: settings.model,
    max_tokens: 16000,
    ...FALLBACK,
    output_config: { effort: 'medium', format: betaZodOutputFormat(ArticlesSchema) },
    system,
    messages: [{ role: 'user', content: user }],
  })

  if (response.stop_reason === 'refusal') throw new Error('記事を作成できませんでした（AI が処理を断りました）。')
  if (response.stop_reason === 'max_tokens') throw new Error('記事が長すぎて途中で切れました。データを減らすか「短め」にしてください。')
  const out = response.parsed_output
  if (!out) throw new Error('記事の結果を解析できませんでした。もう一度試してください。')

  return out.articles.map((a) => ({
    category: a.category as ArticleCategory,
    headline: a.headline,
    subheadline: a.subheadline,
    body: a.body,
    tags: a.tags,
    style: style.label,
    sourceIds: a.sourceNumbers.map((n) => selected[n - 1]?.id).filter((x): x is string => Boolean(x)),
  }))
}

// ---------- 画像の縮小（通信量と料金を抑える） ----------

export async function fileToImageInput(file: File): Promise<ImageInput> {
  const bitmap = await createImageBitmap(file)
  const maxEdge = 1568
  const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(bitmap.width * scale)
  canvas.height = Math.round(bitmap.height * scale)
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('画像を処理できませんでした。')
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  bitmap.close()
  const dataUrl = canvas.toDataURL('image/jpeg', 0.88)
  return { mediaType: 'image/jpeg', base64: dataUrl.slice(dataUrl.indexOf(',') + 1) }
}
