import { useMemo, useState } from 'react'
import { KIND_LABELS, summarize, type AppData, type DataRecord, type FieldValue, type RecordKind } from '../types'
import { RecordForm } from './RecordForm'

interface Props {
  data: AppData
  onAdd: (kind: RecordKind, data: Record<string, FieldValue>) => unknown
  onSave: (record: DataRecord) => void
  onDelete: (id: string) => void
}

const KINDS: RecordKind[] = ['match', 'transfer', 'stat', 'standing']

export function DataView({ data, onAdd, onSave, onDelete }: Props) {
  const [kind, setKind] = useState<RecordKind>('match')
  const [season, setSeason] = useState<string>('すべて')
  const [editing, setEditing] = useState<DataRecord | null>(null)
  const [creating, setCreating] = useState<Record<string, FieldValue> | null>(null)

  const articled = useMemo(() => new Set(data.articles.flatMap((a) => a.sourceIds)), [data.articles])
  const seasons = useMemo(
    () => [...new Set(data.records.map((r) => String(r.data.season ?? '')).filter(Boolean))].sort().reverse(),
    [data.records],
  )
  const list = useMemo(() => {
    const rows = data.records.filter((r) => r.kind === kind && (season === 'すべて' || r.data.season === season))
    if (kind === 'standing') return rows.sort((a, b) => Number(a.data.rank ?? 99) - Number(b.data.rank ?? 99))
    if (kind === 'stat') return rows.sort((a, b) => Number(b.data.goals ?? 0) - Number(a.data.goals ?? 0))
    return rows.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  }, [data.records, kind, season])

  return (
    <div>
      <div className="chips">
        {KINDS.map((k) => (
          <button key={k} className={k === kind ? 'chip active' : 'chip'} onClick={() => { setKind(k); setEditing(null); setCreating(null) }}>
            {KIND_LABELS[k]}（{data.records.filter((r) => r.kind === k).length}）
          </button>
        ))}
      </div>
      <div className="toolbar">
        <select value={season} onChange={(e) => setSeason(e.target.value)} aria-label="シーズン">
          <option>すべて</option>
          {seasons.map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>
        <button className="primary" onClick={() => { setEditing(null); setCreating({ season: data.settings.season }) }}>
          ＋ 手入力で追加
        </button>
      </div>

      {creating && (
        <div className="panel">
          <h3>{KIND_LABELS[kind]}を追加</h3>
          <RecordForm kind={kind} data={creating} onChange={setCreating} />
          <div className="row-actions">
            <button className="primary" onClick={() => { onAdd(kind, creating); setCreating(null) }}>追加</button>
            <button onClick={() => setCreating(null)}>キャンセル</button>
          </div>
        </div>
      )}

      {list.length === 0 && !creating && <p className="muted">まだ{KIND_LABELS[kind]}のデータがありません。</p>}
      <ul className="record-list">
        {list.map((r) =>
          editing?.id === r.id ? (
            <li key={r.id} className="panel">
              <RecordForm kind={r.kind} data={editing.data} onChange={(d) => setEditing({ ...editing, data: d })} />
              <div className="row-actions">
                <button className="primary" onClick={() => { onSave(editing); setEditing(null) }}>保存</button>
                <button onClick={() => setEditing(null)}>キャンセル</button>
                <button className="danger" onClick={() => { if (confirm('削除しますか？')) { onDelete(r.id); setEditing(null) } }}>削除</button>
              </div>
            </li>
          ) : (
            <li key={r.id}>
              <button className="record" onClick={() => { setCreating(null); setEditing(r) }}>
                <span className="muted small">{String(r.data.season ?? '')}</span>
                <span>{summarize(r)}</span>
                {articled.has(r.id) && <span className="badge done">記事化済</span>}
              </button>
            </li>
          ),
        )}
      </ul>
    </div>
  )
}
