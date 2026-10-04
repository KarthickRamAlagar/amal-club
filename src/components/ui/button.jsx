import { Slot } from "@radix-ui/react-slot";
import { cva } from "class-variance-authority";
import { forwardRef } from "react";
import { cn } from "@/lib/utils";

export const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-[10px] text-[13px] font-bold transition-all disabled:pointer-events-none disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-gold cursor-pointer [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "brand-gradient text-white shadow-[0_12px_30px_-10px_var(--red)] hover:-translate-y-px hover:shadow-[0_16px_36px_-10px_var(--red-bright)]",
        secondary: "bg-surface-2 text-fg border border-line hover:border-brand-bright",
        outline: "border border-line bg-transparent text-fg hover:bg-surface-2",
        ghost: "bg-transparent text-muted hover:text-fg hover:bg-surface-2",
        danger: "bg-[#7a0f22] text-white hover:bg-[#9a1530]",
        success: "bg-[#14714a] text-white hover:bg-[#178a5a]",
        gold: "bg-gold text-[#2a0a12] hover:brightness-105",
        link: "text-brand-bright underline-offset-4 hover:underline px-0",
      },
      size: {
        default: "h-11 px-4",
        sm: "h-9 px-3 text-xs",
        lg: "h-12 px-6 text-sm",
        icon: "h-10 w-10 p-0",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  }
);

export const Button = forwardRef(function Button({ className, variant, size, asChild = false, ...props }, ref) {
  const Comp = asChild ? Slot : "button";
  return <Comp ref={ref} className={cn(buttonVariants({ variant, size }), className)} {...props} />;
});
