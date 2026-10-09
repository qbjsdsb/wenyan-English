import { useSemanticEvidence } from '@/semantic/useEvidence'
import { Link } from 'react-router-dom'

export default function VocabularyEvidence() {
  const data = useSemanticEvidence()
  return <section className="wenyan-surface mb-7 px-6 py-5" aria-label="词义训练记录">
    <div className="flex items-center justify-between gap-4"><h2 className="text-sm font-semibold">词义训练 · 最近 14 天</h2><Link className="wenyan-link text-xs" to="/practice">去练一小段</Link></div>
    {!data ? <p className="wenyan-muted mt-4 text-xs" role="status">正在整理词义记录…</p> : data.error ? <p className="wenyan-muted mt-4 text-xs">词义记录暂时无法读取，已保存的记录仍在本机。</p> : <>
      <div className="mt-5 grid gap-5 sm:grid-cols-2">
        <div><p className="text-sm">主动回想 <span className="wenyan-mono ml-2">{data.recall?.attempts ?? 0} 次</span></p><p className="wenyan-muted mt-2 text-xs">自评：想起 {data.recall?.selfReported.recalled ?? 0} · 部分 {data.recall?.selfReported.partial ?? 0} · 没想起 {data.recall?.selfReported.notRecalled ?? 0}</p></div>
        <div className="sm:border-l sm:border-[var(--wenyan-line-soft)] sm:pl-5"><p className="text-sm">选择词义 <span className="wenyan-mono ml-2">{data.recognition?.attempts ?? 0} 次</span></p><p className="wenyan-muted mt-2 text-xs">辨认：选对 {data.recognition?.correct ?? 0} · 选错 {data.recognition?.incorrect ?? 0}</p></div>
      </div>
      <p className="wenyan-muted mt-5 text-[11px] leading-5">当前账号在本机可见的真实记录。主动回想是自评，辨认按参考选项判分；两者都不等于语义掌握。</p>
      {Boolean((data.recall?.revisit.length ?? 0) + (data.recognition?.revisit.length ?? 0)) && <Link className="wenyan-link mt-3 inline-block text-xs" to="/practice?pool=uncertain&mode=recall">回看仍然模糊的词 →</Link>}
    </>}
  </section>
}
