import { handActionDistribution, type HandRangeEntry, type PostflopAction } from '../engine/postflop'
import { POSTFLOP_ACTION_COLOR } from '../theme'
import { generateHandGrid } from '../types'

interface Props {
  entries: HandRangeEntry[]
}

const grid = generateHandGrid()
const FOLD_COLOR = '#1a1c24'

export default function PostflopActionGrid({ entries }: Props) {
  const byHand = new Map(entries.map((e) => [e.hand, e]))

  return (
    <div
      className="grid gap-[2px] w-full select-none"
      style={{ aspectRatio: '1 / 1', gridTemplateColumns: 'repeat(13, minmax(0, 1fr))' }}
    >
      {grid.flatMap((row) =>
        row.map((hand) => {
          const e = byHand.get(hand.name)
          const inRange = e && e.weight > 0
          const dist = e ? handActionDistribution(e) : null
          const segments: { action: PostflopAction; pct: number }[] = []
          if (dist) {
            for (const action of ['bet-big', 'bet-small', 'check'] as PostflopAction[]) {
              if (dist[action] > 0.001) segments.push({ action, pct: dist[action] })
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
                <div key={i} style={{ width: `${seg.pct}%`, background: POSTFLOP_ACTION_COLOR[seg.action] }} />
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
