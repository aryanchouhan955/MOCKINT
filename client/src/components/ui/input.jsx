import * as React from 'react'
import { cn } from '../../lib/utils'

const Input = React.forwardRef(({ className, type, ...props }, ref) => {
  return (
    <input
      type={type}
      className={cn(
        'flex h-10 w-full rounded-lg border px-3 py-2 text-sm text-foreground ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50 transition-all duration-200',
        className
      )}
      style={{
        background: 'hsl(var(--input) / 0.6)',
        borderColor: 'var(--surface-glass-border)',
        color: 'hsl(var(--foreground))',
      }}
      onFocus={e => {
        e.target.style.borderColor = 'hsl(var(--ring) / 0.5)'
        e.target.style.boxShadow = '0 0 0 3px hsl(var(--ring) / 0.12), 0 0 10px hsl(var(--ring) / 0.08)'
      }}
      onBlur={e => {
        e.target.style.borderColor = 'var(--surface-glass-border)'
        e.target.style.boxShadow = 'none'
      }}
      ref={ref}
      {...props}
    />
  )
})
Input.displayName = 'Input'

export { Input }
