"use client"

import type { ColumnDef } from "@tanstack/react-table"

import { Checkbox } from "@/components/ui/checkbox"
import { CHANNELS, type NotificationPref } from "@/lib/data/notifications"

export type ChannelKey = "email" | "sms" | "inApp"

// Index-aligned with CHANNELS: position i is the record field behind label i.
export const CHANNEL_KEYS: ChannelKey[] = ["email", "sms", "inApp"]

interface ColumnHandlers {
  groupTitle: string
  onToggle: (pref: NotificationPref, key: ChannelKey, checked: boolean) => void
}

export function createNotificationColumns({
  groupTitle,
  onToggle,
}: ColumnHandlers): ColumnDef<NotificationPref>[] {
  return [
    {
      accessorKey: "label",
      id: "label",
      header: groupTitle,
      cell: ({ row }) => row.original.label,
      enableSorting: false,
      enableHiding: false,
      enableResizing: false,
      meta: {
        headerTitle: groupTitle,
        headerClassName: "w-full font-semibold",
      },
    },
    ...CHANNEL_KEYS.map<ColumnDef<NotificationPref>>((key, i) => ({
      id: key,
      header: CHANNELS[i],
      cell: ({ row }) => (
        <div className="flex justify-center">
          <Checkbox
            checked={row.original[key]}
            onCheckedChange={(checked) =>
              onToggle(row.original, key, checked === true)
            }
            aria-label={`${row.original.label} via ${CHANNELS[i]}`}
          />
        </div>
      ),
      enableSorting: false,
      enableHiding: false,
      enableResizing: false,
      meta: {
        // The label column takes every spare pixel, so without this the channel
        // headers collapse to their narrowest word break.
        headerTitle: CHANNELS[i],
        headerClassName: "text-center whitespace-nowrap",
      },
    })),
  ]
}
