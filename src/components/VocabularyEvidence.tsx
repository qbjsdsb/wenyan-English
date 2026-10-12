import { useSemanticEvidence } from '@/semantic/useEvidence'
import { ArrowUpRight } from 'lucide-react'
import { Link } from 'react-router-dom'

export default function VocabularyEvidence() {
  const data = useSemanticEvidence()
  const rows = [
    {
      mode: 'recall',
      title: '词义回想',
      basis: '自评',
      count: data?.recall?.attempts ?? 0,
      detail: `想起 ${data?.recall?.selfReported.recalled ?? 0} · 部分 ${data?.recall?.selfReported.partial ?? 0} · 没想起 ${
        data?.recall?.selfReported.notRecalled ?? 0
      }`,
      revisit: data?.recall?.revisit.length ?? 0,
    },
    {
      mode: 'discrimination',
      title: '选择词义',
      basis: '按词书核对',
      count: data?.recognition?.attempts ?? 0,
      detail: `选对 ${data?.recognition?.correct ?? 0} · 选错 ${data?.recognition?.incorrect ?? 0}`,
      revisit: data?.recognition?.revisit.length ?? 0,
    },
    {
      mode: 'production',
      title: '看义写词',
      basis: '按词书核对',
      count: data?.production?.attempts ?? 0,
      detail: `写对 ${data?.production?.correct ?? 0} · 写错 ${data?.production?.incorrect ?? 0}`,
      revisit: data?.production?.revisit.length ?? 0,
    },
  ]
  return (
    <section className="wenyan-evidence-section mb-8" aria-label="词义训练记录">
      <div className="flex flex-wrap items-baseline justify-between gap-3 pb-4">
        <h2 className="wenyan-section-title">词义训练</h2>
        <span className="wenyan-muted text-xs">最近 14 天 · 各词书记录</span>
      </div>
      {!data ? (
        <p className="wenyan-muted py-5 text-sm" role="status">
          正在整理词义记录…
        </p>
      ) : data.error ? (
        <p className="wenyan-muted py-5 text-sm" role="status">
          词义记录暂时无法读取。
        </p>
      ) : (
        rows.map((row) => (
          <div key={row.mode} className="wenyan-evidence-row">
            <div>
              <h3 className="text-sm font-medium">{row.title}</h3>
              <p className="wenyan-muted mt-1 text-[11px]">{row.basis}</p>
            </div>
            <p className="wenyan-evidence-count wenyan-mono text-lg">
              {row.count || '—'} <span className="wenyan-muted text-xs">{row.count ? '次' : ''}</span>
            </p>
            <p className="wenyan-muted text-xs leading-6">{row.count ? row.detail : '还没有这类练习记录。'}</p>
            <Link
              className="wenyan-link inline-flex items-center gap-1 text-xs"
              aria-label={`${row.title}：${row.revisit ? '回看模糊词' : '开始训练'}`}
              to={`/practice?mode=${row.mode}&pool=${row.revisit ? 'uncertain' : 'chapter'}`}
            >
              {row.revisit ? '回看模糊词' : '开始训练'} <ArrowUpRight size={13} aria-hidden="true" />
            </Link>
          </div>
        ))
      )}
      <p className="wenyan-muted mt-3 text-[11px] leading-5">自评与客观判分分别记录；进入专项后，可选择要练的词书与范围。</p>
    </section>
  )
}
