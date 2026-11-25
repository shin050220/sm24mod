import { myMatches, parseScorers, standingsTables, streakText, summarizeSeason } from './analysis'
import { isMyClub, type DataRecord, type NewArticle, type Settings } from './types'

/**
 * AI を使わずに、決まった型の文章からニュース記事を作る（無料）。
 * 言い回しは毎回ランダムに選ぶので、同じ種類の記事でも少しずつ表現が変わる。
 */

const pick = <T,>(xs: readonly T[]): T => xs[Math.floor(Math.random() * xs.length)]
const s = (v: unknown) => (v === null || v === undefined ? '' : String(v).trim())
const n = (v: unknown) => (v === null || v === undefined || v === '' ? null : Number(v))

const STYLE = 'テンプレ'

export function templateArticles(
  targets: DataRecord[],
  all: DataRecord[],
  settings: Settings,
  opts: { auto?: boolean } = {},
): NewArticle[] {
  const out: NewArticle[] = []
  for (const r of targets.filter((r) => r.kind === 'match')) {
    const a = matchArticle(r, all, settings)
    if (a) out.push(a)
  }
  for (const r of targets.filter((r) => r.kind === 'transfer')) out.push(transferArticle(r, settings))
  const standings = targets.filter((r) => r.kind === 'standing')
  // 自動記事化のときは、自分のクラブの順位が更新されたときだけ記事にする（1行ずつ手入力しても記事が乱発しないように）
  const myRowTouched = standings.some((r) => isMyClub(r.data.club, settings.myClub))
  if (standings.length > 0 && (!opts.auto || !settings.myClub || myRowTouched)) {
    const a = standingArticle(standings, all, settings)
    if (a) out.push(a)
  }
  const stats = targets.filter((r) => r.kind === 'stat')
  if (stats.length > 0) {
    const a = statArticle(stats, settings)
    if (a) out.push(a)
  }
  return out
}

// ---------- 試合 ----------

