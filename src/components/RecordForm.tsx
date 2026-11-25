import { FIELDS, type FieldValue, type RecordKind } from '../types'

interface Props {
  kind: RecordKind
  data: Record<string, FieldValue>
  onChange: (data: Record<string, FieldValue>) => void
}

/** 試合・移籍・成績・順位の共通入力フォーム */
export function RecordForm({ kind, data, onChange }: Props) {
  return (
    <div className="form-grid">
      {FIELDS[kind].map((f) => (
        <label key={f.key} className={f.wide ? 'field wide' : 'field'}>
          <span>{f.label}</span>
          <input
            type={f.type === 'number' ? 'number' : 'text'}
            inputMode={f.type === 'number' ? 'decimal' : undefined}
            step="any"
            value={data[f.key] ?? ''}
            placeholder={f.placeholder}
            onChange={(e) => {
              const raw = e.target.value
              const value: FieldValue = f.type === 'number' ? (raw === '' ? null : Number(raw)) : raw
              onChange({ ...data, [f.key]: value })
            }}
          />
        </label>
      ))}
    </div>
  )
}
