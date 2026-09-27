import { cn } from '@/lib/utils'

interface CardSectionProps {
  className?: string
  children: React.ReactNode
}

export function Card({ className, children }: CardSectionProps) {
  return (
    <div
      className={cn(
        'rounded-lg border border-line bg-surface',
        className
      )}
    >
      {children}
    </div>
  )
}

export function CardHeader({ className, children }: CardSectionProps) {
  return (
    <div
      className={cn('border-b border-line px-6 py-4', className)}
    >
      {children}
    </div>
  )
}

export function CardContent({ className, children }: CardSectionProps) {
  return (
    <div className={cn('px-6 py-4', className)}>
      {children}
    </div>
  )
}

export function CardFooter({ className, children }: CardSectionProps) {
  return (
    <div
      className={cn(
        'border-t border-line px-6 py-4',
        className
      )}
    >
      {children}
    </div>
  )
}
