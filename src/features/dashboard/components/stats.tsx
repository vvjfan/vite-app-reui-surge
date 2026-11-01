import { useQuery } from "@tanstack/react-query"

import { Badge } from "@/components/reui/badge"
import {
  Frame,
  FrameHeader,
  FramePanel,
  FrameTitle,
} from "@/components/reui/frame"

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import { formatCurrency, formatNumber } from "@/lib/data/dashboard"
import { dashboardStatsQuery } from "../queries"
import type { DateRange } from "../queries"
import {
  DotsThreeIcon as MoreHorizontalIcon,
  ChartBarIcon as BarChart3Icon,
  WarningIcon as TriangleAlertIcon,
  DownloadSimpleIcon as DownloadIcon,
  PushPinIcon as Pin,
  TrashIcon as Trash2Icon,
  ArrowUpIcon,
  ArrowDownIcon,
} from "@phosphor-icons/react"

const STATS_GRID =
  "grid grid-cols-1 items-stretch gap-6 sm:grid-cols-2 lg:grid-cols-4"

// The tile reads top-to-bottom as one unit, so its top inset (above the title)
// must equal its bottom inset (below the "vs previous" line). Keeping the header
// at the default panel padding lands both at 16px; trimming it pulled the title
// 4px tighter to the top than the footer text sat to the bottom.
const STAT_FRAME = "h-full"

// Loading state: four skeleton tiles in the same grid, shown until the store
// read settles (no seed is rendered before then).
function StatsSkeleton() {
  return (
    <div className={STATS_GRID}>
      {Array.from({ length: 4 }).map((_, index) => (
        <Frame key={index} dense className={STAT_FRAME}>
          <FrameHeader className="flex-row items-center justify-between gap-3">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="size-6 rounded-md" />
          </FrameHeader>
          <FramePanel className="flex flex-1 flex-col gap-2.5">
            <div className="flex items-center gap-2.5">
              <Skeleton className="h-8 w-28" />
              <Skeleton className="h-5 w-12 rounded-md" />
            </div>
            <Separator />
            <Skeleton className="h-3.5 w-40" />
          </FramePanel>
        </Frame>
      ))}
    </div>
  )
}

export function Stats({ range }: { range: DateRange }) {
  const { data: stats } = useQuery(dashboardStatsQuery(range))
  if (!stats) return <StatsSkeleton />
  return (
    <div className={STATS_GRID}>
      {stats.map((stat, index) => (
        <Frame key={index} dense className={STAT_FRAME}>
          <FrameHeader className="flex-row items-center justify-between gap-3">
            <FrameTitle>{stat.title}</FrameTitle>
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <Button variant="ghost" size="icon-sm" className="-me-1.5" />
                }
              >
                <MoreHorizontalIcon aria-hidden="true" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" side="bottom" className="w-48">
                <DropdownMenuGroup>
                  <DropdownMenuItem>
                    <BarChart3Icon aria-hidden="true" />
                    View report
                  </DropdownMenuItem>
                  <DropdownMenuItem>
                    <TriangleAlertIcon aria-hidden="true" />
                    Add alert
                  </DropdownMenuItem>
                  <DropdownMenuItem>
                    <DownloadIcon aria-hidden="true" />
                    Export CSV
                  </DropdownMenuItem>
                  <DropdownMenuItem>
                    <Pin aria-hidden="true" />
                    Pin to dashboard
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem variant="destructive">
                    <Trash2Icon aria-hidden="true" />
                    Remove
                  </DropdownMenuItem>
                </DropdownMenuGroup>
              </DropdownMenuContent>
            </DropdownMenu>
          </FrameHeader>
          <FramePanel className="flex flex-1 flex-col gap-2.5">
            <div className="flex items-center gap-2.5">
              <span className="text-2xl font-semibold tracking-tight tabular-nums">
                {stat.format === "currency"
                  ? formatCurrency(stat.value)
                  : stat.prefix + formatNumber(stat.value) + stat.suffix}
              </span>
              <Badge
                variant={stat.positive ? "success-light" : "destructive-light"}
              >
                {/* Arrow and tone read the same field: a flat 0% is `positive`,
                    so testing `delta > 0` here drew a down arrow in a green
                    chip. A zero baseline makes that reachable. */}
                {stat.positive ? (
                  <ArrowUpIcon aria-hidden="true" />
                ) : (
                  <ArrowDownIcon aria-hidden="true" />
                )}
                {Math.abs(stat.delta)}%
              </Badge>
            </div>
            <Separator />
            <div className="text-xs text-muted-foreground">
              Vs previous period:{" "}
              <span className="font-medium text-foreground">
                {stat.format === "currency"
                  ? formatCurrency(stat.lastMonth)
                  : stat.prefix + formatNumber(stat.lastMonth) + stat.suffix}
              </span>
            </div>
          </FramePanel>
        </Frame>
      ))}
    </div>
  )
}
