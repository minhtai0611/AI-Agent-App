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
