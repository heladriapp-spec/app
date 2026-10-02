import { Input as InputPrimitive } from '@base-ui/react/input'
import type { ComponentProps } from 'react'
import { cn } from '@/lib/utils'

function Input({ className, type, ...props }: ComponentProps<'input'>) {
  return (
    <InputPrimitive
      type={type}
      className={cn(
        'h-10 w-full rounded-lg border border-input bg-card px-3 text-base outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/40 md:text-sm',
        className,
      )}
      {...props}
    />
  )
}

export { Input }
