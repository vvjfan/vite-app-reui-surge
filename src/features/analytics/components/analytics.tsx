import { AnalyticsHeader } from "./analytics-header"
import { AnalyticsKpis } from "./analytics-kpis"
import { ChannelMixChart } from "./channel-mix-chart"
import { ConversionFunnel } from "./conversion-funnel"
import { SalesByCategoryChart } from "./sales-by-category-chart"
import { SalesSessionsChart } from "./sales-sessions-chart"

// Page composition mirrors the dashboard: a container query context, the header,
// the KPI strip, the hero, the funnel, then a wide chart beside a narrow one.
// The shared content frame (max width, padding) lives in _app.tsx, so this
// renders content directly.
export function Analytics() {
  return (
    <div className="@container flex flex-col gap-6">
      <AnalyticsHeader />
      <AnalyticsKpis />
      <SalesSessionsChart />
      <ConversionFunnel />
      <div className="grid gap-6 @4xl:grid-cols-3">
        <div className="@4xl:col-span-2">
          <SalesByCategoryChart />
        </div>
        <ChannelMixChart />
      </div>
    </div>
  )
}