function matchArticle(r: DataRecord, all: DataRecord[], settings: Settings): NewArticle | null {
  const d = r.data
  const hs = n(d.homeScore)
  const as = n(d.awayScore)
  if (hs === null || as === null) return null
  const comp = s(d.competition)
  const round = s(d.round)
  const where = [comp, round].filter(Boolean).join(' ')
  const scorers = parseScorers(d.scorers)
  const hatTrick = scorers.find((x) => x.goals >= 3)
  const brace = scorers.find((x) => x.goals === 2)
  const scorerText = scorers.map((x) => (x.goals > 1 ? `${x.name}（${x.goals}得点）` : x.name)).join('、')
  const note = s(d.note)

  const mineHome = isMyClub(d.home, settings.myClub)
  const mineAway = isMyClub(d.away, settings.myClub)

  // 自分のクラブが関係しない試合は中立の短信にする
  if (!mineHome && !mineAway) {
    const home = s(d.home)
    const away = s(d.away)
    const headline =
      hs === as ? `${home}と${away}、${hs}-${as}で引き分け` : `${hs > as ? home : away}、${hs > as ? away : home}に${Math.max(hs, as)}-${Math.min(hs, as)}で勝利`
    return {
      category: '試合',
      headline,
      subheadline: where ? `${where}の結果` : '試合結果',
      body: [
        `${where ? `${where}、` : ''}${home}と${away}の一戦は${hs}-${as}で終了した。`,
        scorerText && `得点者は${scorerText}。`,
        note && `【メモ】${note}`,
      ]
        .filter(Boolean)
        .join('\n\n'),
      tags: [home, away, comp].filter(Boolean),
      style: STYLE,
      sourceIds: [r.id],
    }
  }

  const my = s(mineHome ? d.home : d.away)
  const opp = s(mineHome ? d.away : d.home)
  const mg = mineHome ? hs : as
  const og = mineHome ? as : hs
  const venue = mineHome ? '本拠地' : '敵地'
  const diff = mg - og
  const score = `${mg}-${og}`

  // この試合までの今季成績（この試合を含む）
  const upto = all.slice(0, all.findIndex((x) => x.id === r.id) + 1)
  const season = summarizeSeason(myMatches(upto, settings.myClub, s(d.season) || settings.season))
  const streak = streakText(season.streak)

  let headline: string
  if (diff >= 3) headline = pick([`${my}、${opp}に${score}の大勝！`, `${my}圧勝 ${opp}を${score}で粉砕`, `${score}！${my}が${opp}を圧倒`])
  else if (diff > 0)
    headline =
      diff === 1
        ? pick([`${my}、${opp}との接戦を${score}で制す`, `${my}競り勝つ！${opp}に${score}`, `${my}、${score}で${opp}を振り切る`])
        : pick([`${my}、${opp}に${score}で快勝`, `${my}快勝！${opp}を${score}で下す`, `${my}、${venue}で${opp}に${score}`])
  else if (diff === 0)
    headline =
      mg === 0
        ? pick([`${my}、${opp}とスコアレスドロー`, `${my}、${opp}と0-0 決め手欠く`])
        : pick([`${my}、${opp}と${score}のドロー`, `${my}、${opp}と痛み分け`, `${my}、${opp}と${score}で勝点1分け合う`])
  else if (diff <= -3) headline = pick([`${my}、${opp}に${score}の大敗`, `${my}完敗 ${opp}に${score}`, `悪夢の${score}…${my}、${opp}に屈す`])
  else headline = pick([`${my}、${opp}に${score}で敗れる`, `${my}、${opp}に競り負け`, `${my}痛恨の黒星 ${opp}に${score}`])

  let subheadline: string
  if (hatTrick && diff >= 0) subheadline = `${hatTrick.name}がハットトリック`
  else if (streak && season.streak && season.streak.count >= 3) subheadline = `${my}は${streak}`
  else if (brace && diff >= 0) subheadline = `${brace.name}が2ゴールの活躍`
  else if (scorers.length > 0 && diff > 0) subheadline = `${scorers[0].name}が得点`
  else subheadline = [where, `${venue}での一戦`].filter(Boolean).join('・')

  const lead =
    diff > 0
      ? pick([
          `${where ? `${where}、` : ''}${my}は${venue}で${opp}と対戦し、${score}で勝利した。`,
          `${my}が勝点3をつかんだ。${where ? `${where}で` : ''}${opp}と${venue}で戦い、${score}で白星を挙げた。`,
        ])
      : diff === 0
        ? pick([
            `${where ? `${where}、` : ''}${my}は${venue}で${opp}と対戦し、${score}で引き分けた。`,
            `${my}は${where ? `${where}で` : ''}${opp}と${score}のドロー。勝点1を分け合った。`,
          ])
        : pick([
            `${where ? `${where}、` : ''}${my}は${venue}で${opp}と対戦し、${score}で敗れた。`,
            `${my}が手痛い黒星を喫した。${where ? `${where}で` : ''}${opp}に${score}で敗れた。`,
          ])

  const goals = scorerText ? `得点者は${scorerText}。${hatTrick ? `${hatTrick.name}は圧巻のハットトリックでチームを牽引した。` : ''}` : ''

  const tables = standingsTables(all, s(d.season) || settings.season, settings.myClub)
  const rank = tables[0]?.mine ? n(tables[0].mine.data.rank) : null
  const recordLine = `これで今季の公式戦成績は${season.won}勝${season.drawn}分${season.lost}敗（${season.gf}得点${season.ga}失点）。${
    streak ? `チームは${streak}となった。` : ''
  }${rank ? `${tables[0].competition}では${rank}位につけている。` : ''}`

  const closing =
    diff > 0
      ? pick(['この勢いを次戦にもつなげたい。', 'サポーターからは歓喜の声が上がった。', '指揮官の采配も光った一戦だった。'])
      : diff === 0
        ? pick(['次こそは勝点3を持ち帰りたい。', '内容は悪くなかっただけに、もったいない引き分けとなった。'])
        : pick(['切り替えて次戦に臨みたい。', '修正点の多い試合となった。巻き返しに期待したい。', 'サポーターからはため息が漏れた。'])

  return {
    category: '試合',
    headline,
    subheadline,
    body: [lead, goals, note && `【試合メモ】${note}`, recordLine, closing].filter(Boolean).join('\n\n'),
    tags: [my, opp, comp, hatTrick ? 'ハットトリック' : ''].filter(Boolean),
    style: STYLE,
    sourceIds: [r.id],
  }
}

// ---------- 移籍 ----------

