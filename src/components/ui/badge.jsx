import { cva } from "class-variance-authority";
import { cn } from "@/lib/utils";
const v = cva("inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-bold tracking-wide whitespace-nowrap", {
  variants: {
    variant: {
      default: "bg-[color-mix(in_oklab,var(--red)_18%,transparent)] text-brand-bright",
      gold: "bg-[color-mix(in_oklab,var(--gold)_20%,transparent)] text-gold",
      ok: "bg-[color-mix(in_oklab,#3ccf8e_18%,transparent)] text-ok",
      warn: "bg-[color-mix(in_oklab,#f2b84b_18%,transparent)] text-warn",
      muted: "bg-surface-2 text-muted",
      outline: "border border-line text-muted",
    },
  },
  defaultVariants: { variant: "default" },
});
export const Badge = ({ className, variant, ...p }) => <span className={cn(v({ variant }), className)} {...p} />;
