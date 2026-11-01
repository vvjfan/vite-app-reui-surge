"use client"

import { useCallback, useMemo, useState } from "react"
import { DataGrid } from "@/components/reui/data-grid/data-grid"
import { DataGridColumnVisibility } from "@/components/reui/data-grid/data-grid-column-visibility"
import { DataGridPagination } from "@/components/reui/data-grid/data-grid-pagination"
import { DataGridScrollArea } from "@/components/reui/data-grid/data-grid-scroll-area"
import { DataGridTable } from "@/components/reui/data-grid/data-grid-table"
import {
  createFilter,
  Filters,
  type Filter,
  type FilterFieldConfig,
} from "@/components/reui/filters"
import { Frame, FrameFooter, FramePanel } from "@/components/reui/frame"
import {
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  type PaginationState,
  type RowSelectionState,
  type SortingState,
  type VisibilityState,
} from "@tanstack/react-table"
import { toast } from "sonner"

import { PageHeader } from "@/components/shared/page-header"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { TooltipProvider } from "@/components/ui/tooltip"
import { BulkActionBar } from "./bulk-action-bar"
import { createMemberColumns, RoleBadge, StatusBadge } from "./columns"
import {
  useBilling,
  useInviteMembers,
  useTeamMembers,
  useUpdateMembers,
} from "@/features/settings/queries"
import {
  ROLE_ORDER,
  STATUS_ORDER,
  TEAM_LABELS,
  type IMember,
  type MemberRole,
  type MemberStatus,
  type TeamLabel,
} from "./data"
import { type InviteRoleId } from "./invite-role-select"
import { CollaboratorInviteDialog } from "./collaborator-invite-dialog"
import { MemberDetailSheet } from "./member-detail-sheet"
import {
  UserIcon,
  EnvelopeIcon as MailIcon,
  ShieldCheckIcon,
  DotOutlineIcon as CircleDotIcon,
  UsersIcon,
  UserPlusIcon,
  FunnelIcon as FilterIcon,
  FunnelXIcon,
  GearSixIcon as Settings2Icon,
} from "@phosphor-icons/react"

// Map the invite dialog's role vocabulary to the member roles stored in the DB.
const INVITE_ROLE_TO_MEMBER: Record<InviteRoleId, MemberRole> = {
  member: "Member",
  contributor: "Member",
  reviewer: "Guest",
  admin: "Admin",
}

// ── Helpers ──

function getActiveFilters(filters: Filter[]) {
  return filters.filter((filter) => {
    const { values } = filter
    if (values.length === 0) return false
    if (
      values.every((value) => typeof value === "string" && value.trim() === "")
    )
      return false
    if (values.every((value) => value === null || value === undefined))
      return false
    if (values.every((value) => Array.isArray(value) && value.length === 0))
      return false
    return true
  })
}

function filterFieldValue(item: IMember, field: string): unknown {
  if (field === "teams") return item.teams.join(" ")
  return item[field as keyof IMember]
}