function transferArticle(r: DataRecord, settings: Settings): NewArticle {
  const d = r.data
  const player = s(d.player)
  const from = s(d.from)
  const to = s(d.to)
  const fee = s(d.fee)
  const type = s(d.type)
  const pos = s(d.position)
  const age = n(d.age)
  const profile = [age ? `${age}歳` : '', pos].filter(Boolean).join('の')
  const who = profile ? `${profile}${player}` : player
  const isIn = isMyClub(to, settings.myClub)
  const isOut = isMyClub(from, settings.myClub)
  const isLoan = /レンタル|ローン|loan/i.test(type)
  const isRenewal = /延長|更新|renew/i.test(type)
  const isFree = /フリー|free/i.test(type + fee)
  const feeText = isFree ? 'フリートランスファー' : fee ? `移籍金${fee}` : ''

  let headline: string
  let lead: string
  if (isRenewal) {
    const club = to || from || settings.myClub
    headline = pick([`${club}、${player}と契約延長`, `${player}、${club}との契約を延長`])
    lead = `${club}は${who}との契約を延長したと発表した。${fee ? `条件は${fee}とみられる。` : ''}`
  } else if (isIn) {
    headline = isLoan
      ? pick([`${to}、${from}から${player}をレンタルで獲得`, `${player}、${to}へ期限付き移籍`])
      : pick([`${to}、${player}を獲得！`, `${player}が${to}に加入`, `${to}、${from}から${player}を補強${fee && !isFree ? `（${fee}）` : ''}`])
    lead = `${to}は${from ? `${from}から` : ''}${who}を${isLoan ? 'レンタル移籍で' : ''}獲得したと発表した。${feeText ? `${feeText}とされる。` : ''}`
  } else if (isOut) {
    headline = isLoan
      ? pick([`${player}、${to}へレンタル移籍`, `${from}、${player}を${to}へ貸し出し`])
      : pick([`${player}、${to}へ移籍`, `${from}、${player}の${to}移籍を発表`, `${player}が${from}退団 新天地は${to}`])
    lead = `${from}は${who}が${to ? `${to}へ` : ''}${isLoan ? 'レンタル移籍' : '移籍'}することを発表した。${feeText ? `${feeText}とされる。` : ''}`
  } else {
    headline = `${player}、${from ? `${from}から` : ''}${to}へ${isLoan ? 'レンタル移籍' : '移籍'}`
    lead = `${who}が${from ? `${from}から` : ''}${to}へ${isLoan ? 'レンタル移籍' : '移籍'}した。${feeText ? `${feeText}とされる。` : ''}`
  }

  const comment = isRenewal
    ? pick(['チームの中心選手を引き留めることに成功した。', 'クラブは長期的な戦力として期待を寄せている。'])
    : isIn
      ? pick([
          '即戦力としての活躍が期待される。',
          `${pos ? `${pos}の層を厚くする` : '戦力アップにつながる'}補強となった。サポーターからは期待の声が上がっている。`,
          '新天地でのデビューに注目が集まる。',
        ])
      : isOut
        ? pick(['チームにとっては痛い放出となるか。', 'クラブへの貢献に感謝の声が寄せられている。', '新天地での活躍を祈りたい。'])
        : ''

  const subheadline = isRenewal ? '契約延長' : [feeText, isLoan ? '期限付き' : isIn ? '新戦力' : isOut ? '放出' : ''].filter(Boolean).join('・')

  return {
    category: '移籍',
    headline,
    subheadline: subheadline || '移籍情報',
    body: [lead, comment, s(d.note) && `【メモ】${s(d.note)}`].filter(Boolean).join('\n\n'),
    tags: [player, from, to, isLoan ? 'レンタル' : ''].filter(Boolean),
    style: STYLE,
    sourceIds: [r.id],
  }
}

// ---------- 順位 ----------

