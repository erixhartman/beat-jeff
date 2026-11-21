import { useEffect, useState } from 'react'

export const HCATS = ['R', 'HR', 'RBI', 'SB', 'AVG', 'OPS'] as const
export const PCATS = ['W', 'SV', 'K', 'ERA', 'WHIP', 'KBB'] as const
export type Cat = (typeof HCATS)[number] | (typeof PCATS)[number]
export const CAT_LABEL: Record<string, string> = { KBB: 'K/BB' }
export const catLabel = (c: string) => CAT_LABEL[c] ?? c

export type Z = Partial<Record<Cat, number>>

export interface Hitter {
  id: number; name: string; team: string; pos: string[]
  ab: number; pa: number; g: number; R: number; HR: number; RBI: number; SB: number
  AVG: number; OPS: number; OBP: number; SLG: number
  z: Z; value: number; equal: number; rank: number; equalRank: number
  nbc: number | null; yahoo: number | null; owner: string | null; small: boolean
}
export interface Pitcher {
  id: number; name: string; team: string; pos: string[]
  ip: number; ipDisp: string; W: number; SV: number; K: number; BB: number; HLD: number
  ERA: number; WHIP: number; KBB: number; gs: number; g: number
  z: Z; value: number; equal: number; rank: number; equalRank: number
  nbc: number | null; pl: number | null; yahoo: number | null; owner: string | null; small: boolean
}
export interface PoolPlayer { name: string; g: 'B' | 'P'; pos: string[]; team: string; value: number | null; rank: number | null; z: Z | null }
export interface Values {
  asOf: string; weights: Record<Cat, number>; corr: Record<Cat, number>
  hitters: Hitter[]; pitchers: Pitcher[]; pool: PoolPlayer[]
}
export interface BoardPlayer extends PoolPlayer { nbc?: number; pl?: number; est: number; estFrom: string }

export interface Season {
  season: number; team: string; finish: number; record: string
  adds: number; spAdds: number; rpAdds: number; hAdds: number
  trades: number; partners: [string, number][]
  firstSP: number | null; firstRP: number | null; hittersR1to5: number; firstPicks: string[]
  catRanks: Record<string, number>
}
export interface TradeRow { season: number; date: string; a: string; aGot: [string, number | null][]; b: string; bGot: [string, number | null][] }
export interface League {
  roster2027: string[]; team2026: Record<string, string>
  managers: Record<string, Season[]>; trades: TradeRow[]
  tendencies: { rounds: string; n: number; share: Record<string, number>; H: Tend; SP: Tend; RP: Tend }[]
  steals: Pick[]; busts: Pick[]
  runs: { season: number; firstRP: number; fifthRP: number; firstSP: number; twelfthSP: number }[]
  mySlot: number; myPicks: number[]
}
interface Tend { n: number; median: number | null; top100: number | null }
interface Pick { season: number; round: number; player: string; rank: number; by: string }

export interface WeekTeam { team: string; HAB: string; R: string; HR: string; RBI: string; SB: string; AVG: string; OPS: string; IP: string; W: string; SV: string; K: string; ERA: string; WHIP: string; KBB: string }
export interface JeffData {
  seasons: { season: number; eric: string; jeff: string; weeks: { week: number; eric: Record<string, number>; jeff: Record<string, number>; w: number; l: number; t: number; actual: boolean; ericAllPlay: [number, number, number]; jeffAllPlay: [number, number, number] }[] }[]
  updated: string
}
export interface WeekData {
  status: 'preseason' | 'live'; updated: string; week?: number; opponent?: string
  me?: Record<string, string>; them?: Record<string, string>
  twoStart?: { name: string; team: string; dates: string[] }[]
  message?: string
}

const cache = new Map<string, Promise<unknown>>()
export function useData<T>(file: string): T | null {
  const [d, setD] = useState<T | null>(null)
  useEffect(() => {
    if (!cache.has(file)) cache.set(file, fetch(`/data/${file}`).then(r => r.json()))
    let live = true
    ;(cache.get(file) as Promise<T>).then(v => { if (live) setD(v) })
    return () => { live = false }
  }, [file])
  return d
}

export const fmt3 = (n: number) => n.toFixed(3).replace(/^0/, '')
export const fmt2 = (n: number) => n.toFixed(2)
export const signed = (n: number) => (n > 0 ? '+' : '') + n.toFixed(1)
export const norm = (s: string) => s.normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase()

export function load<T>(key: string, fallback: T): T {
  try { const v = localStorage.getItem(key); return v ? (JSON.parse(v) as T) : fallback } catch { return fallback }
}
export function save(key: string, v: unknown) {
  try { localStorage.setItem(key, JSON.stringify(v)) } catch { /* private mode: board resets on reload */ }
}
