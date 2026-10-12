import { Link } from 'react-router-dom'

export default function TrainingHeader({ returnPath, returnLabel }: { returnPath: string; returnLabel: string }) {
  return (
    <header className="wenyan-focus-bar">
      <div className="mx-auto flex min-h-[58px] max-w-5xl items-center justify-between gap-6 px-6">
        <Link className="wenyan-brand text-[18px] font-semibold no-underline" to="/today">
          Wenyan
        </Link>
        <Link className="wenyan-link py-3 text-[13px]" to={returnPath}>
          {returnLabel}
        </Link>
      </div>
    </header>
  )
}
