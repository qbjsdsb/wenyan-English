import Header from '@/components/Header'
import Layout from '@/components/Layout'
import ezbdc from '@/assets/friendlinks/ezbdc.jpg'
import kk from '@/assets/friendlinks/kk.jpg'
import web_worker from '@/assets/friendlinks/web-worker.png'
import type React from 'react'

const links = [
  {
    title: 'ez背单词',
    href: 'https://ezbdc.dashu.ai',
    imgSrc: ezbdc,
    description: '一款极简的英文单词学习应用，强调高效、直接的单词训练。',
  },
  {
    title: 'Kai',
    href: 'https://kaiyi.cool/',
    imgSrc: kk,
    description: 'Qwerty Learner 原作者的个人博客与项目记录。',
  },
  {
    title: 'Web Worker',
    href: 'https://www.xiaoyuzhoufm.com/podcast/613753ef23c82a9a1ccfdf35',
    imgSrc: web_worker,
    description: '由前端开发者参与的中文技术播客。',
  },
]

export const FriendLinks: React.FC = () => {
  return (
    <Layout>
      <div className="wenyan-studio-shell flex min-h-screen flex-col text-[var(--wenyan-ink)]">
        <Header />
        <main className="mx-auto w-full max-w-3xl flex-1 px-6 pb-16 pt-9">
          <div className="mb-7">
            <h1 className="wenyan-page-title">相关项目</h1>
            <p className="wenyan-muted mt-2 text-sm">Wenyan 的来源与一些值得看看的网站</p>
          </div>

          <section className="overflow-hidden rounded-[var(--wenyan-radius-md)] border border-[var(--wenyan-line-soft)] bg-[var(--wenyan-paper-raised)]">
            {links.map((link) => (
              <a
                key={link.href}
                title={link.title}
                href={link.href}
                target="_blank"
                rel="noopener noreferrer"
                className="wenyan-friend-link flex items-center gap-4 px-5 py-5 text-[var(--wenyan-ink)] no-underline"
              >
                <div className="h-10 w-10 shrink-0 overflow-hidden rounded-[10px] border border-[var(--wenyan-line-soft)] bg-[var(--wenyan-paper-muted)]">
                  <img src={link.imgSrc} alt="" className="h-full w-full object-cover" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-semibold">{link.title}</div>
                  <div className="wenyan-muted mt-1 text-xs leading-5">{link.description}</div>
                </div>
                <span aria-hidden="true" className="wenyan-muted text-sm">↗</span>
              </a>
            ))}
          </section>

          <p className="wenyan-muted mt-6 text-[11px] leading-5">
            Wenyan 基于 Qwerty Learner 继续演化；项目与许可证信息也可在“学习阶段”页面底部查看。
          </p>
        </main>
      </div>
    </Layout>
  )
}
