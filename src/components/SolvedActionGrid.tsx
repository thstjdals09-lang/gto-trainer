import { getDisplayCell } from '../engine/chart'
import type { CellMode } from '../engine/preflop'
import type { StreetAction } from '../engine/postflopSolver'
import type { GridCellStrategy } from '../engine/solverBridge'
import { ACTION_COLOR, POSTFLOP_ACTION_COLOR } from '../theme'
import { generateHandGrid, type Chart, type PokerAction } from '../types'

interface Props {
  grid: Record<string, GridCellStrategy>
  activeHand?: string | null
  onHandActive?: (hand: string) => void
  /** The viewed seat's last preflop decision — lets hands outside this street's range still show
   * a real color (what they actually did preflop) instead of going flat/empty. */
  preflopChart?: Chart
  preflopCellMode?: CellMode
}

const handGrid = generateHandGrid()
const ORDER: StreetAction[] = ['bet-big', 'bet-small', 'check']
const PREFLOP_ORDER: PokerAction[] = ['allin', 'raise', 'call', 'fold']
const FOLD_COLOR = '#1a1c24'

export default function SolvedActionGrid({ grid, activeHand, onHandActive, preflopChart, preflopCellMode }: Props) {
  return (
    <div
      className="grid gap-[2px] w-full select-none"
      style={{ aspectRatio: '1 / 1', gridTemplateColumns: 'repeat(13, minmax(0, 1fr))' }}
    >
      {handGrid.flatMap((row) =>
        row.map((hand) => {
          const cell = grid[hand.name]
          const inRange = cell && cell.weight > 0
          const segments: { color: string; pct: number }[] = []

          if (cell) {
            for (const a of ORDER) {
              const pct = cell.actions[a] ?? 0
              if (pct > 0.001) segments.push({ color: POSTFLOP_ACTION_COLOR[a as keyof typeof POSTFLOP_ACTION_COLOR], pct })
            }
          } else if (preflopChart && preflopCellMode) {
            // Not part of this street's range — show what this hand actually did preflop instead
            // of leaving the cell blank (e.g. AKs vs a single open goes 100% allin, not "fold").
            const preflopCell = getDisplayCell(preflopChart, hand.name, preflopCellMode)
            const foldPct = Math.max(0, 100 - preflopCell.weight)
            for (const a of PREFLOP_ORDER) {
              const pct = a === 'fold' ? foldPct : (preflopCell.weight * (preflopCell.actions[a] ?? 0)) / 100
              if (pct > 0.001) segments.push({ color: ACTION_COLOR[a], pct })
            }
          }

          return (
            <div
              key={hand.name}
              title={hand.name}
              onMouseEnter={() => onHandActive?.(hand.name)}
              onClick={() => onHandActive?.(hand.name)}
              className={`relative flex overflow-hidden rounded-[2px] text-[6px] xs:text-[7px] sm:text-[9px] font-medium text-white/90 cursor-pointer ${
                activeHand === hand.name ? 'ring-2 ring-white' : ''
              }`}
              style={{ background: FOLD_COLOR, opacity: inRange ? 1 : 0.45 }}
            >
              {segments.map((seg, i) => (
                <div key={i} style={{ width: `${seg.pct}%`, background: seg.color }} />
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
