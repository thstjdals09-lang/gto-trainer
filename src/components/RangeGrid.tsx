import { useMemo } from 'react'
import { comboCount, generateHandGrid, type PokerAction } from '../types'
import { getDisplayCell } from '../engine/chart'
import type { Chart } from '../types'
import type { CellMode } from '../engine/preflop'

const ACTION_COLOR: Record<PokerAction, string> = {
  fold: '#28344a',
  call: '#d4a72c',
  raise: '#dc2626',
  allin: '#7f1d1d',
}

const ACTION_LABEL: Record<PokerAction, string> = {
  fold: 'Fold',
  call: 'Call',
  raise: 'Raise',
  allin: 'Allin',
}

interface Props {
  chart: Chart
  cellMode: CellMode
  onHandHover?: (hand: string | null) => void
}

const grid = generateHandGrid()

export default function RangeGrid({ chart, cellMode }: Props) {
  const totals = useMemo(() => {
    const sums: Partial<Record<PokerAction, number>> = { fold: 0, call: 0, raise: 0, allin: 0 }
    let totalCombos = 0
    for (const row of grid) {
      for (const hand of row) {
        const combos = comboCount(hand)
        totalCombos += combos
        const cell = getDisplayCell(chart, hand.name, cellMode)
        const foldPct = 100 - cell.weight
        sums.fold = (sums.fold ?? 0) + (combos * foldPct) / 100
        for (const action of ['call', 'raise', 'allin'] as PokerAction[]) {
          const pct = (cell.weight * (cell.actions[action] ?? 0)) / 100
          sums[action] = (sums[action] ?? 0) + (combos * pct) / 100
        }
      }
    }
    return { sums, totalCombos }
  }, [chart, cellMode])

  return (
    <div className="flex flex-col gap-3">
      <div
        className="grid gap-[2px] w-full select-none"
        style={{ aspectRatio: '1 / 1', gridTemplateColumns: 'repeat(13, minmax(0, 1fr))' }}
      >
        {grid.flatMap((row) =>
          row.map((hand) => {
            const cell = getDisplayCell(chart, hand.name, cellMode)
            const segments: { action: PokerAction; pct: number }[] = []
            const foldPct = 100 - cell.weight
            for (const action of ['allin', 'raise', 'call'] as PokerAction[]) {
              const pct = (cell.weight * (cell.actions[action] ?? 0)) / 100
              if (pct > 0.001) segments.push({ action, pct })
            }
            if (foldPct > 0.001) segments.push({ action: 'fold', pct: foldPct })
            return (
              <div
                key={hand.name}
                title={hand.name}
                className="relative flex overflow-hidden rounded-[2px] text-[6px] xs:text-[7px] sm:text-[9px] font-medium text-white/90"
                style={{ background: ACTION_COLOR.fold }}
              >
                {segments.map((seg, i) => (
                  <div key={i} style={{ width: `${seg.pct}%`, background: ACTION_COLOR[seg.action] }} />
                ))}
                <span className="absolute inset-0 flex items-center justify-center drop-shadow-[0_1px_1px_rgba(0,0,0,0.9)] pointer-events-none">
                  {hand.name}
                </span>
              </div>
            )
          })
        )}
      </div>
      <div className="flex flex-wrap gap-3 text-xs sm:text-sm">
        {(['allin', 'raise', 'call', 'fold'] as PokerAction[]).map((action) => {
          const combos = totals.sums[action] ?? 0
          if (combos <= 0.01) return null
          const pct = (combos / totals.totalCombos) * 100
          return (
            <div key={action} className="flex items-center gap-1.5 rounded bg-white/5 px-2 py-1">
              <span className="h-2.5 w-2.5 rounded-sm" style={{ background: ACTION_COLOR[action] }} />
              <span className="text-white/80">{ACTION_LABEL[action]}</span>
              <span className="font-semibold text-white">{pct.toFixed(1)}%</span>
              <span className="text-white/40">{combos.toFixed(0)}combo</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
