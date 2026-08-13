import { cn } from "@/lib/utils"

/**
 * shadcn's Skeleton, re-pointed at the shared `.sf-skeleton` treatment so a
 * placeholder looks the same wherever it comes from. It used to be
 * `animate-pulse bg-primary/10` — a pulsing *brand-coloured* block, which on
 * a loading screen read as a row of indigo bars rather than as absent
 * content.
 *
 * `Skeleton` from `@/components/ui/primitives` is the same thing; this export
 * stays so the existing call sites keep working.
 */
function Skeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      aria-hidden="true"
      className={cn("sf-skeleton", className)}
      {...props}
    />
  )
}

export { Skeleton }
