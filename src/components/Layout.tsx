import type React from 'react'

export default function Layout({ children }: { children: React.ReactNode }) {
  return <div className="wenyan-studio-shell flex min-h-screen w-full flex-col">{children}</div>
}
