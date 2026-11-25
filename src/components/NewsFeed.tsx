import { useMemo, useState } from 'react'
import { ARTICLE_CATEGORIES, type AppData, type Article } from '../types'

interface Props {
  data: AppData
  onDelete: (id: string) => void
  onGoWrite: () => void
}

function formatDate(iso: string) {
  const d = new Date(iso)
  return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

export function NewsFeed({ data, onDelete, onGoWrite }: Props) {
  const [category, setCategory] = useState<string>('すべて')
  const [query, setQuery] = useState('')
  const [openId, setOpenId] = useState<string | null>(null)

  const articles = useMemo(() => {
    const q = query.trim().toLowerCase()
    return [...data.articles]
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .filter((a) => category === 'すべて' || a.category === category)
      .filter(
        (a) =>
          !q ||
          a.headline.toLowerCase().includes(q) ||
          a.body.toLowerCase().includes(q) ||
          a.tags.some((t) => t.toLowerCase().includes(q)),
      )
  }, [data.articles, category, query])

  if (data.articles.length === 0) {
    return (
      <div className="empty">
        <p>まだ記事がありません。</p>
        <p className="muted">「取り込み」でスクショからデータを読み取るか、「データ」で手入力してから、「記事作成」でニュースにしましょう。</p>
        <button className="primary" onClick={onGoWrite}>記事を作る</button>
      </div>
    )
  }

  const [top, ...rest] = articles
  return (
    <div>
      <div className="chips">
        {['すべて', ...ARTICLE_CATEGORIES].map((c) => (
          <button key={c} className={c === category ? 'chip active' : 'chip'} onClick={() => setCategory(c)}>
            {c}
          </button>
        ))}
      </div>
      <input className="search" type="search" placeholder="見出し・本文・タグで検索" value={query} onChange={(e) => setQuery(e.target.value)} />
      {articles.length === 0 && <p className="muted">該当する記事がありません。</p>}
      {top && <ArticleCard article={top} lead open={openId === top.id} onToggle={() => setOpenId(openId === top.id ? null : top.id)} onDelete={onDelete} />}
      <div className="feed-grid">
        {rest.map((a) => (
          <ArticleCard key={a.id} article={a} open={openId === a.id} onToggle={() => setOpenId(openId === a.id ? null : a.id)} onDelete={onDelete} />
        ))}
      </div>
    </div>
  )
}

function ArticleCard({
  article: a,
  lead,
  open,
  onToggle,
  onDelete,
}: {
  article: Article
  lead?: boolean
  open: boolean
  onToggle: () => void
  onDelete: (id: string) => void
}) {
  const [copied, setCopied] = useState(false)
  const paragraphs = a.body.split(/\n{2,}/)
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(`【${a.headline}】\n${a.subheadline}\n\n${a.body}`)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      /* クリップボードが使えない環境では何もしない */
    }
  }
  return (
    <article className={lead ? 'card lead' : 'card'}>
      <button className="card-head" onClick={onToggle} aria-expanded={open}>
        <div className="meta">
          <span className={`badge cat-${a.category}`}>{a.category}</span>
          <span className="muted">{formatDate(a.createdAt)}・{a.style}</span>
        </div>
        <h2>{a.headline}</h2>
        {a.subheadline && <p className="sub">{a.subheadline}</p>}
        {!open && <p className="excerpt">{a.body.slice(0, lead ? 140 : 70)}…</p>}
      </button>
      {open && (
        <div className="card-body">
          {paragraphs.map((p, i) => (
            <p key={i}>{p}</p>
          ))}
          {a.tags.length > 0 && (
            <div className="tags">
              {a.tags.map((t) => (
                <span key={t}>#{t}</span>
              ))}
            </div>
          )}
          <div className="row-actions">
            <button onClick={copy}>{copied ? 'コピーしました' : 'コピー'}</button>
            <button
              className="danger"
              onClick={() => {
                if (confirm('この記事を削除しますか？')) onDelete(a.id)
              }}
            >
              削除
            </button>
          </div>
        </div>
      )}
    </article>
  )
}
