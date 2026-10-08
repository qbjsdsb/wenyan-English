export default function Footer() {
  return (
    <footer className="mx-auto mt-auto w-full max-w-5xl px-6 pb-6 pt-4 text-[11px] text-gray-400 dark:text-gray-600">
      <div className="flex items-center justify-between border-t border-black/[0.06] pt-4 dark:border-white/[0.07]">
        <span>Wenyan</span>
        <div className="flex items-center gap-4">
          <a href="https://github.com/RealKai42/qwerty-learner" target="_blank" rel="noreferrer" className="transition-colors hover:text-gray-600 dark:hover:text-gray-400">GPL-3.0</a>
          <a href="https://github.com/qbjsdsb/wenyan-English" target="_blank" rel="noreferrer" className="transition-colors hover:text-gray-600 dark:hover:text-gray-400">项目</a>
        </div>
      </div>
    </footer>
  )
}
