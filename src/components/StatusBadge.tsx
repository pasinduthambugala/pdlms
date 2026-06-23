import { Badge } from "@/components/ui/badge";
import { STATUS_LABELS, type CartStatus } from "@/lib/types";

const CLASSES: Record<CartStatus, string> = {
  draft: "bg-slate-200 text-slate-800 hover:bg-slate-200",
  pending_approval: "bg-amber-100 text-amber-800 hover:bg-amber-100",
  approved: "bg-blue-100 text-blue-800 hover:bg-blue-100",
  stored: "bg-emerald-100 text-emerald-800 hover:bg-emerald-100",
  pending_retrieval_approval: "bg-amber-100 text-amber-800 hover:bg-amber-100",
  retrieved: "bg-indigo-100 text-indigo-800 hover:bg-indigo-100",
  pending_return_approval: "bg-amber-100 text-amber-800 hover:bg-amber-100",
  disposed: "bg-zinc-200 text-zinc-700 hover:bg-zinc-200",
  rejected: "bg-rose-100 text-rose-800 hover:bg-rose-100",
};

export function StatusBadge({ status }: { status: CartStatus }) {
  return (
    <Badge variant="secondary" className={CLASSES[status]}>
      {STATUS_LABELS[status]}
    </Badge>
  );
}
