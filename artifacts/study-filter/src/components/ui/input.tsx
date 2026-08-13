import * as React from "react"

import { cn } from "@/lib/utils"

/**
 * `text-base` at every width, not `md:text-sm`.
 *
 * iOS Safari zooms the viewport whenever a focused input's text is under
 * 16px, which on a phone meant tapping the search box jerked the whole page
 * — and the class responsible only applied at `md` and up, so it looked
 * correct on desktop while breaking exactly where it mattered.
 *
 * Focus is the global `:focus-visible` outline from index.css; this used to
 * set `focus-visible:outline-none` and add a 1px ring, which was thinner than
 * every other focus ring in the product.
 */
const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "flex h-9 w-full rounded-md border border-input bg-card px-3 py-1 text-base shadow-xs transition-colors",
          "file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground",
          "placeholder:text-muted-foreground/80",
          "disabled:cursor-not-allowed disabled:opacity-50",
          className
        )}
        ref={ref}
        {...props}
      />
    )
  }
)
Input.displayName = "Input"

export { Input }
