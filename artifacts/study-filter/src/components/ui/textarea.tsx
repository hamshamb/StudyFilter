import * as React from "react"

import { cn } from "@/lib/utils"

/**
 * `text-base` at every width — see input.tsx. The `md:text-sm` here was the
 * one that mattered most: the Ask box is a textarea, so on iOS the page
 * zoomed every time a student tapped it to type a question.
 */
const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.ComponentProps<"textarea">
>(({ className, ...props }, ref) => {
  return (
    <textarea
      className={cn(
        "flex min-h-[60px] w-full rounded-md border border-input bg-card px-3 py-2 text-base shadow-xs transition-colors",
        "placeholder:text-muted-foreground/80",
        "disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      ref={ref}
      {...props}
    />
  )
})
Textarea.displayName = "Textarea"

export { Textarea }
