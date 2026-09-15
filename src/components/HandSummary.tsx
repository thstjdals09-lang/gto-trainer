import type { Card } from '../types'

const ACTION_LABEL: Record<string, string> = { fold: 'Fold', call: 'Call', raise: 'Raise', allin: 'Allin', check: 'Check', 'bet-small': 'Bet 33%', 'bet-big': 'Bet 75%+' }
const ACTION_COLOR: Record<string, string> = {
  fold: 'text-sky-400',
  call: 'text-amber-400',
  raise: 'text-red-400',
  allin: 'text-red-600',
  check: 'text-sky-400',
  'bet-small': 'text-amber-400',
  'bet-big': 'text-red-400',
}

export interface PreflopLine {
  position: string
  action: string
  sizeBB?: number
  auto?: boolean
}

export interface StreetLine {
  label: string
  board: Card[]
  position?: string
  action?: string
  sizeBB?: number
  potAfter?: number
}

interface Props {
  preflop: PreflopLine[]
  streets: StreetLine[]
  resultLabel?: string
}

function cardStr(c: Card) {
  return `${c.rank}${c.suit}`
}

export default function HandSummary({ preflop, streets, resultLabel }: Props) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-4 flex flex-col gap-4 text-sm">
      <h3 className="font-semibold text-white">핸드 요약</h3>

      <div>
        <div className="text-xs text-white/40 mb-1.5">프리플랍</div>
        <div className="flex flex-col gap-1">
          {preflop.map((line, i) => (
            <div key={i} className="flex items-center gap-2 text-white/80">
              <span className="w-12 shrink-0 font-semibold text-white">{line.position}</span>
              <span className={ACTION_COLOR[line.action] ?? 'text-white/60'}>
                {ACTION_LABEL[line.action] ?? line.action}
                {line.sizeBB ? ` ${line.sizeBB}bb` : ''}
              </span>
              {line.auto && <span className="text-[10px] text-white/30">(자동)</span>}
            </div>
          ))}
        </div>
      </div>

      {streets.map((s, i) => (
        <div key={i}>
          <div className="text-xs text-white/40 mb-1.5">
            {s.label} — {s.board.map(cardStr).join(' ')}
          </div>
          {s.position && s.action && (
            <div className="flex items-center gap-2 text-white/80">
              <span className="w-12 shrink-0 font-semibold text-white">{s.position}</span>
              <span className={ACTION_COLOR[s.action] ?? 'text-white/60'}>
                {ACTION_LABEL[s.action] ?? s.action}
                {s.sizeBB ? ` ${s.sizeBB.toFixed(1)}bb` : ''}
              </span>
              {s.potAfter !== undefined && <span className="text-[10px] text-white/30">팟 {s.potAfter.toFixed(1)}bb</span>}
            </div>
          )}
        </div>
      ))}

      {resultLabel && <div className="border-t border-white/10 pt-3 text-white/70">{resultLabel}</div>}
    </div>
  )
}
