import { useCallback, useMemo } from "react"

import { DataGrid } from "@/components/reui/data-grid/data-grid"
import { DataGridScrollArea } from "@/components/reui/data-grid/data-grid-scroll-area"
import { DataGridTable } from "@/components/reui/data-grid/data-grid-table"
import { Frame, FramePanel } from "@/components/reui/frame"
import { PageHeader } from "@/components/shared/page-header"
import { getCoreRowModel, useReactTable } from "@tanstack/react-table"

import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  useNotificationPrefs,
  useUpdateNotificationPref,
} from "@/features/settings/queries"
import { type NotificationPref } from "@/lib/data/notifications"
import { createNotificationColumns, type ChannelKey } from "./columns"

interface Group {
  id: string
  title: string
  items: NotificationPref[]
}

interface Tab {
  id: string
  label: string
  groups: Group[]
}

type ToggleHandler = (
  pref: NotificationPref,
  key: ChannelKey,
  checked: boolean
) => void

// Rebuild the tabbed matrix from the flat, seeded preference rows.
function buildTabs(prefs: NotificationPref[]): Tab[] {
  const sorted = [...prefs].sort((a, b) => a.order - b.order)
  const order: string[] = []
  const tabs = new Map<
    string,
    {
      id: string
      label: string
      groups: Map<string, Group>
    }
  >()
  for (const p of sorted) {
    if (!tabs.has(p.tabId)) {
      tabs.set(p.tabId, { id: p.tabId, label: p.tabLabel, groups: new Map() })
      order.push(p.tabId)
    }
    const tab = tabs.get(p.tabId)!
    if (!tab.groups.has(p.groupId)) {
      tab.groups.set(p.groupId, {
        id: p.groupId,
        title: p.groupTitle,
        items: [],
      })
    }
    tab.groups.get(p.groupId)!.items.push(p)
  }
  return order.map((id) => {
    const tab = tabs.get(id)!
    return { id: tab.id, label: tab.label, groups: [...tab.groups.values()] }
  })
}

// One grid per group: the group title is the label column's header, and each
// channel is a column.
function GroupGrid({
  group,
  onToggle,
}: {
  group: Group
  onToggle: ToggleHandler
}) {
  const columns = useMemo(
    () => createNotificationColumns({ groupTitle: group.title, onToggle }),
    [group.title, onToggle]
  )

  const table = useReactTable({
    columns,
    data: group.items,
    getRowId: (row) => row.id,
    getCoreRowModel: getCoreRowModel(),
  })

  return (
    <DataGrid
      table={table}
      recordCount={group.items.length}
      tableLayout={{ width: "auto" }}
      // The panel's own padding already lines up with the FrameHeader, so the
      // edge cells sit flush against it rather than indenting again.
      tableClassNames={{ edgeCell: "first:ps-0 last:pe-0" }}
    >
      <DataGridScrollArea orientation="horizontal">
        <DataGridTable />
      </DataGridScrollArea>
    </DataGrid>
  )
}

// Placeholder shown while the client reads preferences from the store, so no
// seed is rendered before the DB read settles. The tabs and groups are derived
// from the rows themselves, so nothing of the real shape exists until then.
function NotificationsSkeleton() {
  return (
    <div className="flex flex-col gap-5">
      <div className="flex gap-5">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-4 w-20" />
        ))}
      </div>
      {Array.from({ length: 2 }).map((_ignored, group) => (
        <div key={group} className="flex flex-col gap-4">
          <Skeleton className="h-4 w-32" />
          {Array.from({ length: 3 }).map((_ignored2, row) => (
            <div key={row} className="flex items-center justify-between gap-4">
              <Skeleton className="h-4 w-44" />
              <div className="flex gap-10">
                <Skeleton className="size-4 rounded" />
                <Skeleton className="size-4 rounded" />
                <Skeleton className="size-4 rounded" />
              </div>
            </div>
          ))}
        </div>
      ))}
    </div>
  )
}

// Notifications settings: a per-channel matrix of store events seeded into the
// demo `notificationPrefs` store and queried; each toggle persists the record.
export function NotificationPreferences() {
  const prefsQuery = useNotificationPrefs()
  const updatePref = useUpdateNotificationPref()
  const tabs = useMemo(
    () => buildTabs(prefsQuery.data ?? []),
    [prefsQuery.data]
  )

  const handleToggle = useCallback<ToggleHandler>(
    (pref, key, checked) =>
      updatePref.mutate({ id: pref.id, patch: { [key]: checked } }),
    [updatePref]
  )

  return (
    <div className="flex w-full flex-col gap-4">
      <PageHeader title="Notifications" />

      <Frame dense className="w-full">
        <FramePanel>
          {prefsQuery.isPending ? (
            <NotificationsSkeleton />
          ) : (
            <Tabs defaultValue={tabs[0]?.id ?? "orders"}>
              <TabsList variant="line" className="mb-3.5 p-0!">
                {tabs.map((tab) => (
                  <TabsTrigger key={tab.id} value={tab.id}>
                    {tab.label}
                  </TabsTrigger>
                ))}
              </TabsList>

              {tabs.map((tab) => (
                <TabsContent key={tab.id} value={tab.id} className="space-y-5">
                  {tab.groups.map((group) => (
                    <GroupGrid
                      key={group.id}
                      group={group}
                      onToggle={handleToggle}
                    />
                  ))}
                </TabsContent>
              ))}
            </Tabs>
          )}
        </FramePanel>
      </Frame>
    </div>
  )
}
