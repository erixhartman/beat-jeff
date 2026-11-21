import { useEffect, useState } from 'react'
import { load, save } from './data.ts'

// Eric's Monday memo. It lives in the private beat-jeff-memo repo and is read straight from GitHub with
// a read-only token Eric enters once per device. Without the token there's nothing here to see.
const KEY = 'beatjeff.memoToken'
const URL = 'https://api.github.com/repos/erixhartman/beat-jeff-memo/contents/data/latest.json'
const CATS = ['R', 'HR', 'RBI', 'SB', 'AVG', 'OPS', 'W', 'SV', 'K', 'ERA', 'WHIP', 'K/BB']

interface Card { name: string; why: string }
interface MemoData {
  status: 'live' | 'waiting'; message?: string; generated?: string; season?: number; week?: number; team?: string; opponent?: string
  plan?: string[]; matchup?: { mine: Record<string, number>; theirs: Record<string, number>; closest: string[] }
  lineup?: string[]; waivers?: { hitters: Card[]; twoStart: Card[]; relievers: Card[] }; post?: string
  trades?: { team: string; manager: string | null; get: string; give: string; why: string }[]; watch?: string[]
}

export default function Memo() {
  const demo = new URLSearchParams(location.search).has('demo')
  const [token, setToken] = useState<string>(() => load<string>(KEY, ''))
  const [draft, setDraft] = useState('')
  const [memo, setMemo] = useState<MemoData | null>(null)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (demo) { fetch('/data/memo-sample.json').then(r => r.json()).then(setMemo); return }
    if (!token) return
    setError('')
    fetch(URL, { headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github.raw+json', 'X-GitHub-Api-Version': '2022-11-28' } })
      .then(async r => {
        if (r.status === 401 || r.status === 403 || r.status === 404) throw new Error('GitHub didn’t accept that token. It needs read access to the beat-jeff-memo repo.')
        if (!r.ok) throw new Error(`GitHub answered ${r.status}. Try again in a minute.`)
        return r.json()
      })
      .then(setMemo)
      .catch(e => setError(e.message))
  }, [token, demo])

  const signIn = (e: React.FormEvent) => { e.preventDefault(); const t = draft.trim(); if (t) { save(KEY, t); setToken(t); setDraft('') } }
  const signOut = () => { save(KEY, ''); setToken(''); setMemo(null) }

  if (!demo && (!token || error)) {
    return (
      <section>
        <h2>Monday memo</h2>
        <p className="lede">Eric's private weekly plan. Enter the GitHub token to read it.</p>
        <form className="controls" onSubmit={signIn}>
          <input className="search" type="password" autoComplete="off" placeholder="GitHub token" value={draft} onChange={e => setDraft(e.target.value)} aria-label="GitHub token" style={{ minWidth: 320 }} />
          <button className="btn primary" type="submit">Open memo</button>
        </form>
        {error && <p className="mine-note">{error}</p>}
        <p className="note">The token stays in this browser. It only needs read access to one private repo. Curious what's in it? <a href="/?demo#memo">See a sample from 2026</a>.</p>
      </section>
    )
  }
  if (!memo) return <p>Loading the memo…</p>
  if (memo.status !== 'live') {
    return (
      <section>
        <h2>Monday memo</h2>
        <p className="lede">{memo.message}</p>
        {!demo && <button className="btn" onClick={signOut}>Forget token on this device</button>}
      </section>
    )
  }

  const copy = () => { navigator.clipboard?.writeText(memo.post ?? '').then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000) }) }
  return (
    <section>
      <h2>Week {memo.week}: {memo.team} vs. {memo.opponent}</h2>
      <p className="note" style={{ marginTop: 0 }}>{demo ? 'Sample memo, built from 2026 week 15. ' : ''}Written {memo.generated}.</p>

      <div className="split">
        <div>
          <h3>This week's plan</h3>
          <ol className="lede" style={{ paddingLeft: 22 }}>{memo.plan?.map((p, i) => <li key={i}>{p}</li>)}</ol>

          <h3>Lineup calls</h3>
          <ul className="lede" style={{ paddingLeft: 22 }}>{memo.lineup?.map((p, i) => <li key={i}>{p}</li>)}</ul>

          <h3>Waiver scout</h3>
          <p className="note" style={{ marginTop: 0 }}>Last 14 days, scored on this league's weights and tilted toward your weakest categories.</p>
          <div className="table-wrap">
            <table className="stats">
              <thead><tr><th className="l">Type</th><th className="l">Player</th><th className="l">Why</th></tr></thead>
              <tbody>
                {(['hitters', 'twoStart', 'relievers'] as const).flatMap(k => (memo.waivers?.[k] ?? []).map((c, i) => (
                  <tr key={k + c.name}><td className="l dim">{i === 0 ? (k === 'hitters' ? 'Bats' : k === 'twoStart' ? 'Two-start SP' : 'Relievers') : ''}</td><td className="l name">{c.name}</td><td className="l">{c.why}</td></tr>
                )))}
              </tbody>
            </table>
          </div>

          <h3>Trade ideas</h3>
          {memo.trades?.length ? (
            <div className="table-wrap">
              <table className="stats">
                <thead><tr><th className="l">Team</th><th className="l">Ask for</th><th className="l">Offer</th><th className="l">Why it fits</th></tr></thead>
                <tbody>{memo.trades.map(t => (
                  <tr key={t.team}><td className="l name">{t.team}{t.manager && <span className="small-flag">{t.manager}</span>}</td><td className="l">{t.get}</td><td className="l">{t.give}</td><td className="l dim">{t.why}</td></tr>
                ))}</tbody>
              </table>
            </div>
          ) : <p className="note">No clean fits this week.</p>}

          <h3>Rival watch</h3>
          <ul className="lede" style={{ paddingLeft: 22 }}>{memo.watch?.map((p, i) => <li key={i}>{p}</li>)}</ul>
        </div>

        <aside className="side">
          <div className="panel">
            <h4>Category ranks, season to date</h4>
            <table className="stats" style={{ fontSize: 14 }}>
              <thead><tr><th className="l">Cat</th><th>You</th><th>Them</th></tr></thead>
              <tbody>{CATS.map(c => {
                const a = memo.matchup?.mine[c], b = memo.matchup?.theirs[c]
                const close = memo.matchup?.closest.includes(c)
                return <tr key={c}><td className="l">{c}{close && <span className="small-flag">close</span>}</td>
                  <td className={a != null && b != null ? (a < b ? 'z-pos' : a > b ? 'z-neg' : '') : ''}>{a ?? '–'}</td><td className="dim">{b ?? '–'}</td></tr>
              })}</tbody>
            </table>
            <p className="note">1 = best in the league. Close = within one place of each other.</p>
          </div>
          <div className="panel">
            <h4>For the league chat</h4>
            <p style={{ font: '500 15px/1.45 var(--font-table)', margin: '0 0 10px' }}>{memo.post}</p>
            <button className="btn" onClick={copy}>{copied ? 'Copied' : 'Copy post'}</button>
          </div>
          {!demo && <button className="btn" onClick={signOut}>Forget token on this device</button>}
        </aside>
      </div>
    </section>
  )
}
