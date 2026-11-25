import { useMemo, useState } from 'react'
import { myMatches, parseScorers, standingsTables, streakText, summarizeSeason } from '../analysis'
import { isMyClub, type AppData, type FieldValue, type RecordKind } from '../types'
import { QuickAdd } from './QuickAdd'

interface Props {
  data: AppData
  onQuickAdd: (kind: RecordKind, data: Record<string, FieldValue>) => number
  onGo: (tab: 'news' | 'import' | 'settings') => void
}

const OUTCOME_LABEL = { W: '勝', D: '分', L: '敗' } as const

export function Dashboard({ data, onQuickAdd, onGo }: Props) {
  const { myClub, season } = data.settings
  const [quick, setQuick] = useState<'match' | 'transfer' | null>(null)
  const [flash, setFlash] = useState<string | null>(null)

  const matches = useMemo(() => myMatches(data.records, myClub, season), [data.records, myClub, season])
  const summary = useMemo(() => summarizeSeason(matches), [matches])
  const tables = useMemo(() => standingsTables(data.records, season, myClub), [data.records, season, myClub])
  const table = tables[0]
  const stats = useMemo(
    () => data.records.filter((r) => r.kind === 'stat' && (!r.data.season || r.data.season === season)),
    [data.records, season],
  )
  const scorers = [...stats].sort((a, b) => Number(b.data.goals ?? 0) - Number(a.data.goals ?? 0)).slice(0, 10)
  const assisters = [...stats].sort((a, b) => Number(b.data.assists ?? 0) - Number(a.data.assists ?? 0)).slice(0, 5)
  const transfers = data.records.filter((r) => r.kind === 'transfer' && (!r.data.season || r.data.season === season)).slice(-6).reverse()
  const headlines = [...data.articles].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 3)
  const streak = streakText(summary.streak)
  // 選手成績データが無いときは、入力した試合の得点者から自チームの得点ランキングを作る
  const teamScorers = useMemo(() => {
    const counts = new Map<string, number>()
    for (const m of matches) {
      for (const sc of parseScorers(m.record.data.scorers)) {
        const raw = String(m.record.data.scorers ?? '')
        // 「名前(クラブ)」形式で相手クラブの得点者と分かるものは除く
        if (raw.includes(`${sc.name}(${m.opponent})`) || raw.includes(`${sc.name}（${m.opponent}）`)) continue
        counts.set(sc.name, (counts.get(sc.name) ?? 0) + sc.goals)
      }
    }
    return [...counts].sort((a, b) => b[1] - a[1]).slice(0, 10)
  }, [matches])

  const submit = (kind: RecordKind, d: Record<string, FieldValue>) => {
    const made = onQuickAdd(kind, d)
    setQuick(null)
    setFlash(made > 0 ? `登録しました。記事を${made}本作成しました。` : '登録しました。')
    setTimeout(() => setFlash(null), 4000)
  }

  return (
    <div>
      {!myClub && (
        <div className="panel">
          <p>「設定」で監督しているクラブとシーズンを入れると、ここに成績がまとまって表示されます。</p>
          <button className="primary" onClick={() => onGo('settings')}>設定を開く</button>
        </div>
      )}

      <div className="quick-actions">
        <button className="primary" onClick={() => setQuick('match')}>＋試合</button>
        <button className="primary" onClick={() => setQuick('transfer')}>＋移籍</button>
        <button onClick={() => onGo('import')}>📷取込</button>
      </div>
      {flash && <p className="success-text">{flash}</p>}
      {quick && <QuickAdd data={data} mode={quick} onSubmit={submit} onClose={() => setQuick(null)} />}

      <div className="dash-grid">
        {myClub && (
          <section className="panel club-card">
            <div className="club-head">
              <h3>{myClub}</h3>
              <span className="muted small">{season}シーズン</span>
            </div>
            <div className="big-stats">
              <div><strong>{table?.mine ? `${table.mine.data.rank}位` : '—'}</strong><span>順位</span></div>
              <div><strong>{summary.won}-{summary.drawn}-{summary.lost}</strong><span>勝-分-敗</span></div>
              <div><strong>{table?.mine?.data.points ?? summary.points}</strong><span>勝点</span></div>
              <div><strong>{summary.gf}:{summary.ga}</strong><span>得:失</span></div>
            </div>
            <div className="form-row">
              <span className="muted small">直近</span>
              {summary.form.length === 0 && <span className="muted small">まだ試合がありません</span>}
              {summary.form.map((o, i) => (
                <span key={i} className={`form-chip f-${o}`}>{OUTCOME_LABEL[o]}</span>
              ))}
              {streak && <span className="badge">{streak}</span>}
            </div>
            {matches.length > 0 && (
              <ul className="mini-list">
                {matches.slice(-5).reverse().map((m) => (
                  <li key={m.record.id}>
                    <span className={`form-chip f-${m.outcome}`}>{OUTCOME_LABEL[m.outcome]}</span>
                    <span className="muted small">{String(m.record.data.round ?? '')}</span>
                    <span>{m.home ? 'vs' : '@'} {m.opponent}</span>
                    <strong className="push">{m.my}-{m.opp}</strong>
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}

        <section className="panel">
          <h3>最新ニュース</h3>
          {headlines.length === 0 && <p className="muted small">まだ記事がありません。</p>}
          <ul className="mini-list">
            {headlines.map((a) => (
              <li key={a.id}>
                <button className="link" onClick={() => onGo('news')}>
                  <span className={`badge cat-${a.category}`}>{a.category}</span> {a.headline}
                </button>
              </li>
            ))}
          </ul>
        </section>

        <section className="panel wide-section">
          <h3>順位表{table ? `（${table.competition}）` : ''}</h3>
          {!table && <p className="muted small">順位表のスクショを取り込むと表示されます。</p>}
          {table && (
            <div className="table-wrap">
              <table className="standings">
                <thead>
                  <tr><th>#</th><th className="club">クラブ</th><th>試</th><th>勝</th><th>分</th><th>敗</th><th>得失</th><th>勝点</th></tr>
                </thead>
                <tbody>
                  {table.rows.map((r) => {
                    const gd = r.data.gf !== null && r.data.ga !== null && r.data.gf !== undefined ? Number(r.data.gf) - Number(r.data.ga) : null
                    return (
                      <tr key={r.id} className={isMyClub(r.data.club, myClub) ? 'mine' : undefined}>
                        <td>{r.data.rank ?? ''}</td>
                        <td className="club">{r.data.club}</td>
                        <td>{r.data.played ?? ''}</td>
                        <td>{r.data.won ?? ''}</td>
                        <td>{r.data.drawn ?? ''}</td>
                        <td>{r.data.lost ?? ''}</td>
                        <td>{gd === null || Number.isNaN(gd) ? '' : gd > 0 ? `+${gd}` : gd}</td>
                        <td><strong>{r.data.points ?? ''}</strong></td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="panel">
          <h3>{scorers.length === 0 && teamScorers.length > 0 ? `チーム内得点（${myClub}）` : '得点ランキング'}</h3>
          {scorers.length === 0 && teamScorers.length === 0 && <p className="muted small">試合の得点者を入れるか、選手成績のスクショを取り込むと表示されます。</p>}
          {scorers.length === 0 && teamScorers.length > 0 && (
            <ol className="rank-list">
              {teamScorers.map(([name, goals]) => (
                <li key={name}>
                  <span>{name}</span>
                  <strong>{goals}</strong>
                </li>
              ))}
            </ol>
          )}
          <ol className="rank-list">
            {scorers.map((r) => (
              <li key={r.id} className={isMyClub(r.data.club, myClub) ? 'mine' : undefined}>
                <span>{r.data.player}<span className="muted small"> {r.data.club}</span></span>
                <strong>{r.data.goals ?? 0}</strong>
              </li>
            ))}
          </ol>
        </section>

        <section className="panel">
          <h3>アシストランキング</h3>
          {assisters.length === 0 && <p className="muted small">データがありません。</p>}
          <ol className="rank-list">
            {assisters.map((r) => (
              <li key={r.id} className={isMyClub(r.data.club, myClub) ? 'mine' : undefined}>
                <span>{r.data.player}<span className="muted small"> {r.data.club}</span></span>
                <strong>{r.data.assists ?? 0}</strong>
              </li>
            ))}
          </ol>
        </section>

        <section className="panel">
          <h3>最近の移籍</h3>
          {transfers.length === 0 && <p className="muted small">データがありません。</p>}
          <ul className="mini-list">
            {transfers.map((r) => {
              const dir = isMyClub(r.data.to, myClub) ? 'IN' : isMyClub(r.data.from, myClub) ? 'OUT' : ''
              return (
                <li key={r.id}>
                  {dir && <span className={`badge ${dir === 'IN' ? 'in' : 'out'}`}>{dir}</span>}
                  <span>{r.data.player}</span>
                  <span className="muted small">{dir === 'IN' ? `← ${r.data.from ?? ''}` : `→ ${r.data.to ?? ''}`}</span>
                  {r.data.fee && <span className="push small">{r.data.fee}</span>}
                </li>
              )
            })}
          </ul>
        </section>
      </div>
    </div>
  )
}
