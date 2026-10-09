import { BookOpen } from 'lucide-react'
import { Link } from 'react-router-dom'

export default function EmptyState({ title, description }: { title: string; description: string }) {
  return (
    <section className="wenyan-empty-state">
      <span className="wenyan-empty-mark" aria-hidden="true"><BookOpen size={24} strokeWidth={1.4} /></span>
      <h2 className="mt-5 text-lg font-medium text-[var(--wenyan-ink)]">{title}</h2>
      <p className="wenyan-muted mt-2 max-w-sm text-sm leading-7">{description}</p>
      <Link to="/today" className="wenyan-button-secondary mt-6 inline-flex items-center no-underline">回到今天</Link>
    </section>
  )
}
