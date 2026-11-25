import { useMemo, useState } from 'react'
import { describeError, LENGTHS, STYLES, writeArticles, type WriteOptions } from '../claude'
import { templateArticles } from '../templates'
import { KIND_LABELS, summarize, type AppData, type ArticleEngine, type NewArticle, type RecordKind } from '../types'

interface Props {
  data: AppData
  onPublish: (articles: NewArticle[]) => void
  onDone: () => void
}

const KINDS: RecordKind[] = ['match', 'transfer', 'stat', 'standing']

export function WriteView({ data, onPublish, onDone }: Props) {
  const articled = useMemo(() => new Set(data.articles.flatMap((a) => a.sourceIds)), [data.articles])
  const [onlyNew, setOnlyNew] = useState(true)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [opts, setOpts] = useState<WriteOptions>({
    styleId: 'sports',
    lengthId: 'normal',
    mode: 'multi',
    allowQuotes: true,
    instructions: '',
  })
  const [engine, setEngine] = useState<ArticleEngine>(data.settings.engine)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [published, setPublished] = useState<number | null>(null)

  const candidates = useMemo(
    () =>
      data.records
        .filter((r) => !onlyNew || !articled.has(r.id))
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [data.records, onlyNew, articled],
  )

  const toggle = (id: string) => {
    const next = new Set(selected)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    setSelected(next)
  }

  const autoPick = () => {
    // 未記事化の試合・移籍・成績を新しい順に最大20件（順位表は文脈として自動で渡す）
    const ids = data.records
      .filter((r) => !articled.has(r.id) && r.kind !== 'standing')
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, 20)
      .map((r) => r.id)
    setSelected(new Set(ids))
  }

  const run = async () => {
    setBusy(true)
    setError(null)
    setPublished(null)
    try {
      const chosen = data.records.filter((r) => selected.has(r.id))
      if (engine === 'template') {
        const articles = templateArticles(chosen, data.records, data.settings)
        if (articles.length === 0) throw new Error('このデータからはテンプレ記事を作れませんでした（スコアが空の試合など）。')
        onPublish(articles)
        setPublished(articles.length)
        setSelected(new Set())
        return
      }
      const season = data.settings.season
      const standings = data.records
        .filter((r) => r.kind === 'standing' && (!season || r.data.season === season) && !selected.has(r.id))
        .sort((a, b) => Number(a.data.rank ?? 99) - Number(b.data.rank ?? 99))
        .slice(0, 24)
      const recentHeadlines = [...data.articles]
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .slice(0, 15)
        .map((a) => a.headline)
      const articles = await writeArticles(data.settings, chosen, { standings, recentHeadlines }, opts)
      onPublish(articles)
      setPublished(articles.length)
      setSelected(new Set())
    } catch (e) {
      setError(describeError(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div>
      <div className="panel">
        <h3>1. 記事にするデータを選ぶ</h3>
        <div className="toolbar">
          <label className="inline">
            <input type="checkbox" checked={onlyNew} onChange={(e) => setOnlyNew(e.target.checked)} /> 未記事化のみ
          </label>
          <button onClick={autoPick}>おまかせ選択</button>
          {selected.size > 0 && <button onClick={() => setSelected(new Set())}>選択解除</button>}
        </div>
        {candidates.length === 0 && <p className="muted">対象のデータがありません。「取り込み」か「データ」から追加してください。</p>}
        {KINDS.map((k) => {
          const rows = candidates.filter((r) => r.kind === k)
          if (rows.length === 0) return null
          return (
            <details key={k} open={k !== 'standing'}>
              <summary>
                {KIND_LABELS[k]}（{rows.length}）
              </summary>
              <ul className="record-list">
                {rows.map((r) => (
                  <li key={r.id}>
                    <label className="check-row">
                      <input type="checkbox" checked={selected.has(r.id)} onChange={() => toggle(r.id)} />
                      <span className="record">
                        <span className="muted small">{String(r.data.season ?? '')}</span>
                        <span>{summarize(r)}</span>
                        {articled.has(r.id) && <span className="badge done">記事化済</span>}
                      </span>
                    </label>
                  </li>
                ))}
              </ul>
            </details>
          )
        })}
      </div>

      <div className="panel">
        <h3>2. 書き方を決める</h3>
        <div className="segmented">
          <button className={engine === 'template' ? 'active' : ''} onClick={() => setEngine('template')}>テンプレ（無料）</button>
          <button className={engine === 'ai' ? 'active' : ''} onClick={() => setEngine('ai')}>AI（有料・文章が豊か）</button>
        </div>
        {engine === 'template' && (
          <p className="muted small">決まった型の文章で、試合・移籍は1件ずつ、順位と成績はまとめて記事にします。すぐできて料金はかかりません。</p>
        )}
        {engine === 'ai' && (
        <div className="form-grid">
          <label className="field">
            <span>文体</span>
            <select value={opts.styleId} onChange={(e) => setOpts({ ...opts, styleId: e.target.value })}>
              {STYLES.map((s) => (
                <option key={s.id} value={s.id}>{s.label}</option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>長さ</span>
            <select value={opts.lengthId} onChange={(e) => setOpts({ ...opts, lengthId: e.target.value })}>
              {LENGTHS.map((l) => (
                <option key={l.id} value={l.id}>{l.label}</option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>本数</span>
            <select value={opts.mode} onChange={(e) => setOpts({ ...opts, mode: e.target.value as WriteOptions['mode'] })}>
              <option value="multi">話題ごとに複数本</option>
              <option value="single">まとめて1本</option>
            </select>
          </label>
          <label className="field inline">
            <input type="checkbox" checked={opts.allowQuotes} onChange={(e) => setOpts({ ...opts, allowQuotes: e.target.checked })} />
            <span>関係者・サポーターの談話（創作）を入れる</span>
          </label>
          <label className="field wide">
            <span>追加リクエスト（任意）</span>
            <input
              value={opts.instructions}
              onChange={(e) => setOpts({ ...opts, instructions: e.target.value })}
              placeholder="例: 新加入の○○を大きく扱って / 宿敵との一戦として煽って"
            />
          </label>
        </div>
        )}
        <div className="row-actions">
          <button className="primary" disabled={selected.size === 0 || busy} onClick={run}>
            {busy ? '執筆中…（数十秒かかります）' : `${selected.size} 件のデータから記事を作る`}
          </button>
        </div>
        {engine === 'ai' && !data.settings.apiKey && <p className="warn">先に「設定」で API キーを入力してください。</p>}
        {error && <p className="error">{error}</p>}
        {published !== null && (
          <div className="success">
            <p>{published} 本の記事を掲載しました。</p>
            <button className="primary" onClick={onDone}>ニュースを見る</button>
          </div>
        )}
      </div>
    </div>
  )
}
