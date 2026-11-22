import { useEffect, useState } from 'react'
import Rankings from './Rankings.tsx'
import Board from './Board.tsx'
import Tendencies from './Tendencies.tsx'
import Scouting from './Scouting.tsx'
import Trades from './Trades.tsx'
import Week from './Week.tsx'
import BeatJeff from './BeatJeff.tsx'
import RotoTab from './Roto.tsx'
import Memo from './Memo.tsx'

const TABS = [
  { id: 'jeff', label: 'Beat Jeff', el: <BeatJeff /> },
  { id: 'rankings', label: 'Rankings', el: <Rankings /> },
  { id: 'board', label: 'Draft board', el: <Board /> },
  { id: 'tendencies', label: 'How we draft', el: <Tendencies /> },
  { id: 'scouting', label: 'Scouting', el: <Scouting /> },
  { id: 'trades', label: 'Trades', el: <Trades /> },
  { id: 'roto', label: 'Roto', el: <RotoTab /> },
  { id: 'week', label: 'This week', el: <Week /> },
  { id: 'memo', label: 'Memo', el: <Memo /> },
]

function current() {
  const h = location.hash.replace('#', '')
  return TABS.some(t => t.id === h) ? h : 'jeff'
}

export default function App() {
  const [tab, setTab] = useState(current)
  useEffect(() => {
    const on = () => { setTab(current()); window.scrollTo(0, 0) }
    addEventListener('hashchange', on)
    return () => removeEventListener('hashchange', on)
  }, [])
  const active = TABS.find(t => t.id === tab)!
  useEffect(() => { document.title = tab === 'jeff' ? 'Beat Jeff' : `${active.label} · Beat Jeff` }, [tab, active.label])
  return (
    <>
      <header className="mast">
        <div className="mast-inner">
          <h1 className="wordmark">Beat <span>Jeff</span></h1>
          <p className="mast-meta">Draft and season planner for Jeters Never Prosper, a 12-team Yahoo H2H league.</p>
          <nav className="tabs" aria-label="Sections">
            {TABS.map(t => (
              <a key={t.id} href={`#${t.id}`} aria-current={t.id === tab ? 'page' : undefined}>{t.label}</a>
            ))}
          </nav>
        </div>
      </header>
      <main>{active.el}</main>
      <footer className="site">
        Built by Eric Hartman with Claude. League data from the league's public Yahoo pages (2023–26); 2026 stats from the MLB Stats API;
        2027 ranks from NBC/Rotoworld and Pitcher List. Not affiliated with Yahoo or MLB.
      </footer>
    </>
  )
}
