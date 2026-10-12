import type { ReactNode } from 'react'

export default function PageHeading({ title, description, children }: { title: string; description?: ReactNode; children?: ReactNode }) {
  return (
    <div className="wenyan-page-heading">
      <div className="wenyan-page-heading-copy">
        <h1 className="wenyan-page-title">{title}</h1>
        {description && <p className="wenyan-page-description">{description}</p>}
      </div>
      {children && <div className="wenyan-page-actions">{children}</div>}
    </div>
  )
}
