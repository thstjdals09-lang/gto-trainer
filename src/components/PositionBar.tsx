import { POSITIONS, type StackDepth } from '../types'
import type { HistoryEntry } from '../engine/preflop'

const ACTION_LABEL: Record<string, string> = { fold: 'Fold', call: 'Call', raise: 'Raise', allin: 'Allin' }

interface Props {
  stack: StackDepth
  history: HistoryEntry[]
  activeSeatIndex: number | null
  clickable?: boolean
  onSelectSeat?: (seatIndex: number) => void
}

export default function PositionBar({ stack, history, activeSeatIndex, clickable, onSelectSeat }: Props) {
  const bySeat = new Map(history.map((h) => [h.seatIndex, h]))

  return (
    <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
      {POSITIONS.map((pos, i) => {
        const entry = bySeat.get(i)
        const isActive = activeSeatIndex === i
        const isClickable = clickable && !isActive
        return (
          <button
            key={pos}
            type="button"
            disabled={!isClickable}
            onClick={() => onSelectSeat?.(i)}
            className={`min-w-[84px] flex-1 rounded-lg border px-2 py-2 text-center transition-colors ${
              isActive
                ? 'border-violet-400 bg-violet-500/15'
                : entry
                ? 'border-white/10 bg-white/5'
                : 'border-white/5 bg-white/[0.02]'
            } ${isClickable ? 'cursor-pointer hover:border-violet-400/60 hover:bg-violet-500/10' : 'cursor-default'}`}
          >
            <div className="text-xs sm:text-sm font-semibold text-white">{pos}</div>
            <div className="text-[10px] text-white/40">{stack}bb</div>
            <div className={`mt-1 text-[11px] sm:text-xs font-medium ${entry ? 'text-white/80' : 'text-white/30'}`}>
              {entry ? `${ACTION_LABEL[entry.action]}${entry.sizeBB ? ` ${entry.sizeBB}` : ''}${entry.auto ? '*' : ''}` : isActive ? '결정 중' : '대기'}
            </div>
          </button>
        )
      })}
    </div>
  )
}
