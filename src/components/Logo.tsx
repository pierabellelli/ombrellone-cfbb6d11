export function Logo({ size = 36, withText = true }: { size?: number; withText?: boolean }) {
  return (
    <div className="flex items-center gap-2">
      <div
        className="rounded-xl brand-gradient flex items-center justify-center shadow-[var(--shadow-card)]"
        style={{ width: size, height: size }}
      >
        <svg width={size * 0.55} height={size * 0.55} viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 2a10 10 0 0 1 10 10H2A10 10 0 0 1 12 2z" fill="white" stroke="none" />
          <path d="M12 12v8" stroke="white" />
          <path d="M9 22h6" stroke="white" />
        </svg>
      </div>
      {withText && (
        <span className="font-display font-bold text-lg text-primary">LidoSmart</span>
      )}
    </div>
  );
}
