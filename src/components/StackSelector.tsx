import { STACK_DEPTHS, type StackDepth } from '../types'

interface Props {
  value: StackDepth | null
  onChange: (v: StackDepth) => void
}

export default function StackSelector({ value, onChange }: Props) {
  return (
    <div className="flex flex-col items-center gap-4 py-10">
      <h1 className="text-xl sm:text-2xl font-semibold text-white">스택 사이즈를 선택하세요</h1>
      <p className="text-sm text-white/50">9-max 토너먼트 · 유효스택 기준 (bb)</p>
      <div className="grid grid-cols-3 gap-3 w-full max-w-md px-4">
        {STACK_DEPTHS.map((d) => (
          <button
            key={d}
            onClick={() => onChange(d)}
            className={`rounded-lg border px-4 py-4 text-lg font-semibold transition-colors ${
              value === d ? 'border-violet-400 bg-violet-500/20 text-white' : 'border-white/15 text-white/70 hover:border-white/30'
            }`}
          >
            {d}bb
          </button>
        ))}
      </div>
    </div>
  )
}
