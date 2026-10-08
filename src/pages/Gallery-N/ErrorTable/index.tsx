import type { ErrorColumn } from './columns'
import { errorColumns } from './columns'
import { LoadingUI } from '@/components/Loading'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import type { SortingState } from '@tanstack/react-table'
import { flexRender, getCoreRowModel, getSortedRowModel, useReactTable } from '@tanstack/react-table'
import { useMemo, useState } from 'react'

interface DataTableProps {
  data: ErrorColumn[]
  isLoading: boolean
  error: unknown
  onDelete: (word: string) => Promise<void>
}

export function ErrorTable({ data, isLoading, error, onDelete }: DataTableProps) {
  const [sorting, setSorting] = useState<SortingState>([])
  const columns = useMemo(() => errorColumns(onDelete), [onDelete])

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    onSortingChange: setSorting,
    getSortedRowModel: getSortedRowModel(),
    state: { sorting },
    autoResetPageIndex: true,
  })

  return (
    <div className="h-full w-full overflow-hidden rounded-[var(--wenyan-radius-md)] border border-[var(--wenyan-line-soft)] bg-[var(--wenyan-paper-raised)]">
      <Table className="h-full w-full">
        <TableHeader className="sticky top-0 z-[1] bg-[color-mix(in_srgb,var(--wenyan-paper-raised)_94%,transparent)] backdrop-blur-sm">
          {table.getHeaderGroups().map((headerGroup) => (
            <TableRow key={headerGroup.id}>
              {headerGroup.headers.map((header) => (
                <TableHead key={header.id} colSpan={header.colSpan} style={{ width: header.getSize() }}>
                  {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                </TableHead>
              ))}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody className="w-full">
          {table.getRowModel().rows.length ? (
            table.getRowModel().rows.map((row) => (
              <TableRow key={row.id} data-state={row.getIsSelected() && 'selected'}>
                {row.getVisibleCells().map((cell) => (
                  <TableCell key={cell.id} style={{ width: cell.column.getSize() }}>
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </TableCell>
                ))}
              </TableRow>
            ))
          ) : (
            <TableRow>
              <TableCell colSpan={table.getAllColumns().length} className="h-[22rem] text-center">
                {isLoading ? (
                  <div className="flex flex-col items-center gap-3">
                    <LoadingUI label="正在读取错词" />
                    <span className="wenyan-muted text-[11px]">正在读取错词</span>
                  </div>
                ) : error ? (
                  <div className="mx-auto max-w-xs text-sm leading-6 text-[var(--wenyan-danger)]">暂时无法读取错词，请稍后再试。</div>
                ) : (
                  <div>
                    <div className="text-sm text-[var(--wenyan-ink-secondary)]">这本词书还没有错词</div>
                    <div className="wenyan-muted mt-1.5 text-[11px]">继续练习后，重复出错的词会出现在这里。</div>
                  </div>
                )}
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  )
}
