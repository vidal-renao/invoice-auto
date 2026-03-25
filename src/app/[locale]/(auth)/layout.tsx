export default function AuthLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#0a0a0a] px-4 py-12">
      {/* Brand mark */}
      <div className="mb-8 flex items-center gap-2.5">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-700">
          <svg
            width="16"
            height="16"
            viewBox="0 0 16 16"
            fill="none"
            aria-hidden="true"
          >
            <path
              d="M3 4h10M3 8h7M3 12h4"
              stroke="white"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
          </svg>
        </div>
        <span className="text-base font-semibold text-[#ededed]">
          Invoice Auto
        </span>
      </div>

      {/* Card */}
      <div className="w-full max-w-sm rounded-xl border border-[#2a2a2a] bg-[#111] p-8 shadow-2xl shadow-black/40">
        {children}
      </div>
    </div>
  )
}
