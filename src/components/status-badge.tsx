import { cn } from "@/lib/utils";

type Variant = "default" | "success" | "warning" | "destructive" | "info" | "accent" | "muted";

const styles: Record<Variant, string> = {
  default: "bg-secondary text-secondary-foreground",
  success: "bg-success/15 text-success border border-success/20",
  warning: "bg-warning/20 text-warning-foreground border border-warning/30",
  destructive: "bg-destructive/15 text-destructive border border-destructive/20",
  info: "bg-info/15 text-info border border-info/20",
  accent: "bg-accent/15 text-accent border border-accent/20",
  muted: "bg-muted text-muted-foreground border border-border",
};

export function StatusBadge({
  children, variant = "default", className,
}: { children: React.ReactNode; variant?: Variant; className?: string }) {
  return (
    <span className={cn(
      "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-medium whitespace-nowrap",
      styles[variant], className
    )}>
      {children}
    </span>
  );
}
