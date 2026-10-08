export default function Footer() {
  return (
    <footer className="mx-auto mt-auto w-full max-w-6xl px-6 pb-7 pt-4 text-[11px] text-gray-400 lg:px-10">
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-gray-200/60 pt-5 dark:border-white/10">
        <span>Wenyan · 慢慢积累，每天向前一点</span>
        <div className="flex flex-wrap items-center gap-4">
          <a href="https://github.com/RealKai42/qwerty-learner" target="_blank" rel="noreferrer" className="underline-offset-4 transition-colors hover:text-gray-600 hover:underline dark:hover:text-gray-300">Qwerty Learner · GPL-3.0</a>
          <a href="https://github.com/qbjsdsb/wenyan-English" target="_blank" rel="noreferrer" className="underline-offset-4 transition-colors hover:text-gray-600 hover:underline dark:hover:text-gray-300">项目说明</a>
        </div>
      </div>
    </footer>
  )
}
