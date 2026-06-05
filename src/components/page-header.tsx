import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";

export function PageHeader({
  title, description, action, onAction
}: { title: string; description?: string; action?: ReactNode | string; onAction?: () => void }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight">{title}</h1>
        {description && <p className="text-sm text-muted-foreground mt-1">{description}</p>}
      </div>
      {action && (
        typeof action === "string"
          ? <Button onClick={onAction}><Plus className="h-4 w-4 mr-1" />{action}</Button>
          : action
      )}
    </div>
  );
}
