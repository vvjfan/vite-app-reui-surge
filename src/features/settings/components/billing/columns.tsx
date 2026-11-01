"use client"

import { Badge } from "@/components/reui/badge"
import type { ColumnDef } from "@tanstack/react-table"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import type { Invoice } from "@/lib/data/billing"
import { DownloadSimpleIcon as DownloadIcon } from "@phosphor-icons/react"

// Date and amount are stored as display strings, so neither could be sorted
// correctly by its own value; the grid is ordered by id instead and no column
// offers a sort that would lie.
export function createInvoiceColumns(): ColumnDef<Invoice>[] {
  return [
    {
      accessorKey: "date",
      id: "date",
      header: "Date",
      cell: ({ row }) => row.original.date,
      enableSorting: false,
      enableHiding: false,
      enableResizing: false,
      meta: {
        headerTitle: "Date",
        headerClassName: "w-full",
        skeleton: <Skeleton className="h-4 w-24" />,
      },
    },
    {
      accessorKey: "amount",
      id: "amount",
      header: "Amount",
      cell: ({ row }) => (
        <span className="tabular-nums">{row.original.amount}</span>
      ),
      enableSorting: false,
      enableHiding: false,
      enableResizing: false,
      meta: {
        headerTitle: "Amount",
        skeleton: <Skeleton className="h-4 w-16" />,
      },
    },
    {
      id: "status",
      header: "Status",
      cell: () => <Badge variant="success-light">Paid</Badge>,
      enableSorting: false,
      enableHiding: false,
      enableResizing: false,
      meta: {
        headerTitle: "Status",
        skeleton: <Skeleton className="h-5 w-12 rounded-full" />,
      },
    },
    {
      id: "receipt",
      header: "Receipt",
      cell: ({ row }) => (
        <Button
          variant="ghost"
          size="sm"
          onClick={() =>
            toast.success("Receipt downloaded", {
              description: `${row.original.id}.pdf`,
            })
          }
        >
          <DownloadIcon aria-hidden="true" />
          PDF
        </Button>
      ),
      enableSorting: false,
      enableHiding: false,
      enableResizing: false,
      meta: {
        headerTitle: "Receipt",
        headerClassName: "text-right",
        cellClassName: "text-right",
        skeleton: <Skeleton className="ms-auto h-7 w-14" />,
      },
    },
  ]
}
