import type { StreetAction } from '../engine/postflopSolver'
import type { GridCellStrategy } from '../engine/solverBridge'
import { POSTFLOP_ACTION_COLOR } from '../theme'
import { generateHandGrid } from '../types'

interface Props {
  grid: Record<string, GridCellStrategy>
}

const handGrid = generateHandGrid()
const ORDER: StreetAction[] = ['bet-big', 'bet-small', 'check']
const FOLD_COLOR = '#1a1c24'

export default function SolvedActionGrid({ grid }: Props) {
  return (
    <div
      className="grid gap-[2px] w-full select-none"
      style={{ aspectRatio: '1 / 1', gridTemplateColumns: 'repeat(13, minmax(0, 1fr))' }}
    >
      {handGrid.flatMap((row) =>
        row.map((hand) => {
          const cell = grid[hand.name]
          const inRange = cell && cell.weight > 0
          const segments: { action: StreetAction; pct: number }[] = []
          if (cell) {
            for (const a of ORDER) {
              const pct = cell.actions[a] ?? 0
              if (pct > 0.001) segments.push({ action: a, pct })
            }
          }
          return (
            <div
              key={hand.name}
              title={hand.name}
              className="relative flex overflow-hidden rounded-[2px] text-[6px] xs:text-[7px] sm:text-[9px] font-medium text-white/90"
              style={{ background: FOLD_COLOR, opacity: inRange ? 1 : 0.15 }}
            >
              {segments.map((seg, i) => (
                <div key={i} style={{ width: `${seg.pct}%`, background: POSTFLOP_ACTION_COLOR[seg.action as keyof typeof POSTFLOP_ACTION_COLOR] }} />
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
