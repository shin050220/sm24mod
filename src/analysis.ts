import { isMyClub, type DataRecord } from './types'

export type Outcome = 'W' | 'D' | 'L'

export interface MyMatch {
  record: DataRecord
  home: boolean
  opponent: string
  my: number
  opp: number
  outcome: Outcome
}

const num = (v: unknown) => (v === null || v === undefined || v === '' ? null : Number(v))

/** 自分のクラブの試合（スコアがあるもの）を登録順に返す */
export function myMatches(records: DataRecord[], myClub: string, season?: string): MyMatch[] {
  const out: MyMatch[] = []
  for (const r of records) {
    if (r.kind !== 'match') continue
    if (season && r.data.season && r.data.season !== season) continue
    const hs = num(r.data.homeScore)
    const as = num(r.data.awayScore)
    if (hs === null || as === null) continue
    const home = isMyClub(r.data.home, myClub)
    const away = isMyClub(r.data.away, myClub)
    if (!home && !away) continue
    const my = home ? hs : as
    const opp = home ? as : hs
    out.push({
      record: r,
      home,
      opponent: String(home ? r.data.away : r.data.home),
      my,
      opp,
      outcome: my > opp ? 'W' : my === opp ? 'D' : 'L',
    })
  }
  return out
}

export interface SeasonSummary {
  played: number
  won: number
  drawn: number
  lost: number
  gf: number
  ga: number
  points: number
  form: Outcome[]
  /** 現在の連続記録（例: 3連勝、5戦無敗） */
  streak: { kind: 'win' | 'unbeaten' | 'lose' | 'winless'; count: number } | null
}

export function summarizeSeason(matches: MyMatch[]): SeasonSummary {
  const s: SeasonSummary = { played: 0, won: 0, drawn: 0, lost: 0, gf: 0, ga: 0, points: 0, form: [], streak: null }
  for (const m of matches) {
    s.played++
    s.gf += m.my
    s.ga += m.opp
    if (m.outcome === 'W') s.won++
    else if (m.outcome === 'D') s.drawn++
    else s.lost++
  }
  s.points = s.won * 3 + s.drawn
  s.form = matches.slice(-5).map((m) => m.outcome)
  const rev = [...matches].reverse().map((m) => m.outcome)
  const run = (pred: (o: Outcome) => boolean) => {
    let n = 0
    for (const o of rev) {
      if (!pred(o)) break
      n++
    }
    return n
  }
  const wins = run((o) => o === 'W')
  const unbeaten = run((o) => o !== 'L')
  const loses = run((o) => o === 'L')
  const winless = run((o) => o !== 'W')
  if (wins >= 2) s.streak = { kind: 'win', count: wins }
  else if (unbeaten >= 4) s.streak = { kind: 'unbeaten', count: unbeaten }
  else if (loses >= 2) s.streak = { kind: 'lose', count: loses }
  else if (winless >= 4) s.streak = { kind: 'winless', count: winless }
  return s
}

export function streakText(s: SeasonSummary['streak']): string | null {
  if (!s) return null
  switch (s.kind) {
    case 'win':
      return `${s.count}連勝`
    case 'unbeaten':
      return `${s.count}戦無敗`
    case 'lose':
      return `${s.count}連敗`
    case 'winless':
      return `${s.count}試合勝ちなし`
  }
}

/** 得点者の文字列から選手ごとの得点数を数える（例: "Saka 12', Saka 40', Havertz(ホーム)55'"） */
export function parseScorers(text: unknown): { name: string; goals: number }[] {
  const counts = new Map<string, number>()
  for (const part of String(text ?? '').split(/[,、，/]/)) {
    const minutes = part.match(/\d+\s*['’分]/g)
    const name = part
      .replace(/[(（][^)）]*[)）]/g, '')
      .replace(/\d+\s*(\+\s*\d+)?\s*['’分]?/g, '')
      .replace(/\b(pk|og|pen)\b/gi, '')
      .trim()
    if (!name) continue
    counts.set(name, (counts.get(name) ?? 0) + Math.max(1, minutes?.length ?? 1))
  }
  return [...counts].map(([name, goals]) => ({ name, goals }))
}

/** 指定シーズンの順位表（大会ごと）。自分のクラブがいる大会を先頭にする */
export function standingsTables(records: DataRecord[], season: string, myClub: string) {
  const byComp = new Map<string, DataRecord[]>()
  for (const r of records) {
    if (r.kind !== 'standing') continue
    if (season && r.data.season && r.data.season !== season) continue
    const comp = String(r.data.competition ?? '') || 'リーグ'
    byComp.set(comp, [...(byComp.get(comp) ?? []), r])
  }
  return [...byComp]
    .map(([competition, rows]) => ({
      competition,
      rows: rows.sort((a, b) => Number(a.data.rank ?? 99) - Number(b.data.rank ?? 99)),
      mine: rows.find((r) => isMyClub(r.data.club, myClub)) ?? null,
    }))
    .sort((a, b) => Number(Boolean(b.mine)) - Number(Boolean(a.mine)))
}
