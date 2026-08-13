import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

/**
 * Small controls (buttons, inputs) sit at 8px; containers (cards, panels) sit
 * at 10–14px. That two-step relationship is the whole radius system, and it's
 * what stops the UI reading as a pile of pills.
 *
 * Focus is deliberately *not* handled here. index.css defines one
 * `:focus-visible` outline for the entire product; this used to set
 * `focus-visible:outline-none` and then re-add a 1px ring of its own, which
 * meant buttons had a different, thinner focus ring than every other
 * focusable thing on the page.
 */
const buttonVariants = cva(
  "inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-md text-sm font-medium transition-colors duration-150 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0" +
    " hover-elevate active-elevate-2",
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground border border-primary-border shadow-xs",
        destructive:
          "bg-destructive text-destructive-foreground border border-destructive-border shadow-xs",
        outline:
          // Shows the background of whatever card / sidebar / panel it sits
          // inside, and inherits the current text colour.
          "border [border-color:var(--button-outline)] bg-card shadow-xs active:shadow-none",
        secondary:
          "border border-secondary-border bg-secondary text-secondary-foreground",
        ghost: "border border-transparent",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "min-h-9 px-3.5 py-2",
        sm: "min-h-8 px-3 text-xs",
        lg: "min-h-10 rounded-lg px-5 text-[0.9375rem]",
        icon: "h-9 w-9",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }
