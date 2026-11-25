import { useCallback, useEffect, useState } from 'react'
import { recordKey, type AppData, type DataRecord, type RecordKind, type FieldValue } from './types'

const STORAGE_KEY = 'sm24news:v1'

export const DEFAULT_DATA: AppData = {
  version: 1,
  settings: {
    apiKey: '',
    model: 'claude-opus-5-5',
    engine: 'template',
    autoArticle: true,
    myClub: '',
    season: '2024/25',
    paperName: 'SM24 スポーツ',
  },
  records: [],
  articles: [],
}

export function newId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID()
  return Math.random().toString(36).slice(2) + Date.now().toString(36)
}

function load(): AppData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return DEFAULT_DATA
    return normalize(JSON.parse(raw))
  } catch {
    return DEFAULT_DATA
  }
}

/** バックアップ読み込みや古い保存データでも壊れないように形を整える */
export function normalize(input: unknown): AppData {
  const o = (input ?? {}) as Partial<AppData>
  return {
    version: 1,
    settings: { ...DEFAULT_DATA.settings, ...(o.settings ?? {}) },
    records: Array.isArray(o.records) ? o.records : [],
    articles: Array.isArray(o.articles) ? o.articles : [],
  }
}

export interface UpsertResult {
  added: number
  updated: number
  skipped: number
}

/** 新しいレコードを取り込む。試合・移籍は重複をスキップ、成績・順位は最新値で上書き。 */
export function upsertRecords(
  existing: DataRecord[],
  incoming: { kind: RecordKind; data: Record<string, FieldValue> }[],
): { records: DataRecord[]; result: UpsertResult; touched: DataRecord[] } {
  const records = [...existing]
  const index = new Map(records.map((r, i) => [recordKey(r), i]))
  const result: UpsertResult = { added: 0, updated: 0, skipped: 0 }
  const touched: number[] = []
  const now = new Date().toISOString()
  for (const item of incoming) {
    const key = recordKey(item)
    const at = index.get(key)
    if (at === undefined) {
      records.push({ id: newId(), kind: item.kind, createdAt: now, data: item.data })
      index.set(key, records.length - 1)
      touched.push(records.length - 1)
      result.added++
    } else if (item.kind === 'stat' || item.kind === 'standing') {
      records[at] = { ...records[at], data: { ...records[at].data, ...item.data } }
      touched.push(at)
      result.updated++
    } else {
      result.skipped++
    }
  }
  return { records, result, touched: [...new Set(touched)].map((i) => records[i]) }
}

export function useAppData() {
  const [data, setData] = useState<AppData>(load)
  const [saveError, setSaveError] = useState<string | null>(null)

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
      setSaveError(null)
    } catch {
      setSaveError('ブラウザへの保存に失敗しました。容量不足かプライベートモードの可能性があります。バックアップを書き出してください。')
    }
  }, [data])

  const update = useCallback((fn: (d: AppData) => AppData) => setData((d) => fn(d)), [])
  return { data, update, saveError }
}