function applyFiltersToData(data: IMember[], filters: Filter[]): IMember[] {
  const active = getActiveFilters(filters)
  let result = [...data]
  active.forEach((filter) => {
    const { field, operator, values } = filter
    result = result.filter((item) => {
      if (field === "teams") {
        const selected = values.map(String)
        switch (operator) {
          case "is":
            return (
              selected.length > 0 &&
              item.teams.includes(selected[0] as TeamLabel)
            )
          case "is_not":
            return !selected.some((v) => item.teams.includes(v as TeamLabel))
          case "is_any_of":
            return selected.some((v) => item.teams.includes(v as TeamLabel))
          case "is_not_any_of":
            return !selected.some((v) => item.teams.includes(v as TeamLabel))
          case "contains": {
            const tokens = values.map((v) => String(v).trim()).filter(Boolean)
            if (tokens.length === 0) return true
            return tokens.some((token) =>
              item.teams.some((t) =>
                t.toLowerCase().includes(token.toLowerCase())
              )
            )
          }
          case "not_contains":
            return !values.some((v) =>
              item.teams.some((t) =>
                t.toLowerCase().includes(String(v).toLowerCase())
              )
            )
          default:
            return true
        }
      }

      const raw = filterFieldValue(item, field)
      const fieldValue = raw != null ? raw : ""

      switch (operator) {
        case "is":
          return values.includes(fieldValue)
        case "is_not":
          return !values.includes(fieldValue)
        case "is_any_of":
          return values.some((v) => fieldValue === v)
        case "is_not_any_of":
          return !values.some((v) => fieldValue === v)
        case "contains": {
          const tokens = values.map((v) => String(v).trim()).filter(Boolean)
          if (tokens.length === 0) return true
          return tokens.some((token) =>
            String(fieldValue).toLowerCase().includes(token.toLowerCase())
          )
        }
        case "not_contains":
          return !values.some((v) =>
            String(fieldValue).toLowerCase().includes(String(v).toLowerCase())
          )
        case "starts_with":
          return values.some((v) =>
            String(fieldValue).toLowerCase().startsWith(String(v).toLowerCase())
          )
        case "ends_with":
          return values.some((v) =>
            String(fieldValue).toLowerCase().endsWith(String(v).toLowerCase())
          )
        case "empty":
          return fieldValue === ""
        case "not_empty":
          return fieldValue !== ""
        default:
          return true
      }
    })
  })
  return result
}

const STATUS_OPTIONS: { value: MemberStatus; label: string }[] =
  STATUS_ORDER.map((status) => ({ value: status, label: status }))

const ROLE_OPTIONS: { value: MemberRole; label: string }[] = ROLE_ORDER.map(
  (role) => ({ value: role, label: role })
)

function renderSelectedCount(values: unknown[]) {
  if (values.length === 0) return "Select..."
  if (values.length > 1) return `${values.length} selected`
  return null
}

function createDefaultMemberFilters(): Filter[] {
  return [createFilter("name", "contains", [""])]
}

// ── Main ──

