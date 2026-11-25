import { useEffect, useState } from 'react'
import { describeError, extractFromImages, fileToImageInput, type ExtractedItem } from '../claude'
import { KIND_LABELS, summarize, type AppData, type DataRecord } from '../types'
import { RecordForm } from './RecordForm'
import type { UpsertResult } from '../store'

interface Props {
  data: AppData
  onImport: (items: ExtractedItem[]) => UpsertResult
  onGoWrite: () => void
}

interface Picked {
  file: File
  url: string
}

export function ImportView({ data, onImport, onGoWrite }: Props) {
  const [files, setFiles] = useState<Picked[]>([])
  const [hint, setHint] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [description, setDescription] = useState('')
  const [items, setItems] = useState<(ExtractedItem & { keep: boolean })[] | null>(null)
  const [editIndex, setEditIndex] = useState<number | null>(null)
  const [result, setResult] = useState<UpsertResult | null>(null)

  useEffect(() => () => files.forEach((f) => URL.revokeObjectURL(f.url)), [files])

  const pick = (list: FileList | null) => {
    if (!list) return
    const next = [...list].filter((f) => f.type.startsWith('image/')).slice(0, 10)
    setFiles(next.map((file) => ({ file, url: URL.createObjectURL(file) })))
    setItems(null)
    setResult(null)
    setError(null)
  }

  const run = async () => {
    setBusy(true)
    setError(null)
    setResult(null)
    try {
      const images = await Promise.all(files.map((f) => fileToImageInput(f.file)))
      const out = await extractFromImages(data.settings, images, hint)
      setDescription(out.description)
      setItems(out.items.map((i) => ({ ...i, keep: true })))
    } catch (e) {
      setError(describeError(e))
    } finally {
      setBusy(false)
    }
  }

  const save = () => {
    if (!items) return
    const r = onImport(items.filter((i) => i.keep).map(({ kind, data }) => ({ kind, data })))
    setResult(r)
    setItems(null)
    setFiles([])
  }

  return (
    <div>
      <div className="panel">
        <h3>スクショから読み取る</h3>
        <p className="muted small">
          SM24 の試合結果・移籍履歴・選手成績・順位表などの画面をスクショして選んでください（最大10枚）。AI が読み取って、保存前に確認・修正できます。
        </p>
        <label className="file-pick">
          <input type="file" accept="image/*" multiple onChange={(e) => pick(e.target.files)} />
          <span>画像を選ぶ</span>
        </label>
        {files.length > 0 && (
          <div className="thumbs">
            {files.map((f) => (
              <img key={f.url} src={f.url} alt="選んだスクリーンショット" />
            ))}
          </div>
        )}
        <label className="field wide">
          <span>補足（任意）</span>
          <input value={hint} onChange={(e) => setHint(e.target.value)} placeholder="例: 第12節の結果です / 冬の移籍市場" />
        </label>
        <div className="row-actions">
          <button className="primary" disabled={files.length === 0 || busy} onClick={run}>
            {busy ? '読み取り中…' : '読み取る'}
          </button>
        </div>
        {!data.settings.apiKey && <p className="warn">先に「設定」で API キーを入力してください。</p>}
        {error && <p className="error">{error}</p>}
      </div>

      {result && (
        <div className="panel success">
          <p>
            保存しました：追加 {result.added} 件・更新 {result.updated} 件・重複スキップ {result.skipped} 件
          </p>
          <button className="primary" onClick={onGoWrite}>このまま記事を作る</button>
        </div>
      )}

      {items && (
        <div className="panel">
          <h3>読み取り結果</h3>
          {description && <p className="muted small">画面: {description}</p>}
          {items.length === 0 && <p>データを読み取れませんでした。別の画面のスクショで試してください。</p>}
          <ul className="record-list">
            {items.map((it, i) => (
              <li key={i} className={editIndex === i ? 'panel' : undefined}>
                <div className="check-row">
                  <input
                    type="checkbox"
                    checked={it.keep}
                    aria-label="保存する"
                    onChange={(e) => setItems(items.map((x, j) => (j === i ? { ...x, keep: e.target.checked } : x)))}
                  />
                  <button className="record" onClick={() => setEditIndex(editIndex === i ? null : i)}>
                    <span className="badge">{KIND_LABELS[it.kind]}</span>
                    <span>{summarize({ ...it, id: '', createdAt: '' } as DataRecord)}</span>
                  </button>
                </div>
                {editIndex === i && (
                  <RecordForm kind={it.kind} data={it.data} onChange={(d) => setItems(items.map((x, j) => (j === i ? { ...x, data: d } : x)))} />
                )}
              </li>
            ))}
          </ul>
          {items.length > 0 && (
            <div className="row-actions">
              <button className="primary" onClick={save}>
                チェックした {items.filter((i) => i.keep).length} 件を保存
              </button>
              <button onClick={() => setItems(null)}>破棄</button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
