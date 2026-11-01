import { useQuery } from "@tanstack/react-query"

import { PageHeader } from "@/components/shared/page-header"
import { Badge } from "@/components/reui/badge"
import { sessionsOverTimeQuery } from "../queries"
import { formatDayLabel } from "../lib/format"

export function AnalyticsHeader() {
  const { data: sessions } = useQuery(sessionsOverTimeQuery())

  // The reporting window is the data's own range, not the wall clock: the seed
  // is deterministic and fixed, so a window from today would be empty.
  const days = sessions
    ? [...sessions].sort((a, b) => a.date.localeCompare(b.date))
    : []
  const range =
    days.length > 0
      ? `${formatDayLabel(days[0].date)} - ${formatDayLabel(days[days.length - 1].date)}`
      : undefined

  return (
    <PageHeader
      title="Analytics"
      actions={range ? <Badge variant="secondary">{range}</Badge> : undefined}
    />
  )
}
