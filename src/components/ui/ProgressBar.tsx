/**
 * 进度条 + 动态波形
 */
import { cn } from '@/lib/utils'

interface ProgressBarProps {
  progress: number // 0-100
  className?: string
  showLabel?: boolean
}

export default function ProgressBar({ progress, className, showLabel = true }: ProgressBarProps) {
  const p = Math.max(0, Math.min(100, progress))
  return (
    <div className={cn('w-full', className)}>
      <div className="relative h-3 w-full rounded-full bg-cream overflow-hidden">
        <div
          className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-coral to-[#ff7a4d] transition-[width] duration-300 ease-out"
          style={{ width: `${p}%` }}
        >
          <div className="absolute inset-0 overflow-hidden rounded-full">
            <div className="absolute inset-0 -translate-x-full animate-shimmer bg-gradient-to-r from-transparent via-white/40 to-transparent" />
          </div>
        </div>
      </div>
      {showLabel && (
        <div className="mt-2 flex items-center justify-between text-xs text-muted">
          <span>{p < 100 ? '正在生成…' : '生成完成'}</span>
          <span className="font-display font-semibold text-coral">{Math.round(p)}%</span>
        </div>
      )}
    </div>
  )
}

/**
 * 等高波形动画
 */
export function Waveform({ active = true, bars = 28 }: { active?: boolean; bars?: number }) {
  return (
    <div className="flex items-end gap-[3px] h-10">
      {Array.from({ length: bars }).map((_, i) => (
        <span
          key={i}
          className={cn(
            'w-[3px] rounded-full bg-coral/70',
            active && 'animate-wave',
          )}
          style={{
            height: `${20 + ((i * 37) % 80)}%`,
            animationDelay: `${(i % 10) * 0.08}s`,
            animationDuration: `${0.8 + (i % 5) * 0.12}s`,
          }}
        />
      ))}
    </div>
  )
}
