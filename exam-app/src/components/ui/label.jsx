import { cn } from "@/lib/utils";

function Label({ className, ...props }) {
  return (
    <label
      className={cn(
        "text-sm font-medium leading-none text-[var(--foreground)] peer-disabled:cursor-not-allowed peer-disabled:opacity-70",
        className
      )}
      {...props}
    />
  );
}

export { Label };
