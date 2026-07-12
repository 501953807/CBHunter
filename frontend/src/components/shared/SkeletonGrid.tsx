interface SkeletonGridProps {
  rows?: number
  cols?: number
  height?: string
  className?: string
}

export function SkeletonGrid({ rows = 3, cols = 4, height = 'h-36', className = '' }: SkeletonGridProps) {
  return (
    <div
      className={`grid gap-4 ${className}`}
      style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
    >
      {Array.from({ length: rows * cols }).map((_, i) => (
        <div
          key={i}
          className={`rounded-xl animate-pulse ${height}`}
          style={{ background: 'var(--color-border)' }}
        />
      ))}
    </div>
  )
}
