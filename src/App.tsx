import { useState } from 'react'
import { Dashboard } from './components/Dashboard'
import { DataView } from './components/DataView'
import { ImportView } from './components/ImportView'
import { NewsFeed } from './components/NewsFeed'
import { SettingsView } from './components/SettingsView'
import { WriteView } from './components/WriteView'
import { newId, upsertRecords, useAppData } from './store'
import { templateArticles } from './templates'
import type { AppData, FieldValue, NewArticle, RecordKind } from './types'

type Tab = 'home' | 'news' | 'import' | 'data' | 'write' | 'settings'

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: 'home', label: 'ホーム', icon: '🏟️' },
  { id: 'news', label: 'ニュース', icon: '📰' },
  { id: 'import', label: '取り込み', icon: '📷' },
  { id: 'data', label: 'データ', icon: '📊' },
  { id: 'write', label: '記事作成', icon: '✍️' },
  { id: 'settings', label: '設定', icon: '⚙️' },
]

function withArticles(d: AppData, articles: NewArticle[]): AppData {
  const now = Date.now()
  return {
    ...d,
    articles: [
      ...d.articles,
      // 1本目がフィードの先頭に来るよう、作成時刻を少しずつずらす
      ...articles.map((a, i) => ({ ...a, id: newId(), createdAt: new Date(now - i * 1000).toISOString() })),
    ],
  }
}

export default function App() {
  const { data, update, saveError } = useAppData()
  const [tab, setTab] = useState<Tab>('home')

  /** データを追加し、自動記事化がオンならテンプレ記事も作る。作った記事の本数を返す。 */
  const addRecords = (items: { kind: RecordKind; data: Record<string, FieldValue> }[]) => {
    const merged = upsertRecords(data.records, items)
    const articles = data.settings.autoArticle ? templateArticles(merged.touched, merged.records, data.settings, { auto: true }) : []
    update((d) => withArticles({ ...d, records: merged.records }, articles))
    return { result: merged.result, made: articles.length }
  }

  const today = new Date().toLocaleDateString('ja-JP', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'short' })

  return (
    <div className="app">
      <header className="masthead">
        <div className="masthead-inner">
          <h1>{data.settings.paperName || 'SM24 スポーツ'}</h1>
          <p>
            {today}
            {data.settings.myClub && `・${data.settings.myClub}番`}
            {data.settings.season && `・${data.settings.season}シーズン`}
          </p>
        </div>
        <nav className="tabs" aria-label="メニュー">
          {TABS.map((t) => (
            <button key={t.id} className={t.id === tab ? 'tab active' : 'tab'} onClick={() => setTab(t.id)} aria-current={t.id === tab}>
              <span aria-hidden="true">{t.icon}</span>
              <span>{t.label}</span>
            </button>
          ))}
        </nav>
      </header>

      <main className="content">
        {saveError && <p className="error">{saveError}</p>}
        {tab === 'home' && <Dashboard data={data} onGo={setTab} onQuickAdd={(kind, d) => addRecords([{ kind, data: d }]).made} />}
        {tab === 'news' && (
          <NewsFeed
            data={data}
            onGoWrite={() => setTab('write')}
            onDelete={(id) => update((d) => ({ ...d, articles: d.articles.filter((a) => a.id !== id) }))}
          />
        )}
        {tab === 'import' && <ImportView data={data} onGoWrite={() => setTab('news')} onImport={addRecords} />}
        {tab === 'data' && (
          <DataView
            data={data}
            onAdd={(kind, recordData) => addRecords([{ kind, data: recordData }])}
            onSave={(rec) => update((d) => ({ ...d, records: d.records.map((r) => (r.id === rec.id ? rec : r)) }))}
            onDelete={(id) => update((d) => ({ ...d, records: d.records.filter((r) => r.id !== id) }))}
          />
        )}
        {tab === 'write' && <WriteView data={data} onDone={() => setTab('news')} onPublish={(articles) => update((d) => withArticles(d, articles))} />}
        {tab === 'settings' && (
          <SettingsView
            data={data}
            onSettings={(settings) => update((d) => ({ ...d, settings }))}
            onReplace={(next) => update(() => next)}
          />
        )}
      </main>
    </div>
  )
}
