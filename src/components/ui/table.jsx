import { cn } from "@/lib/utils";
export const TableWrap = ({ className, ...p }) => <div className={cn("w-full overflow-x-auto rounded-xl border border-line", className)} {...p} />;
export const Table = ({ className, ...p }) => <table className={cn("w-full min-w-[640px] border-collapse text-left text-[13px]", className)} {...p} />;
export const Th = ({ className, ...p }) => <th className={cn("sticky top-0 bg-surface-2 px-3 py-2.5 text-[11px] font-bold uppercase tracking-wider text-muted", className)} {...p} />;
export const Td = ({ className, ...p }) => <td className={cn("border-t border-line px-3 py-2.5 align-middle", className)} {...p} />;
