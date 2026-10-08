export default function Footer() {
  return (
    <footer className="wenyan-muted mx-auto mt-auto w-full max-w-5xl px-6 pb-6 pt-4 text-[11px]">
      <div className="flex items-center justify-between border-t border-[var(--wenyan-line-soft)] pt-4">
        <span className="wenyan-brand text-[12px]">Wenyan</span>
        <div className="flex items-center gap-4">
          <a href="https://github.com/RealKai42/qwerty-learner" target="_blank" rel="noreferrer" className="wenyan-link text-[11px]">GPL-3.0</a>
          <a href="https://github.com/qbjsdsb/wenyan-English" target="_blank" rel="noreferrer" className="wenyan-link text-[11px]">项目</a>
        </div>
      </div>
    </footer>
  )
}
