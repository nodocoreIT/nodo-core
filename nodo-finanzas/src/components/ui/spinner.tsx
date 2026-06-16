export function Spinner({ className }: { className?: string }) {
  return (
    <div
      className={`animate-spin rounded-full border-2 border-mist border-t-brand ${className ?? "h-5 w-5"}`}
    />
  );
}
