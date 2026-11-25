import { useMemo, useState } from 'react'
import { myMatches } from '../analysis'
import type { AppData, FieldValue, RecordKind } from '../types'

interface Props {
  data: AppData
  mode: 'match' | 'transfer'
  onSubmit: (kind: RecordKind, data: Record<string, FieldValue>) => void
  onClose: () => void
}

/** 自分のクラブ視点で、試合結果や移籍を最小限の項目で素早く入力するフォーム */
export function QuickAdd({ data, mode, onSubmit, onClose }: Props) {
  const { myClub, season } = data.settings
  const past = useMemo(() => myMatches(data.records, myClub, season), [data.records, myClub, season])
  const last = past[past.length - 1]?.record.data
  const lastComp = String(last?.competition ?? '')
  const nextRound = useMemo(() => {
    const m = String(last?.round ?? '').match(/(\d+)/)
    return m ? String(last?.round).replace(m[1], String(Number(m[1]) + 1)) : `第${past.length + 1}節`
  }, [last, past.length])

  const [m, setM] = useState({ competition: lastComp, round: nextRound, home: true, opponent: '', my: '', opp: '', scorers: '', note: '' })
  const [t, setT] = useState({ dir: 'in' as 'in' | 'out', player: '', position: '', age: '', club: '', fee: '', type: '完全移籍', note: '' })

  if (!myClub) {
    return (
      <div className="panel">
        <p>先に「設定」で監督しているクラブを入力してください。</p>
        <button onClick={onClose}>閉じる</button>
      </div>
    )
  }

  if (mode === 'match') {
    const valid = m.opponent.trim() && m.my !== '' && m.opp !== ''
    const submit = () => {
      const scorers = m.scorers
        .split(/[,、，]/)
        .map((x) => x.trim())
        .filter(Boolean)
        .map((x) => `${x}(${myClub})`)
        .join(', ')
      onSubmit('match', {
        season,
        date: null,
        competition: m.competition || null,
        round: m.round || null,
        home: m.home ? myClub : m.opponent.trim(),
        away: m.home ? m.opponent.trim() : myClub,
        homeScore: Number(m.home ? m.my : m.opp),
        awayScore: Number(m.home ? m.opp : m.my),
        scorers: scorers || null,
        note: m.note || null,
      })
    }
    return (
      <div className="panel">
        <h3>試合結果をかんたん入力</h3>
        <div className="form-grid">
          <label className="field">
            <span>大会</span>
            <input value={m.competition} onChange={(e) => setM({ ...m, competition: e.target.value })} placeholder="プレミアリーグ" />
          </label>
          <label className="field">
            <span>節</span>
            <input value={m.round} onChange={(e) => setM({ ...m, round: e.target.value })} />
          </label>
          <div className="field wide">
            <span>会場</span>
            <div className="segmented">
              <button className={m.home ? 'active' : ''} onClick={() => setM({ ...m, home: true })}>ホーム</button>
              <button className={!m.home ? 'active' : ''} onClick={() => setM({ ...m, home: false })}>アウェー</button>
            </div>
          </div>
          <label className="field wide">
            <span>対戦相手</span>
            <input value={m.opponent} onChange={(e) => setM({ ...m, opponent: e.target.value })} />
          </label>
          <label className="field">
            <span>{myClub}</span>
            <input type="number" inputMode="numeric" min={0} value={m.my} onChange={(e) => setM({ ...m, my: e.target.value })} />
          </label>
          <label className="field">
            <span>相手</span>
            <input type="number" inputMode="numeric" min={0} value={m.opp} onChange={(e) => setM({ ...m, opp: e.target.value })} />
          </label>
          <label className="field wide">
            <span>自チームの得点者（カンマ区切り・同じ人は複数回）</span>
            <input value={m.scorers} onChange={(e) => setM({ ...m, scorers: e.target.value })} placeholder="Saka, Saka, Havertz" />
          </label>
          <label className="field wide">
            <span>メモ（任意）</span>
            <input value={m.note} onChange={(e) => setM({ ...m, note: e.target.value })} placeholder="MOM、退場、ケガ人など" />
          </label>
        </div>
        <div className="row-actions">
          <button className="primary" disabled={!valid} onClick={submit}>登録</button>
          <button onClick={onClose}>閉じる</button>
        </div>
      </div>
    )
  }

  const valid = t.player.trim() && t.club.trim()
  const submit = () =>
    onSubmit('transfer', {
      season,
      date: null,
      player: t.player.trim(),
      position: t.position || null,
      age: t.age === '' ? null : Number(t.age),
      from: t.dir === 'in' ? t.club.trim() : myClub,
      to: t.dir === 'in' ? myClub : t.club.trim(),
      fee: t.fee || null,
      type: t.type,
      note: t.note || null,
    })
  return (
    <div className="panel">
      <h3>移籍をかんたん入力</h3>
      <div className="form-grid">
        <div className="field wide">
          <span>種類</span>
          <div className="segmented">
            <button className={t.dir === 'in' ? 'active' : ''} onClick={() => setT({ ...t, dir: 'in' })}>獲得（IN）</button>
            <button className={t.dir === 'out' ? 'active' : ''} onClick={() => setT({ ...t, dir: 'out' })}>放出（OUT）</button>
          </div>
        </div>
        <label className="field wide">
          <span>選手</span>
          <input value={t.player} onChange={(e) => setT({ ...t, player: e.target.value })} />
        </label>
        <label className="field">
          <span>ポジション</span>
          <input value={t.position} onChange={(e) => setT({ ...t, position: e.target.value })} placeholder="FW" />
        </label>
        <label className="field">
          <span>年齢</span>
          <input type="number" inputMode="numeric" value={t.age} onChange={(e) => setT({ ...t, age: e.target.value })} />
        </label>
        <label className="field wide">
          <span>{t.dir === 'in' ? '移籍元' : '移籍先'}</span>
          <input value={t.club} onChange={(e) => setT({ ...t, club: e.target.value })} />
        </label>
        <label className="field">
          <span>移籍金</span>
          <input value={t.fee} onChange={(e) => setT({ ...t, fee: e.target.value })} placeholder="£45M" />
        </label>
        <label className="field">
          <span>形態</span>
          <select value={t.type} onChange={(e) => setT({ ...t, type: e.target.value })}>
            <option>完全移籍</option>
            <option>レンタル</option>
            <option>フリー</option>
            <option>契約延長</option>
          </select>
        </label>
        <label className="field wide">
          <span>メモ（任意）</span>
          <input value={t.note} onChange={(e) => setT({ ...t, note: e.target.value })} />
        </label>
      </div>
      <div className="row-actions">
        <button className="primary" disabled={!valid} onClick={submit}>登録</button>
        <button onClick={onClose}>閉じる</button>
      </div>
    </div>
  )
}
