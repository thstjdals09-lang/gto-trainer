import { generateHandGrid, type PokerAction } from '../types'
import { getDisplayCell } from '../engine/chart'
import { ACTION_COLOR } from '../theme'
import type { Chart } from '../types'
import type { CellMode } from '../engine/preflop'

interface Props {
  chart: Chart
  cellMode: CellMode
}

const grid = generateHandGrid()

export default function RangeGrid({ chart, cellMode }: Props) {
  return (
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
  )
}
