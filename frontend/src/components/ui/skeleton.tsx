import { cn } from '@/lib/utils'

function Skeleton({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      {...props}
      aria-hidden="true"
      data-slot="skeleton"
      className={cn('bg-accent animate-pulse rounded-md', className)}
    />
  )
}

export { Skeleton }
