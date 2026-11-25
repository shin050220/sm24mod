export type RecordKind = 'match' | 'transfer' | 'stat' | 'standing'

export type FieldValue = string | number | null

export interface DataRecord {
  id: string
  kind: RecordKind
  createdAt: string
  data: Record<string, FieldValue>
}

export const ARTICLE_CATEGORIES = ['試合', '移籍', '成績', '順位', 'コラム', '速報'] as const
export type ArticleCategory = (typeof ARTICLE_CATEGORIES)[number]

export interface Article {
  id: string
  createdAt: string
  category: ArticleCategory
  headline: string
  subheadline: string
  body: string
  tags: string[]
  style: string
  sourceIds: string[]
}

export const MODELS = [
  { id: 'claude-opus-5-5', label: 'Claude Opus 5.5（高品質）' },
  { id: 'claude-sonnet-5-5', label: 'Claude Sonnet 5.5（バランス）' },
  { id: 'claude-haiku-5-5', label: 'Claude Haiku 5.5（安い・速い）' },
] as const

export type ArticleEngine = 'template' | 'ai'

export interface Settings {
  apiKey: string
  model: string
  /** 記事の作り方: テンプレ（無料）か AI か */
  engine: ArticleEngine
  /** データを追加したら自動で記事にする（テンプレ） */
  autoArticle: boolean
  myClub: string
  season: string
  paperName: string
}

export interface AppData {
  version: 1
  settings: Settings
  records: DataRecord[]
  articles: Article[]
}

export interface FieldDef {
  key: string
  label: string
  type: 'text' | 'number'
  placeholder?: string
  wide?: boolean
}

export const KIND_LABELS: Record<RecordKind, string> = {
  match: '試合',
  transfer: '移籍',
  stat: '選手成績',
  standing: '順位表',
}

export const FIELDS: Record<RecordKind, FieldDef[]> = {
  match: [
    { key: 'season', label: 'シーズン', type: 'text', placeholder: '2024/25' },
    { key: 'date', label: '日付', type: 'text', placeholder: '2024-08-17' },
    { key: 'competition', label: '大会', type: 'text', placeholder: 'プレミアリーグ' },
    { key: 'round', label: '節', type: 'text', placeholder: '第1節' },
    { key: 'home', label: 'ホーム', type: 'text' },
    { key: 'away', label: 'アウェー', type: 'text' },
    { key: 'homeScore', label: 'ホーム得点', type: 'number' },
    { key: 'awayScore', label: 'アウェー得点', type: 'number' },
    { key: 'scorers', label: '得点者', type: 'text', placeholder: "山田(ホーム)23', 佐藤(アウェー)67'", wide: true },
    { key: 'note', label: 'メモ', type: 'text', placeholder: 'MOM、退場者など', wide: true },
  ],
  transfer: [
    { key: 'season', label: 'シーズン', type: 'text', placeholder: '2024/25' },
    { key: 'date', label: '日付', type: 'text' },
    { key: 'player', label: '選手', type: 'text' },
    { key: 'position', label: 'ポジション', type: 'text', placeholder: 'FW' },
    { key: 'age', label: '年齢', type: 'number' },
    { key: 'from', label: '移籍元', type: 'text' },
    { key: 'to', label: '移籍先', type: 'text' },
    { key: 'fee', label: '移籍金', type: 'text', placeholder: '£45M / フリー' },
    { key: 'type', label: '形態', type: 'text', placeholder: '完全移籍 / レンタル / 契約延長' },
    { key: 'note', label: 'メモ', type: 'text', wide: true },
  ],
  stat: [
    { key: 'season', label: 'シーズン', type: 'text', placeholder: '2024/25' },
    { key: 'player', label: '選手', type: 'text' },
    { key: 'club', label: 'クラブ', type: 'text' },
    { key: 'position', label: 'ポジション', type: 'text' },
    { key: 'apps', label: '出場', type: 'number' },
    { key: 'goals', label: '得点', type: 'number' },
    { key: 'assists', label: 'アシスト', type: 'number' },
    { key: 'rating', label: '平均評価', type: 'number' },
    { key: 'note', label: 'メモ', type: 'text', wide: true },
  ],
  standing: [
    { key: 'season', label: 'シーズン', type: 'text', placeholder: '2024/25' },
    { key: 'competition', label: '大会', type: 'text' },
    { key: 'rank', label: '順位', type: 'number' },
    { key: 'club', label: 'クラブ', type: 'text' },
    { key: 'played', label: '試合', type: 'number' },
    { key: 'won', label: '勝', type: 'number' },
    { key: 'drawn', label: '分', type: 'number' },
    { key: 'lost', label: '敗', type: 'number' },
    { key: 'gf', label: '得点', type: 'number' },
    { key: 'ga', label: '失点', type: 'number' },
    { key: 'points', label: '勝点', type: 'number' },
  ],
}

/** 同じ内容を二重登録しないための識別キー。成績と順位は同じキーなら最新値で上書きする。 */
export function recordKey(r: { kind: RecordKind; data: Record<string, FieldValue> }): string {
  const d = r.data
  const s = (k: string) => String(d[k] ?? '').trim().toLowerCase()
  switch (r.kind) {
    case 'match':
      return ['match', s('season'), s('competition'), s('round') || s('date'), s('home'), s('away')].join('|')
    case 'transfer':
      return ['transfer', s('season'), s('player'), s('from'), s('to')].join('|')
    case 'stat':
      return ['stat', s('season'), s('player'), s('club')].join('|')
    case 'standing':
      return ['standing', s('season'), s('competition'), s('club')].join('|')
  }
}

export function summarize(r: DataRecord): string {
  const d = r.data
  const v = (k: string) => (d[k] === null || d[k] === undefined || d[k] === '' ? '' : String(d[k]))
  switch (r.kind) {
    case 'match':
      return `${v('round') || v('date')} ${v('home')} ${v('homeScore')}-${v('awayScore')} ${v('away')}`.trim()
    case 'transfer':
      return `${v('player')}：${v('from') || '?'} → ${v('to') || '?'}${v('fee') ? `（${v('fee')}）` : ''}`
    case 'stat':
      return `${v('player')}（${v('club')}）${v('apps') || 0}試合 ${v('goals') || 0}G ${v('assists') || 0}A${v('rating') ? ` 評価${v('rating')}` : ''}`
    case 'standing':
      return `${v('competition')} ${v('rank')}位 ${v('club')} 勝点${v('points')}`
  }
}

export type NewArticle = Omit<Article, 'id' | 'createdAt'>

const norm = (s: unknown) => String(s ?? '').trim().toLowerCase()

/** クラブ名が自分のクラブかどうか（表記ゆれを少し許す） */
export function isMyClub(name: unknown, myClub: string): boolean {
  const a = norm(name)
  const b = norm(myClub)
  if (!a || !b) return false
  if (a === b) return true
  return b.length >= 3 && (a.includes(b) || b.includes(a))
}
