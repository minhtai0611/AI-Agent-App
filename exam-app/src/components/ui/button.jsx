import { cva } from "class-variance-authority"
import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-[var(--radius-md)] text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)] focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default:     "bg-[var(--primary)] text-[var(--primary-fg)] hover:bg-[var(--primary)]/90",
        accent:      "bg-[var(--accent)] text-[var(--accent-fg)] hover:bg-[var(--accent)]/90",
        secondary:   "bg-[var(--surface)] text-[var(--foreground)] border border-[var(--border)] hover:bg-[var(--surface-elevated)]",
        outline:     "border border-[var(--border)] bg-transparent text-[var(--foreground)] hover:bg-[var(--surface)]",
        ghost:       "text-[var(--muted-fg)] hover:bg-[var(--surface)] hover:text-[var(--foreground)]",
        destructive: "bg-[var(--destructive)] text-white hover:bg-[var(--destructive)]/90",
        link:        "text-[var(--primary)] underline-offset-4 hover:underline",
      },
      size: {
        default: "h-9 px-4 py-2",
        sm:      "h-8 rounded-[var(--radius-sm)] px-3 text-xs",
        lg:      "h-10 rounded-[var(--radius-lg)] px-6",
        icon:    "h-9 w-9",
        "icon-sm": "h-8 w-8 rounded-[var(--radius-sm)]",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({ className, variant, size, asChild = false, ...props }) {
  return (
    <button
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
