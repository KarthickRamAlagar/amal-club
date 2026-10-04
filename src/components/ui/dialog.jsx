import * as D from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

export const Dialog = D.Root;
export const DialogTrigger = D.Trigger;
export const DialogClose = D.Close;

export function DialogContent({ className, children, wide, ...p }) {
  return (
    <D.Portal>
      <D.Overlay className="fixed inset-0 z-[90] bg-black/60 backdrop-blur-sm data-[state=open]:animate-[fadeUp_.2s]" />
      <D.Content
        className={cn(
          "fixed left-1/2 top-1/2 z-[91] max-h-[90vh] w-[calc(100%-32px)] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-2xl border border-line bg-surface p-6 text-fg shadow-2xl",
          wide ? "max-w-3xl" : "max-w-lg", className
        )}
        {...p}
      >
        {children}
        <D.Close className="absolute right-4 top-4 grid h-8 w-8 place-items-center rounded-full text-muted hover:bg-surface-2 hover:text-fg" aria-label="Close">
          <X size={16} />
        </D.Close>
      </D.Content>
    </D.Portal>
  );
}
export const DialogTitle = ({ className, ...p }) => <D.Title className={cn("font-display text-xl font-extrabold tracking-tight pr-8", className)} {...p} />;
export const DialogDescription = ({ className, ...p }) => <D.Description className={cn("mt-1 text-sm text-muted", className)} {...p} />;
