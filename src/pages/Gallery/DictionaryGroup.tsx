import DictionaryCard from './DictionaryCard'
import type { Dictionary } from '@/typings'
import type React from 'react'

const DictionaryGroup: React.FC<DictionaryGroupProps> = ({ title, dictionaries }) => {
  return (
    <section className="mb-5">
      <h3 className="sticky top-0 z-10 mb-1 bg-[#f6f6f3]/95 px-3 py-2 text-[11px] font-medium text-gray-400 backdrop-blur dark:bg-[#111210]/95 dark:text-gray-600">
        {title}
      </h3>
      <div className="space-y-1">
        {dictionaries.map((dict) => (
          <DictionaryCard key={dict.id} dictionary={dict} />
        ))}
      </div>
    </section>
  )
}

export default DictionaryGroup

export type DictionaryGroupProps = { title: string; dictionaries: Dictionary[] }
