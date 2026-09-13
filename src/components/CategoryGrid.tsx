import { CATEGORY_COLOR, CATEGORY_LABEL } from '../engine/handEval'
import { summarizeCategories, type HandRangeEntry } from '../engine/postflop'
import { generateHandGrid } from '../types'

interface Props {
  entries: HandRangeEntry[]
}

const grid = generateHandGrid()

export default function CategoryGrid({ entries }: Props) {
  const byHand = new Map(entries.map((e) => [e.hand, e]))
  const summary = summarizeCategories(entries)

  return (
    <div className="flex flex-col gap-3">
      <div
        className="grid gap-[2px] w-full select-none"
        style={{ aspectRatio: '1 / 1', gridTemplateColumns: 'repeat(13, minmax(0, 1fr))' }}
      >
        {grid.flatMap((row) =>
          row.map((hand) => {
            const e = byHand.get(hand.name)
            const bg = e?.category ? CATEGORY_COLOR[e.category] : '#1a1c24'
            const dim = !e || e.weight <= 0
            return (
              <div
                key={hand.name}
                title={e?.category ? `${hand.name} · ${CATEGORY_LABEL[e.category]}` : hand.name}
                className="relative flex items-center justify-center rounded-[2px] text-[6px] xs:text-[7px] sm:text-[9px] font-medium text-white/90"
                style={{ background: bg, opacity: dim ? 0.15 : 1 }}
              >
                {hand.name}
              </div>
            )
          })
        )}
      </div>
      <div className="flex flex-wrap gap-2 text-xs sm:text-sm">
        {summary.map((s) => (
          <div key={s.category} className="flex items-center gap-1.5 rounded bg-white/5 px-2 py-1">
            <span className="h-2.5 w-2.5 rounded-sm" style={{ background: CATEGORY_COLOR[s.category] }} />
            <span className="text-white/80">{CATEGORY_LABEL[s.category]}</span>
            <span className="font-semibold text-white">{s.pct.toFixed(1)}%</span>
          </div>
        ))}
      </div>
    </div>
  )
}
