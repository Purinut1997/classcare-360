interface RoadmapPanelProps {
  items: string[];
}

export function RoadmapPanel({ items }: RoadmapPanelProps) {
  return (
    <section className="glass-panel mt-5 rounded-3xl p-5 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-black uppercase tracking-wide text-cyan-700">Next Build Steps</p>
          <h2 className="mt-1 text-2xl font-black tracking-tight text-slate-950">งานต่อจากดีไซน์รอบนี้</h2>
        </div>
        <span className="inline-flex h-10 items-center rounded-full bg-cyan-50 px-4 text-sm font-black text-cyan-800 ring-1 ring-cyan-100">
          Phase 4/5 Core
        </span>
      </div>
      <div className="mt-5 grid gap-3 lg:grid-cols-4">
        {items.map((item, index) => (
          <div className="rounded-3xl border border-slate-200/80 bg-white/75 p-4 shadow-sm transition hover:-translate-y-1 hover:bg-white hover:shadow-[0_18px_38px_rgba(14,165,233,0.12)]" key={item}>
            <span className="grid h-10 w-10 place-items-center rounded-2xl bg-slate-950 text-sm font-black text-cyan-100">
              {index + 1}
            </span>
            <p className="mt-4 text-sm font-black leading-6 text-slate-700">{item}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
