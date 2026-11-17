/** Placeholder shapes shown while data loads, so the page does not jump. */
export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-lg bg-surface-raised ${className}`} aria-hidden="true" />;
}

export function PageSkeleton() {
  return (
    <div role="status" aria-busy="true" className="flex flex-col gap-5">
      <Skeleton className="h-9 w-56" />
      <Skeleton className="h-4 w-full max-w-[520px]" />
      <div className="mt-3 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-[120px] rounded-[14px]" />)}
      </div>
      <Skeleton className="h-[260px] rounded-[14px]" />
    </div>
  );
}

export function ListSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div role="status" aria-busy="true" className="mt-6 flex flex-col gap-3">
      {Array.from({ length: rows }, (_, i) => <Skeleton key={i} className="h-[96px] rounded-[14px]" />)}
    </div>
  );
}
