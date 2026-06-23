import { cva } from "class-variance-authority"
import { cn } from "@/lib/utils"

const alertVariants = cva(
  "relative w-full rounded-[var(--radius-md)] border px-4 py-3 text-sm [&>svg]:absolute [&>svg]:left-4 [&>svg]:top-3.5 [&>svg+div]:pl-6",
  {
    variants: {
      variant: {
        default:
          "bg-[var(--surface)] border-[var(--border)] text-[var(--foreground)]",
        destructive:
          "bg-[var(--destructive)]/10 border-[var(--destructive)] text-[var(--destructive)]",
        warning:
          "bg-[var(--warning,#f59e0b)]/10 border-[var(--warning,#f59e0b)] text-[var(--warning-fg,#92400e)]",
        info:
          "bg-[var(--primary)]/10 border-[var(--primary)]/40 text-[var(--primary)]",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

const Alert = function Alert({ className, variant, ...props }) {
  return (
    <div
      role="alert"
      className={cn(alertVariants({ variant }), className)}
      {...props}
    />
  )
}

const AlertDescription = function AlertDescription({ className, ...props }) {
  return (
    <div
      className={cn("text-sm leading-relaxed text-[var(--muted-fg)] [&_p]:leading-relaxed", className)}
      {...props}
    />
  )
}

export { Alert, AlertDescription }
