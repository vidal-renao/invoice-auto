import { cn } from '@/lib/utils'

interface StatCardProps {
  label: string
  value: string | number
  trend?: 'up' | 'down' | 'neutral'
  description?: string
}

export function StatCard({ label, value, trend, description }: StatCardProps) {
  return (
    <div className="rounded-lg border border-[#2a2a2a] bg-[#111] p-5">
      <div className="mb-3 flex items-center justify-between">
        <span className="text-xs font-medium uppercase tracking-widest text-[#888]">
          {label}
        </span>
        {trend && trend !== 'neutral' && (
          <span
            className={cn(
              'text-xs font-semibold',
              trend === 'up' && 'text-emerald-400',
              trend === 'down' && 'text-red-400'
            )}
            aria-label={trend === 'up' ? 'Incremento' : 'Decremento'}
          >
            {trend === 'up' ? '↑' : '↓'}
          </span>
        )}
      </div>

      <p className="font-mono text-2xl font-semibold tabular-nums text-[#ededed]">
        {value}
      </p>

      {description && (
        <p className="mt-1 text-xs text-[#888]">{description}</p>
      )}
    </div>
  )
}
