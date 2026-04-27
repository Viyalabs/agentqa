import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const badgeVariants = cva(
  'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold transition-colors',
  {
    variants: {
      variant: {
        default: 'bg-blue-600/20 text-blue-400 border border-blue-500/30',
        critical: 'bg-red-500/15 text-red-400 border border-red-500/30',
        medium: 'bg-yellow-500/15 text-yellow-400 border border-yellow-500/30',
        low: 'bg-blue-500/15 text-blue-400 border border-blue-500/30',
        success: 'bg-green-500/15 text-green-400 border border-green-500/30',
        secondary: 'bg-zinc-800 text-zinc-400 border border-zinc-700',
        outline: 'border border-zinc-700 text-zinc-400',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />
}

export { Badge, badgeVariants }
