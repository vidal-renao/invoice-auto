import { forwardRef } from 'react'
import { cn } from '@/lib/utils'

export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
  hint?: string
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, error, hint, id, ...props }, ref) => {
    const inputId = id ?? label?.toLowerCase().replace(/\s+/g, '-')

    return (
      <div className="space-y-1.5">
        {label && (
          <label
            htmlFor={inputId}
            className="block text-sm font-medium text-[#ededed]"
          >
            {label}
          </label>
        )}

        <input
          ref={ref}
          id={inputId}
          aria-invalid={error ? 'true' : undefined}
          aria-describedby={
            error
              ? `${inputId}-error`
              : hint
                ? `${inputId}-hint`
                : undefined
          }
          className={cn(
            'w-full rounded-md border border-[#2a2a2a] bg-[#111]',
            'px-3 py-2 text-sm text-[#ededed] placeholder:text-[#555]',
            'transition-colors duration-150',
            'focus:outline-none focus:ring-1 focus:ring-violet-700 focus:border-violet-700',
            error &&
              'border-red-500 focus:border-red-500 focus:ring-red-500',
            className
          )}
          {...props}
        />

        {error && (
          <p
            id={`${inputId}-error`}
            role="alert"
            className="text-xs text-red-400"
          >
            {error}
          </p>
        )}

        {hint && !error && (
          <p id={`${inputId}-hint`} className="text-xs text-[#888]">
            {hint}
          </p>
        )}
      </div>
    )
  }
)
Input.displayName = 'Input'
