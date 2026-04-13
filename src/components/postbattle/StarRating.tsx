'use client'

interface StarRatingProps {
  hpRemaining: number
}

function StarIcon({ filled }: { filled: boolean }) {
  return (
    <svg
      width={24}
      height={24}
      viewBox="0 0 24 24"
      fill={filled ? '#eab308' : 'white'}
      style={{ opacity: filled ? 1 : 0.2 }}
      xmlns="http://www.w3.org/2000/svg"
    >
      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
    </svg>
  )
}

export function StarRating({ hpRemaining }: StarRatingProps) {
  const starCount = hpRemaining > 70 ? 3 : hpRemaining >= 30 ? 2 : 1

  return (
    <div style={{ display: 'flex', gap: 4 }}>
      {[1, 2, 3].map((n) => (
        <StarIcon key={n} filled={n <= starCount} />
      ))}
    </div>
  )
}