function standingArticle(targets: DataRecord[], all: DataRecord[], settings: Settings): NewArticle | null {
  const season = s(targets[0].data.season) || settings.season
  const tables = standingsTables(all, season, settings.myClub)
  const table = tables.find((t) => t.rows.some((r) => targets.some((x) => x.id === r.id))) ?? tables[0]
  if (!table || table.rows.length === 0) return null
  const leader = table.rows[0]
  const total = table.rows.length
  const pts = (r: DataRecord) => n(r.data.points) ?? 0
  const lines = table.rows.slice(0, 5).map((r) => `${s(r.data.rank)}位 ${s(r.data.club)}（勝点${pts(r)}）`)
  const mine = table.mine

  if (mine) {
    const rank = n(mine.data.rank) ?? 0
    const club = s(mine.data.club)
    const gap = pts(leader) - pts(mine)
    const zone =
      rank === 1 ? '首位' : rank <= 4 ? '上位争い' : total >= 18 && rank > total - 3 ? '降格圏' : rank <= total / 2 ? '中位' : '下位'
    const headline =
      rank === 1
        ? pick([`${club}、首位に立つ！`, `${club}が首位キープ 勝点${pts(mine)}`])
        : zone === '降格圏'
          ? pick([`${club}、${rank}位と降格圏に沈む`, `${club}に危機感 ${rank}位で降格圏`])
          : pick([`${club}は${rank}位 首位と勝点差${gap}`, `${table.competition}順位：${club}は${rank}位`])
    const body = [
      `${table.competition}の最新順位で、${club}は${rank}位（勝点${pts(mine)}${
        n(mine.data.won) !== null ? `、${s(mine.data.won)}勝${s(mine.data.drawn) || 0}分${s(mine.data.lost) || 0}敗` : ''
      }）につけている。`,
      rank === 1
        ? `2位${s(table.rows[1]?.data.club)}との勝点差は${pts(mine) - pts(table.rows[1] ?? mine)}。このまま逃げ切れるか。`
        : `首位${s(leader.data.club)}との勝点差は${gap}。${gap <= 3 ? '十分に射程圏内だ。' : gap <= 9 ? '逆転へ向けて取りこぼしは許されない。' : '差は大きく、厳しい状況が続く。'}`,
      `【上位】\n${lines.join('\n')}`,
    ]
    return {
      category: '順位',
      headline,
      subheadline: `${table.competition}・${zone}`,
      body: body.join('\n\n'),
      tags: [club, table.competition, '順位'].filter(Boolean),
      style: STYLE,
      sourceIds: table.rows.map((r) => r.id),
    }
  }

  return {
    category: '順位',
    headline: `${table.competition}、${s(leader.data.club)}が首位`,
    subheadline: '最新順位',
    body: [`${table.competition}の最新順位は以下の通り。`, lines.join('\n')].join('\n\n'),
    tags: [table.competition, '順位'],
    style: STYLE,
    sourceIds: table.rows.map((r) => r.id),
  }
}

// ---------- 個人成績 ----------

function statArticle(targets: DataRecord[], settings: Settings): NewArticle | null {
  const rows = [...targets].sort((a, b) => (n(b.data.goals) ?? 0) - (n(a.data.goals) ?? 0))
  const top = rows[0]
  if (!top) return null
  const g = (r: DataRecord) => n(r.data.goals) ?? 0
  const a = (r: DataRecord) => n(r.data.assists) ?? 0
  const myTop = rows.find((r) => isMyClub(r.data.club, settings.myClub))

  if (rows.length === 1) {
    const player = s(top.data.player)
    const club = s(top.data.club)
    const milestone = g(top) >= 20 ? '20ゴール超え' : g(top) >= 10 ? '2桁得点' : ''
    return {
      category: '成績',
      headline: milestone ? `${player}、${milestone}到達！` : `${player}、今季${g(top)}得点${a(top)}アシスト`,
      subheadline: `${club}${s(top.data.position) ? `・${s(top.data.position)}` : ''}`,
      body: [
        `${club}の${player}は今季${s(top.data.apps) || '?'}試合に出場し、${g(top)}得点${a(top)}アシストを記録している。${n(top.data.rating) ? `平均評価は${n(top.data.rating)}。` : ''}`,
        milestone ? pick(['チームに欠かせない存在となっている。', 'さらなる記録更新に期待がかかる。']) : '',
      ]
        .filter(Boolean)
        .join('\n\n'),
      tags: [player, club].filter(Boolean),
      style: STYLE,
      sourceIds: [top.id],
    }
  }

  const ranking = rows.slice(0, 10).map((r, i) => `${i + 1}. ${s(r.data.player)}（${s(r.data.club)}）${g(r)}得点 ${a(r)}アシスト`)
  const assistKing = [...rows].sort((x, y) => a(y) - a(x))[0]
  return {
    category: '成績',
    headline: pick([`得点ランク：${s(top.data.player)}が${g(top)}点でトップ`, `${s(top.data.player)}、${g(top)}ゴールで得点王争いをリード`]),
    subheadline: myTop && myTop !== top ? `${s(myTop.data.club)}は${s(myTop.data.player)}が${g(myTop)}得点` : '最新の個人成績',
    body: [
      `最新の個人成績で、得点ランキングのトップは${s(top.data.club)}の${s(top.data.player)}（${g(top)}得点）。`,
      assistKing && a(assistKing) > 0 ? `アシストでは${s(assistKing.data.player)}の${a(assistKing)}本が最多となっている。` : '',
      `【得点ランキング】\n${ranking.join('\n')}`,
    ]
      .filter(Boolean)
      .join('\n\n'),
    tags: ['得点ランキング', s(top.data.player)].filter(Boolean),
    style: STYLE,
    sourceIds: rows.map((r) => r.id),
  }
}
