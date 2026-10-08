import type React from 'react'

interface DataTagProps {
  icon: React.ElementType
  name: string
  data: number | string
}

const DataTag: React.FC<DataTagProps> = ({ icon, name, data }) => {
  const IconComponent = icon
  return (
    <div className="flex items-center justify-between gap-4">
      <div className="flex items-center gap-2 text-gray-400 dark:text-gray-600">
        <IconComponent className="h-4 w-4" />
        <span className="text-xs">{name}</span>
      </div>
      <span className="text-sm font-medium tabular-nums text-gray-800 dark:text-gray-300">{data}</span>
    </div>
  )
}

export default DataTag
