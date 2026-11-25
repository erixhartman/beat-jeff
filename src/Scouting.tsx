import { useData, type League } from './data.ts'

// My read of each manager, from their 2023–26 drafts, pickups and trades. Opinions, not data.
const NOTES: Record<string, string[]> = {
  Jeff: [
    'Takes four or five hitters in rounds 1–5 and his first starter in rounds 5–7. He has not drafted a closer in four drafts.',
    'Streams starters harder than anyone: 36–49% of his pickups are SPs, and almost none are relievers.',
    'Trades rarely and mostly with Jonny. He took Witt off you in 2025.',
    'How to beat him: you won’t out-hit him by copying him. Beat him on WHIP, ERA and K/BB, and in your matchup weeks stream for ratios, not strikeouts.',
  ],
  Chad: [
    'The dealer: 11–17 trades in three of four seasons, 16 of them with Jonny.',
    'Hitters first, but he takes a closer earlier than most (rounds 5–8).',
    'Sharp. Three of your four trades with him went his way, so only deal with him when the edge is obvious.',
  ],
  Jonny: [
    'Most trades in the league every year (15–26) and finished 11th, 12th and 12th the last three years.',
    'Drafts hitters early (De La Cruz, Henderson, Vlad) and churns the roster all season.',
    'Your best source of talent. He’ll take two-for-one deals; aim them so you get the best player back.',
  ],
  Wes: [
    'Back for 2027 in place of Kyle. In 2023–24 he made 29 trades, 14 of them with Jonny.',
    'First starter in rounds 3–4, closer around round 6–7.',
    'A willing partner who finished 9th and 10th. Get to him early in the season, before Jonny does.',
  ],
  'Ben U': [
    'Won 2026 with Skubal in round 1. One trade in 2023 and 2026, three in 2025; the 10 in 2024 came while he ran Operation Vamos.',
    'Chases saves on waivers: 19% of his 2026 pickups were relievers, the most in the league.',
    'Hard to trade with. When a closer job opens, expect him to be first to the claim.',
  ],
  'Ben F': [
    'Reaches for aces: an SP in round 1 or 2 in three of four drafts (Strider, Burnes, Yamamoto, Sale).',
    'Busy on waivers, finishes in the middle (7th, 6th, 9th, 7th).',
    'Every ace he takes early pushes a bat down the board, which helps the picks after him.',
  ],
  Daniel: [
    'Patient: two to five trades a year. Takes a starter by round 2–4 and closers late.',
    'Mostly hitter pickups in 2025–26. Open to one-for-one deals but not a volume trader.',
  ],
  Doug: [
    'One to four trades a year. Takes a starter by round 2–3 most years.',
    'Up and down: 11th, 2nd, 8th, 11th. Two of his round 2–3 picks busted in 2026 (Crochet, Lindor).',
  ],
  Eugene: [
    'Replaced Colton in 2025 and finished 3rd in 2026.',
    'Streams like Jeff (40% of 2026 pickups were starters) and drafts closers late.',
    'Expect him to compete with you and Jeff for two-start pitchers on Sunday nights.',
  ],
  Andy: [
    'Takes a starter in round 2 every year (Yamamoto, Skenes, Gilbert) and a closer by round 5–6.',
    'Moderate on every measure. Normal negotiation.',
  ],
  'Lee & Stevie': [
    'Two managers on one team. Their 2026 rounds 1–3 (Judge, Raleigh, Hunter Brown) all busted.',
    'Ten trades in 2026, including two with you (the Olson/Imanaga and Bichette deals).',
  ],
}
const CATS = ['R', 'HR', 'RBI', 'SB', 'AVG', 'OPS', 'W', 'SV', 'K', 'ERA', 'WHIP', 'K/BB']

export default function Scouting() {
  const lg = useData<League>('league.json')
  if (!lg) return <p>Loading…</p>
  return (
    <section>
      <h2>Scouting the room</h2>
      <p className="lede">
        Every 2027 rival: how they've finished, how they draft, how they use waivers and who they trade with. The bullet points are my read of the
        numbers; the tables are the numbers.
      </p>
      {lg.roster2027.map(m => {
        const hist = lg.managers[m] ?? []
        const last = hist[hist.length - 1]
        const weak = last ? CATS.map(c => [c, last.catRanks[c]] as const).filter(x => x[1] != null).sort((a, b) => b[1] - a[1]).slice(0, 3) : []
        const partners = new Map<string, number>()
        hist.forEach(s => s.partners.forEach(([p, n]) => partners.set(p, (partners.get(p) ?? 0) + n)))
        const top = [...partners.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3)
        return (
          <article className="scout" key={m} id={`m-${m.replace(/\W/g, '')}`}>
            <header>
              <h3>{m}</h3>
              <span className="team">{m === 'Wes' ? 'Takes over O.M.G. for 2027' : lg.team2026[m]}</span>
            </header>
            <ul>{(NOTES[m] ?? []).map((n, i) => <li key={i}>{n}</li>)}</ul>
            <p className="note">
              {top.length > 0 && <>Most frequent trade partners: {top.map(([p, n]) => `${p} (${n})`).join(', ')}. </>}
              {last && <>Weakest categories in {last.season}: {weak.map(([c, r]) => `${c} (#${r})`).join(', ')}.</>}
            </p>
            <details className="how">
            <summary>Show the numbers</summary>
            <div className="table-wrap" tabIndex={0}>
              <table className="stats">
                <thead>
                  <tr>
                    <th className="l">Season</th><th className="l">Team</th><th>Finish</th><th>Record</th>
                    <th>Pickups</th><th>SP %</th><th>RP %</th><th>Trades</th>
                    <th>1st SP rd</th><th>1st closer rd</th><th>Bats in rds 1–5</th><th className="l">First three picks</th>
                  </tr>
                </thead>
                <tbody>
                  {hist.map(s => (
                    <tr key={s.season}>
                      <td className="l">{s.season}</td><td className="l dim">{s.team}</td><td className="val">{s.finish}</td><td className="dim">{s.record}</td>
                      <td>{s.adds}</td><td>{s.spAdds}</td><td>{s.rpAdds}</td><td>{s.trades}</td>
                      <td>{s.firstSP ?? '–'}</td><td>{s.firstRP ?? 'none'}</td><td>{s.hittersR1to5}</td>
                      <td className="l dim">{s.firstPicks.slice(0, 3).join(', ')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            </details>
          </article>
        )
      })}
      <p className="note" style={{ marginTop: 30 }}>
        Closer = a drafted pitcher who finished that season with 10+ saves. Pickup shares count pure starters and pure relievers; two-way SP/RP players are left out.
        Loose Juice (2023) is the one team we couldn't match to a manager.
      </p>
    </section>
  )
}
