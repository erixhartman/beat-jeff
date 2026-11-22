import { useMemo, useState } from 'react'
import { useData, HCATS, PCATS, catLabel, norm, type League, type PoolPlayer, type Values } from './data.ts'

function Picker({ label, chosen, setChosen, pool }: { label: string; chosen: PoolPlayer[]; setChosen: (p: PoolPlayer[]) => void; pool: PoolPlayer[] }) {
  const [q, setQ] = useState('')
  const hits = useMemo(() => {
    const n = norm(q.trim())
    if (n.length < 2) return []
    return pool.filter(p => norm(p.name).includes(n) && !chosen.includes(p)).slice(0, 8)
  }, [q, pool, chosen])
  return (
    <div className="panel">
      <h4>{label}</h4>
      <input className="search" type="search" placeholder="Add a player" value={q} onChange={e => setQ(e.target.value)} aria-label={label} />
      {hits.length > 0 && (
        <ul style={{ listStyle: 'none', padding: 0, margin: '6px 0' }}>
          {hits.map(p => (
            <li key={p.g + p.name}>
              <button className="btn small" onClick={() => { setChosen([...chosen, p]); setQ('') }}>+ {p.name}</button>{' '}
              <span className="note">{p.pos.join(', ')} · {p.team}</span>
            </li>
          ))}
        </ul>
      )}
      <table className="stats" style={{ marginTop: 8 }}>
        <tbody>
          {chosen.map(p => (
            <tr key={p.g + p.name}>
              <td className="l name">{p.name}</td>
              <td className="l pos-chip">{p.pos.join(', ')}</td>
              <td className="val">{p.var?.toFixed(1) ?? '–'}</td>
              <td><button className="btn small" onClick={() => setChosen(chosen.filter(x => x !== p))} aria-label={`Remove ${p.name}`}>Remove</button></td>
            </tr>
          ))}
          {chosen.length === 0 && <tr><td className="l dim">Nobody yet.</td></tr>}
        </tbody>
      </table>
    </div>
  )
}

export default function Trades() {
  const v = useData<Values>('values.json')
  const lg = useData<League>('league.json')
  const [give, setGive] = useState<PoolPlayer[]>([])
  const [get, setGet] = useState<PoolPlayer[]>([])
  const [who, setWho] = useState('Eric')

  if (!v || !lg) return <p>Loading…</p>
  const sum = (ps: PoolPlayer[]) => ps.reduce((s, p) => s + (p.var ?? 0), 0)
  const net = sum(get) - sum(give)
  const cats = [...HCATS, ...PCATS]
  const delta = Object.fromEntries(cats.map(c => [c, get.reduce((s, p) => s + (p.z?.[c] ?? 0), 0) - give.reduce((s, p) => s + (p.z?.[c] ?? 0), 0)]))
  const all = [...give.map(p => ({ p, side: 'give' })), ...get.map(p => ({ p, side: 'get' }))]
  const best = all.sort((a, b) => (b.p.var ?? -99) - (a.p.var ?? -99))[0]
  const log = lg.trades.filter(t => who === 'All' || t.a === who || t.b === who).sort((x, y) => y.season - x.season)
  const people = ['All', ...Array.from(new Set(lg.trades.flatMap(t => [t.a, t.b]))).sort()]

  return (
    <section>
      <h2>Trade checker</h2>
      <p className="lede">
        Add both sides of a deal to see it in this league's terms: total league value and what it does to each category. It also checks the rule
        you broke in 7 of your last 12 trades: don't give up the best player in the deal unless the return clearly fixes a weak category.
      </p>
      <div className="split" style={{ gridTemplateColumns: '1fr 1fr' }}>
        <Picker label="You give" chosen={give} setChosen={setGive} pool={v.pool} />
        <Picker label="You get" chosen={get} setChosen={setGet} pool={v.pool} />
      </div>
      {give.length > 0 && get.length > 0 && (
        <div className="panel">
          <p className="bigline">
            {net >= 0 ? 'You gain' : 'You lose'} {Math.abs(net).toFixed(1)} in league value.
            {best && best.side === 'give' && <> The best player in this deal, {best.p.name}, is going the other way.</>}
          </p>
          <div className="table-wrap">
            <table className="stats">
              <thead><tr>{cats.map(c => <th key={c}>{catLabel(c)}</th>)}</tr></thead>
              <tbody>
                <tr>{cats.map(c => <td key={c} className={delta[c] >= 0.5 ? 'z-pos' : delta[c] <= -0.5 ? 'z-neg' : ''}>{(delta[c] > 0 ? '+' : '') + delta[c].toFixed(1)}</td>)}</tr>
              </tbody>
            </table>
          </div>
          <p className="note">Change in category score, from the same numbers as the Rankings tab. In 2026 your team ranked 12th in runs and 11th in HR and RBI, so a gain there is worth more to you than the totals suggest.</p>
        </div>
      )}

      <h3>Every trade since 2023</h3>
      <div className="controls">
        <label className="check">Manager{' '}
          <select className="search" style={{ minWidth: 0 }} value={who} onChange={e => setWho(e.target.value)}>
            {people.map(p => <option key={p}>{p}</option>)}
          </select>
        </label>
        <span className="note">{log.length} trades. Numbers in brackets are each player's final Yahoo rank that season.</span>
      </div>
      <div className="table-wrap">
        <table className="stats">
          <thead><tr><th className="l">Season</th><th className="l">Date</th><th className="l">Manager</th><th className="l">Got</th><th className="l">Manager</th><th className="l">Got</th></tr></thead>
          <tbody>
            {log.map((t, i) => (
              <tr key={i}>
                <td className="l">{t.season}</td><td className="l dim">{t.date}</td>
                <td className="l name">{t.a}</td><td className="l">{t.aGot.map(([n, r]) => `${n}${r ? ` (${r})` : ''}`).join(', ')}</td>
                <td className="l name">{t.b}</td><td className="l">{t.bGot.map(([n, r]) => `${n}${r ? ` (${r})` : ''}`).join(', ')}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}
