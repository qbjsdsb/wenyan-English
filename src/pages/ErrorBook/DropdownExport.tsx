import { idDictionaryMap } from '@/resources/dictionary'
import { wordListFetcher } from '@/utils/wordListFetcher'
import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
import { saveAs } from 'file-saver'
import type { FC } from 'react'
import { useState } from 'react'
import * as XLSX from 'xlsx'

type DropdownProps = {
  renderRecords: any
}

const DropdownExport: FC<DropdownProps> = ({ renderRecords }) => {
  const [isExporting, setIsExporting] = useState(false)

  const formatTimestamp = (date: any) => {
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    const hours = String(date.getHours()).padStart(2, '0')
    const minutes = String(date.getMinutes()).padStart(2, '0')
    const seconds = String(date.getSeconds()).padStart(2, '0')
    return `${year}-${month}-${day} ${hours}-${minutes}-${seconds}`
  }

  const handleExport = async (bookType: string) => {
    setIsExporting(true)
    try {
      const dictUrls: string[] = []
      renderRecords.forEach((item: any) => {
        const dictInfo = idDictionaryMap[item.dict]
        if (dictInfo?.url && !dictUrls.includes(dictInfo.url)) dictUrls.push(dictInfo.url)
      })

      const dictDataResults = await Promise.all(
        dictUrls.map(async (url) => {
          try {
            const data = await wordListFetcher(url)
            return { url, data }
          } catch (error) {
            console.error(`Failed to fetch dictionary data from ${url}:`, error)
            return { url, data: [] }
          }
        }),
      )
      const dictDataMap = new Map(dictDataResults.map((result) => [result.url, result.data]))
      const exportData: Array<{ 单词: string; 释义: string; 错误次数: number; 词典: string }> = []

      renderRecords.forEach((item: any) => {
        const dictInfo = idDictionaryMap[item.dict]
        let translation = ''
        if (dictInfo?.url && dictDataMap.has(dictInfo.url)) {
          const wordList = dictDataMap.get(dictInfo.url) || []
          const word = wordList.find((entry: any) => entry.name === item.word)
          translation = word ? word.trans.join('；') : ''
        }
        exportData.push({
          单词: item.word,
          释义: translation,
          错误次数: item.wrongCount,
          词典: dictInfo?.name || item.dict,
        })
      })

      let blob: Blob
      if (bookType === 'txt') {
        blob = new Blob([exportData.map((item) => `${item.单词}: ${item.释义}`).join('\n')], { type: 'text/plain' })
      } else {
        const worksheet = XLSX.utils.json_to_sheet(exportData)
        const workbook = XLSX.utils.book_new()
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Sheet1')
        blob = new Blob([XLSX.write(workbook, { bookType: bookType as XLSX.BookType, type: 'array' })], { type: 'application/octet-stream' })
      }

      saveAs(blob, `ErrorBook_${formatTimestamp(new Date())}.${bookType}`)
    } catch (error) {
      console.error('Export failed:', error)
      alert('导出失败，请重试')
    } finally {
      setIsExporting(false)
    }
  }

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button
          className="rounded-lg border border-black/[0.09] px-3.5 py-2 text-sm text-gray-600 transition-colors hover:bg-black/[0.03] disabled:opacity-50 dark:border-white/[0.1] dark:text-gray-400 dark:hover:bg-white/[0.04]"
          disabled={isExporting}
        >
          {isExporting ? '导出中…' : '导出'}
        </button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="end"
          sideOffset={6}
          className="z-50 min-w-28 rounded-lg border border-black/[0.09] bg-[#fbfbf8] p-1 text-sm shadow-lg dark:border-white/[0.1] dark:bg-[#171816]"
        >
          {['xlsx', 'csv'].map((type) => (
            <DropdownMenu.Item
              key={type}
              className="cursor-pointer rounded-md px-3 py-2 text-gray-600 outline-none hover:bg-black/[0.04] focus:bg-black/[0.04] dark:text-gray-400 dark:hover:bg-white/[0.05] dark:focus:bg-white/[0.05]"
              onClick={() => handleExport(type)}
              disabled={isExporting}
            >
              .{type}
            </DropdownMenu.Item>
          ))}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  )
}

export default DropdownExport
