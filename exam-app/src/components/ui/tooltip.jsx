import * as TooltipPrimitive from "@radix-ui/react-tooltip"
import { cn } from "@/lib/utils"

const TooltipProvider = TooltipPrimitive.Provider

const Tooltip = TooltipPrimitive.Root

const TooltipTrigger = TooltipPrimitive.Trigger

const TooltipContent = ({ className, sideOffset = 4, ...props }) => (
  <TooltipPrimitive.Portal>
    <TooltipPrimitive.Content
      sideOffset={sideOffset}
      className={cn(
        "z-50 overflow-hidden rounded-[var(--radius-md)] bg-[var(--foreground)] px-3 py-1.5 text-xs text-[var(--background)] shadow-md animate-in fade-in-0 zoom-in-95",
        className
      )}
      {...props}
    >
      {props.children}
      <TooltipPrimitive.Arrow className="fill-[var(--foreground)]" />
    </TooltipPrimitive.Content>
  </TooltipPrimitive.Portal>
)

export { TooltipProvider, Tooltip, TooltipTrigger, TooltipContent }