export function MembersGrid() {
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: 10,
  })
  const [sorting, setSorting] = useState<SortingState>([
    { id: "name", desc: false },
  ])
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({
    seat: false,
  })
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({})
  const [filters, setFilters] = useState<Filter[]>(createDefaultMemberFilters)
  const [bulkRole, setBulkRole] = useState<MemberRole>("Member")

  const [activeMember, setActiveMember] = useState<IMember | null>(null)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [inviteOpen, setInviteOpen] = useState(false)

  // Live members from the demo collection (seeded on first load).
  const membersQuery = useTeamMembers()
  const members = membersQuery.data ?? []
  const inviteMembers = useInviteMembers()
  const updateMembers = useUpdateMembers()

  // Seats and pending invites derive from the same two sources Billing meters
  // against (member count vs billing.limits.seats), so the two settings pages
  // cannot disagree about the same team.
  const billingQuery = useBilling()
  const seatLimit = billingQuery.data?.limits.seats
  const pendingInvites = members.filter((m) => m.status === "Invited").length

  // Header count badge mirrors the old frame subtitle: undefined until the store
  // read resolves (so no number shows mid-load), then seats used against the
  // billing limit, with any pending invites appended.
  const seatSummary = membersQuery.isPending
    ? undefined
    : `${members.length}${
        seatLimit !== undefined ? ` of ${seatLimit}` : ""
      } seat${members.length === 1 && seatLimit === undefined ? "" : "s"}${
        pendingInvites > 0 ? ` · ${pendingInvites} pending` : ""
      }`

  const filterFields: FilterFieldConfig[] = useMemo(
    () => [
      {
        key: "name",
        label: "Member",
        icon: <UserIcon className="size-3.5" aria-hidden />,
        type: "text",
        className: "w-44",
        placeholder: "Search...",
      },
      {
        key: "email",
        label: "Email",
        icon: <MailIcon className="size-3.5" aria-hidden />,
        type: "text",
        className: "w-48",
        placeholder: "Search...",
      },
      {
        key: "role",
        label: "Role",
        icon: <ShieldCheckIcon className="size-3.5" aria-hidden />,
        type: "select",
        searchable: false,
        className: "w-[160px]",
        options: ROLE_OPTIONS,
        customValueRenderer: (values) => {
          const state = renderSelectedCount(values)
          if (state) return state

          return <RoleBadge role={values[0] as MemberRole} />
        },
      },
      {
        key: "status",
        label: "Status",
        icon: <CircleDotIcon className="size-3.5" aria-hidden />,
        type: "select",
        searchable: false,
        className: "w-[150px]",
        options: STATUS_OPTIONS,
        customValueRenderer: (values) => {
          const state = renderSelectedCount(values)
          if (state) return state

          return <StatusBadge status={values[0] as MemberStatus} />
        },
      },
      {
        key: "teams",
        label: "Team",
        icon: <UsersIcon className="size-3.5" aria-hidden />,
        type: "select",
        searchable: true,
        className: "w-[190px]",
        options: TEAM_LABELS.map((team) => ({
          value: team,
          label: team,
        })),
        customValueRenderer: (values) => {
          const state = renderSelectedCount(values)
          if (state) return state

          return String(values[0])
        },
      },
    ],
    []
  )

  // Rows shown = the live DB members with the active filters applied client-side.
  const filteredData = useMemo(
    () => applyFiltersToData(members, filters),
    [members, filters]
  )

  const handleFiltersChange = useCallback((newFilters: Filter[]) => {
    setFilters(newFilters)
    setPagination((prev) => ({ ...prev, pageIndex: 0 }))
    setRowSelection({})
  }, [])

  const handleView = useCallback((member: IMember) => {
    setActiveMember(member)
    setSheetOpen(true)
  }, [])

  const columns = useMemo(
    () => createMemberColumns({ onView: handleView }),
    [handleView]
  )

  const [columnOrder, setColumnOrder] = useState<string[]>(
    columns.map((c) => c.id as string)
  )

  const table = useReactTable({
    columns,
    data: filteredData,
    pageCount: Math.ceil(filteredData.length / pagination.pageSize),
    getRowId: (row) => row.id,
    state: {
      pagination,
      sorting,
      columnOrder,
      columnVisibility,
      rowSelection,
    },
    enableRowSelection: true,
    columnResizeMode: "onChange",
    onColumnOrderChange: setColumnOrder,
    onColumnVisibilityChange: setColumnVisibility,
    onPaginationChange: setPagination,
    onSortingChange: setSorting,
    onRowSelectionChange: setRowSelection,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
  })

  const selectedCount = table.getSelectedRowModel().rows.length

  const handleClearSelection = useCallback(() => setRowSelection({}), [])

  const selectedIds = useCallback(
    () => table.getSelectedRowModel().rows.map((r) => r.original.id),
    [table]
  )

  const handleChangeRole = useCallback(() => {
    const ids = selectedIds()
    if (ids.length === 0) return
    setRowSelection({})
    updateMembers.mutate(
      ids.map((id) => ({ id, patch: { role: bulkRole } })),
      {
        onSuccess: () =>
          toast.success("Role updated", {
            description: `${ids.length} member${ids.length === 1 ? "" : "s"} moved to ${bulkRole}.`,
          }),
      }
    )
  }, [bulkRole, selectedIds, updateMembers])

  const handleBulkResend = useCallback(() => {
    const ids = selectedIds()
    if (ids.length === 0) return
    setRowSelection({})
    toast.info("Invites resent", {
      description: `${ids.length} link${ids.length === 1 ? "" : "s"} sent. Each expires in 7 days.`,
    })
  }, [selectedIds])

  const handleBulkDeactivate = useCallback(() => {
    const ids = selectedIds()
    if (ids.length === 0) return
    setRowSelection({})
    updateMembers.mutate(
      ids.map((id) => ({ id, patch: { status: "Deactivated" as const } })),
      {
        onSuccess: () =>
          toast.message("Members deactivated", {
            description: `${ids.length} member${ids.length === 1 ? "" : "s"} can no longer sign in.`,
          }),
      }
    )
  }, [selectedIds, updateMembers])

  const showClearButton = filters.length > 0

  // An empty grid has two causes that call for opposite responses, so the
  // message has to say which: nobody is on the team, or filters that exclude
  // every member there is.
  const emptyMessage =
    members.length === 0
      ? "No members yet. Invite one to start collaborating."
      : "No members match your filters. Clear filters or adjust operators."

  return (
    <TooltipProvider delay={200}>
      <div className="flex w-full flex-col gap-4">
        <PageHeader
          title="Team"
          count={seatSummary}
          actions={
            <Button type="button" onClick={() => setInviteOpen(true)}>
              <UserPlusIcon aria-hidden="true" />
              Invite people
            </Button>
          }
        />
        {/* Table */}
        <DataGrid
          table={table}
          isLoading={membersQuery.isPending}
          loadingMode="skeleton"
          recordCount={filteredData.length}
          emptyMessage={
            !membersQuery.isPending && filteredData.length === 0
              ? emptyMessage
              : undefined
          }
          tableLayout={{
            columnsResizable: true,
            columnsMovable: true,
            columnsVisibility: true,
            headerSticky: true,
            dense: true,
          }}
        >
          <Frame dense className="w-full">
            <FramePanel className="p-0! shadow-none!">
              <div className="flex flex-wrap items-center justify-between gap-2 px-(--frame-panel-header-px) py-(--frame-panel-header-py)">
                <Filters
                  filters={filters}
                  fields={filterFields}
                  onChange={handleFiltersChange}
                  trigger={
                    <Button
                      type="button"
                      variant="outline"
                      aria-label="Filters"
                    >
                      <FilterIcon aria-hidden />
                      Filters
                    </Button>
                  }
                />
                <div className="flex flex-wrap items-center gap-2">
                  {showClearButton && (
                    <Button
                      type="button"
                      variant="outline"
                      className="shrink-0"
                      onClick={() => {
                        setFilters(createDefaultMemberFilters())
                        setRowSelection({})
                      }}
                    >
                      <FunnelXIcon aria-hidden />
                      Clear
                    </Button>
                  )}
                  <DataGridColumnVisibility
                    table={table}
                    trigger={
                      <Button
                        type="button"
                        variant="outline"
                        aria-label="View settings"
                      >
                        <Settings2Icon aria-hidden="true" />
                        View settings
                      </Button>
                    }
                  />
                </div>
              </div>
              <Separator />
              {selectedCount > 0 ? (
                <>
                  <BulkActionBar
                    selectedCount={selectedCount}
                    roleValue={bulkRole}
                    onRoleChange={setBulkRole}
                    onChangeRole={handleChangeRole}
                    onResendInvite={handleBulkResend}
                    onDeactivate={handleBulkDeactivate}
                    onClear={handleClearSelection}
                  />
                  <Separator />
                </>
              ) : null}
              <DataGridScrollArea>
                <DataGridTable />
              </DataGridScrollArea>
              <Separator />
              <FrameFooter>
                <DataGridPagination sizes={[10, 20, 30]} />
              </FrameFooter>
            </FramePanel>
          </Frame>
        </DataGrid>
      </div>

      <MemberDetailSheet
        member={activeMember}
        open={sheetOpen}
        onOpenChange={setSheetOpen}
      />

      <CollaboratorInviteDialog
        open={inviteOpen}
        onOpenChange={setInviteOpen}
        isSending={inviteMembers.isPending}
        onInvite={(invites) =>
          inviteMembers.mutate(
            invites.map((i) => ({
              email: i.email,
              role: INVITE_ROLE_TO_MEMBER[i.roleId],
            })),
            {
              // Close and report only once the write lands. On failure the hook
              // toasts the error and the dialog stays open with the emails.
              onSuccess: (created) => {
                setInviteOpen(false)
                toast.success(
                  created.length === 1
                    ? "Invitation sent"
                    : `${created.length} invitations sent`,
                  { description: "Each invite link expires in 7 days." }
                )
              },
            }
          )
        }
      />
    </TooltipProvider>
  )
}
