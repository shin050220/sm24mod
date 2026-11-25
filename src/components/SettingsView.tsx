import { useState } from 'react'
import { normalize } from '../store'
import { MODELS, type AppData, type Settings } from '../types'

interface Props {
  data: AppData
  onSettings: (s: Settings) => void
  onReplace: (d: AppData) => void
}

export function SettingsView({ data, onSettings, onReplace }: Props) {
  const s = data.settings
  const [showKey, setShowKey] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const set = (patch: Partial<Settings>) => onSettings({ ...s, ...patch })

  const exportJson = () => {
    // API キーはバックアップに含めない
    const payload = { ...data, settings: { ...data.settings, apiKey: '' } }
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `sm24news-backup-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  const importJson = async (file: File | undefined) => {
    if (!file) return
    try {
      const parsed = normalize(JSON.parse(await file.text()))
      if (!confirm(`記事 ${parsed.articles.length} 本・データ ${parsed.records.length} 件で今のデータを置き換えます。よろしいですか？`)) return
      onReplace({ ...parsed, settings: { ...parsed.settings, apiKey: s.apiKey } })
      setMessage('バックアップを読み込みました。')
    } catch {
      setMessage('ファイルを読み込めませんでした。')
    }
  }

  return (
    <div>
      <div className="panel">
        <h3>記事</h3>
        <label className="field inline">
          <input type="checkbox" checked={s.autoArticle} onChange={(e) => set({ autoArticle: e.target.checked })} />
          <span>データを追加したら自動で記事にする（テンプレ・無料）</span>
        </label>
        <label className="field wide">
          <span>「記事作成」の標準の作り方</span>
          <select value={s.engine} onChange={(e) => set({ engine: e.target.value as Settings['engine'] })}>
            <option value="template">テンプレ（無料）</option>
            <option value="ai">AI（有料）</option>
          </select>
        </label>
      </div>

      <div className="panel">
        <h3>Claude API（スクショ読み取り・AI 記事を使うときだけ必要）</h3>
        <label className="field wide">
          <span>API キー</span>
          <div className="key-row">
            <input
              type={showKey ? 'text' : 'password'}
              value={s.apiKey}
              autoComplete="off"
              placeholder="sk-ant-..."
              onChange={(e) => set({ apiKey: e.target.value })}
            />
            <button onClick={() => setShowKey(!showKey)}>{showKey ? '隠す' : '表示'}</button>
          </div>
        </label>
        <p className="muted small">
          料金の目安（1回あたり）：Haiku 5.5 は1円未満、Sonnet 5.5 は5〜8円、Opus 5.5 は10〜15円ほど。キーは console.anthropic.com で作れます。キーはこの端末のブラウザにだけ保存され、Anthropic の API へ直接送られます。共用の端末では入力しないでください。
        </p>
        <label className="field wide">
          <span>モデル</span>
          <select value={s.model} onChange={(e) => set({ model: e.target.value })}>
            {MODELS.map((m) => (
              <option key={m.id} value={m.id}>{m.label}</option>
            ))}
          </select>
        </label>
      </div>

      <div className="panel">
        <h3>キャリア情報</h3>
        <div className="form-grid">
          <label className="field">
            <span>監督しているクラブ</span>
            <input value={s.myClub} onChange={(e) => set({ myClub: e.target.value })} placeholder="例: Arsenal" />
          </label>
          <label className="field">
            <span>現在のシーズン</span>
            <input value={s.season} onChange={(e) => set({ season: e.target.value })} placeholder="2024/25" />
          </label>
          <label className="field wide">
            <span>新聞の名前</span>
            <input value={s.paperName} onChange={(e) => set({ paperName: e.target.value })} />
          </label>
        </div>
      </div>

      <div className="panel">
        <h3>バックアップ</h3>
        <p className="muted small">データはこのブラウザの中にだけ保存されています。PC とスマホで移したいときや、念のための保存に使ってください（API キーは含まれません）。</p>
        <div className="row-actions">
          <button onClick={exportJson}>書き出す</button>
          <label className="file-pick">
            <input type="file" accept="application/json,.json" onChange={(e) => importJson(e.target.files?.[0])} />
            <span>読み込む</span>
          </label>
          <button
            className="danger"
            onClick={() => {
              if (confirm('記事とデータをすべて削除します。元に戻せません。よろしいですか？'))
                onReplace({ ...data, records: [], articles: [] })
            }}
          >
            全削除
          </button>
        </div>
        {message && <p>{message}</p>}
      </div>
    </div>
  )
}
