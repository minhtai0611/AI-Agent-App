import { cva } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors",
  {
    variants: {
      variant: {
        default:
          "bg-[var(--primary)] text-[var(--primary-foreground)]",
        secondary:
          "bg-[var(--surface)] text-[var(--foreground)] border border-[var(--border)]",
        destructive:
          "bg-[var(--destructive)] text-[var(--destructive-foreground)]",
        outline:
          "border border-[var(--border)] text-[var(--foreground)] bg-transparent",
        success:
          "bg-[var(--success)] text-[var(--success-foreground)]",
        warning:
          "bg-[var(--warning)] text-[var(--warning-foreground)]",
        accent:
          "bg-accent/20 text-accent",
        successSubtle:
          "bg-success/20 text-success",
        destructiveSubtle:
          "bg-destructive/20 text-destructive",
        mastery0:
          "bg-[var(--mastery-0-bg)] text-[var(--mastery-0)] border border-[var(--mastery-0)]/30",
        mastery1:
          "bg-[var(--mastery-1-bg)] text-[var(--mastery-1)] border border-[var(--mastery-1)]/30",
        mastery2:
          "bg-[var(--mastery-2-bg)] text-[var(--mastery-2)] border border-[var(--mastery-2)]/30",
        mastery3:
          "bg-[var(--mastery-3-bg)] text-[var(--mastery-3)] border border-[var(--mastery-3)]/30",
        mastery4:
          "bg-[var(--mastery-4-bg)] text-[var(--mastery-4)] border border-[var(--mastery-4)]/30",
        mastery5:
          "bg-[var(--mastery-5-bg)] text-[var(--mastery-5)] border border-[var(--mastery-5)]/30",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

function Badge({ className, variant, ...props }) {
  return (
    <span className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

export { Badge, badgeVariants };
