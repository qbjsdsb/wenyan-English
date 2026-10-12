import type React from 'react'

const MobilePage: React.FC = () => {
  return (
    <main className="wenyan-mobile-note flex min-h-screen items-center justify-center px-6 py-12 text-[var(--wenyan-ink)]">
      <section className="w-full max-w-md">
        <div className="wenyan-brand text-[22px] font-semibold">Wenyan</div>
        <h1 className="mt-7 text-[28px] font-semibold tracking-[-0.04em]">更适合在电脑上学习</h1>
        <p className="wenyan-muted mt-4 text-sm leading-7">
          Wenyan 目前以键盘输入和桌面专注体验为核心。手机端暂时不维护完整学习界面，避免把桌面体验简单缩成一张拥挤的网页。
        </p>

        <section className="mt-8 border-y border-[var(--wenyan-line-soft)] py-5" aria-labelledby="mobile-usage-title">
          <h2 id="mobile-usage-title" className="text-sm font-medium text-[var(--wenyan-ink)]">推荐这样使用</h2>
          <div className="wenyan-muted mt-3 space-y-2 text-xs leading-6">
            <p>在电脑上打开 Wenyan，完成背词、阅读、计划和记录查看。</p>
            <p>学习记录仍可通过 Wenyan Cloud 同步到你的账号。</p>
          </div>
        </section>

        <p className="wenyan-muted mt-7 text-[11px] leading-5">
          后续如果重新做移动端，会采用专门的触控体验，而不是复制桌面布局。
        </p>
      </section>
    </main>
  )
}

export default MobilePage