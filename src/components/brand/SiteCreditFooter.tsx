interface SiteCreditFooterProps {
  className?: string;
  variant?: 'light' | 'dark';
}

export function SiteCreditFooter({
  className = '',
  variant = 'light',
}: SiteCreditFooterProps) {
  const isDark = variant === 'dark';

  return (
    <footer
      className={`no-print print:hidden w-full border-t py-4 text-center text-[11px] font-semibold tracking-wide ${
        isDark
          ? 'border-white/10 bg-[#152821] text-slate-300/75'
          : 'border-[#DCE3D7]/70 bg-transparent text-[#5A6F64]'
      } ${className}`}
    >
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-center gap-x-2.5 gap-y-1 px-4">
        <span>© {new Date().getFullYear()} ClassCare 360</span>
        <span className={isDark ? 'text-white/25' : 'text-[#5A6F64]/40'} aria-hidden="true">
          ·
        </span>
        <span>
          Crafted with care by{' '}
          <strong className={isDark ? 'font-black text-emerald-200' : 'font-black text-[#1C342B]'}>
            MIKPURINUT
          </strong>
        </span>
      </div>
    </footer>
  );
}
