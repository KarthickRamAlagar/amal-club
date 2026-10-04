import * as T from "@radix-ui/react-tabs";
import { cn } from "@/lib/utils";
export const Tabs = T.Root;
export const TabsList = ({ className, ...p }) => <T.List className={cn("inline-flex flex-wrap gap-1 rounded-xl border border-line bg-surface p-1", className)} {...p} />;
export const TabsTrigger = ({ className, ...p }) => (
  <T.Trigger className={cn("rounded-lg px-3.5 py-2 text-[13px] font-semibold text-muted transition data-[state=active]:brand-gradient data-[state=active]:text-white hover:text-fg cursor-pointer", className)} {...p} />
);
export const TabsContent = ({ className, ...p }) => <T.Content className={cn("mt-5 outline-none", className)} {...p} />;
