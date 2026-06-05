/**
 * components/ui/skeleton.tsx — shadcn/ui Skeleton primitive.
 * A pulsing placeholder block used by app/loading.tsx while the server fetches.
 */
import { cn } from "@/lib/utils";

function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("animate-pulse rounded-md bg-muted", className)} {...props} />
  );
}

export { Skeleton };
