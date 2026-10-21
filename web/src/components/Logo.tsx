export function Logo({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-label="auditLab">
      <rect x="1" y="1" width="22" height="22" rx="6" fill="#22c55e" />
      <path d="M7 16.5 11 7h2l4 9.5h-2.3l-.9-2.3H10.2l-.9 2.3H7Zm3.9-4.1h2.2L12 9.5l-1.1 2.9Z" fill="#fff" />
    </svg>
  )
}
