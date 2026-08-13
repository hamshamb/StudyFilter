import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  // @replit
  // Whitespace-nowrap: Badges should never wrap.
  // `hover-elevate` used to be here too. It had never actually rendered —
  // nothing in the project defined the class — and now that it does, a badge
  // is the wrong place for it: almost every badge in this app is a static
  // label (subject tag, difficulty chip, paper year), and a hover tint on
  // those promises a click that does nothing. Buttons keep it; badges don't.
  // Focus uses the global :focus-visible outline from index.css, like every
  // other focusable thing; this had its own 2px offset ring.
  "whitespace-nowrap inline-flex items-center rounded-md border px-2 py-0.5 text-[11px] font-semibold leading-5 transition-colors",
  {
    variants: {
      variant: {
        default: "border-transparent bg-primary text-primary-foreground",
        secondary: "border-transparent bg-secondary text-secondary-foreground",
        destructive: "border-transparent bg-destructive text-destructive-foreground",
        outline: "text-muted-foreground border [border-color:var(--badge-outline)]",
        success: "border-transparent bg-success-soft text-success",
        warning: "border-transparent bg-warning-soft text-warning",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <span className={cn(badgeVariants({ variant }), className)} {...props} />
  )
}

export { Badge, badgeVariants }
