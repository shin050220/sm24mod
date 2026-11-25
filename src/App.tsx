import { useState } from 'react'
import { DataView } from './components/DataView'
import { ImportView } from './components/ImportView'
import { NewsFeed } from './components/NewsFeed'
import { SettingsView } from './components/SettingsView'
import { WriteView } from './components/WriteView'
import { newId, upsertRecords, useAppData } from './store'

type Tab = 'news' | 'import' | 'data' | 'write' | 'settings'

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: 'news', label: 'ニュース', icon: '📰' },
  { id: 'import', label: '取り込み', icon: '📷' },
  { id: 'data', label: 'データ', icon: '📊' },
  { id: 'write', label: '記事作成', icon: '✍️' },
  { id: 'settings', label: '設定', icon: '⚙️' },
]

export default function App() {
  const { data, update, saveError } = useAppData()
  const [tab, setTab] = useState<Tab>(data.settings.apiKey ? 'news' : 'settings')

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
        {tab === 'news' && (
          <NewsFeed
            data={data}
            onGoWrite={() => setTab('write')}
            onDelete={(id) => update((d) => ({ ...d, articles: d.articles.filter((a) => a.id !== id) }))}
          />
        )}
        {tab === 'import' && (
          <ImportView
            data={data}
            onGoWrite={() => setTab('write')}
            onImport={(items) => {
              const merged = upsertRecords(data.records, items)
              update((d) => ({ ...d, records: merged.records }))
              return merged.result
            }}
          />
        )}
        {tab === 'data' && (
          <DataView
            data={data}
            onAdd={(kind, recordData) => {
              const id = newId()
              update((d) => ({ ...d, records: [...d.records, { id, kind, createdAt: new Date().toISOString(), data: recordData }] }))
              return id
            }}
            onSave={(rec) => update((d) => ({ ...d, records: d.records.map((r) => (r.id === rec.id ? rec : r)) }))}
            onDelete={(id) => update((d) => ({ ...d, records: d.records.filter((r) => r.id !== id) }))}
          />
        )}
        {tab === 'write' && (
          <WriteView
            data={data}
            onDone={() => setTab('news')}
            onPublish={(articles) => {
              const now = Date.now()
              update((d) => ({
                ...d,
                articles: [
                  ...d.articles,
                  // 1本目がフィードの先頭に来るよう、作成時刻を少しずつずらす
                  ...articles.map((a, i) => ({ ...a, id: newId(), createdAt: new Date(now - i * 1000).toISOString() })),
                ],
              }))
            }}
          />
        )}
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
