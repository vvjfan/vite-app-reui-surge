import { Badge } from "@/components/reui/badge"
import {
  Frame,
  FrameDescription,
  FrameHeader,
  FramePanel,
  FrameTitle,
} from "@/components/reui/frame"

import { useQuery } from "@tanstack/react-query"
import { Link } from "@tanstack/react-router"

import { cn } from "@/lib/utils"
import { buttonVariants } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import type { CategoryTrendDirection } from "@/lib/data/dashboard"
import { dashboardTopCategoriesQuery } from "../queries"
import type { DateRange } from "../queries"
import {
  TrendUpIcon as TrendingUp,
  TrendDownIcon as TrendingDown,
} from "@phosphor-icons/react"

// Loading state: ranked rows as skeletons until the store read settles.
function TopCategoriesSkeleton() {
  return (
    <ul className="flex flex-col">
      {Array.from({ length: 5 }).map((_, index) => (
        <li key={index}>
          <div className="flex items-center gap-2.5 px-4 py-3">
            <Skeleton className="size-7 shrink-0 rounded-md" />
            <div className="flex min-w-0 flex-1 flex-col gap-1.5">
              <Skeleton className="h-3.5 w-24" />
              <Skeleton className="h-3 w-32" />
            </div>
            <Skeleton className="h-5 w-12 rounded-md" />
          </div>
          {index < 4 ? <Separator /> : null}
        </li>
      ))}
    </ul>
  )
}

function CategoryTrendBadge({
  direction,
  value,
}: {
  direction: CategoryTrendDirection
  value: string
}) {
  const isUp = direction === "up"
  return (
    <Badge variant={isUp ? "success-light" : "destructive-light"}>
      {isUp ? (
        <TrendingUp aria-hidden="true" />
      ) : (
        <TrendingDown aria-hidden="true" />
      )}
      {value}
    </Badge>
  )
}

export function TopCategories({ range }: { range: DateRange }) {
  const { data: topCategories } = useQuery(dashboardTopCategoriesQuery(range))
  return (
    <Frame dense className="h-full w-full">
      <FrameHeader className="flex-row items-center justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-0.5">
          <FrameTitle>Top categories</FrameTitle>
          <FrameDescription>By revenue</FrameDescription>
        </div>
        {/* Was an inert button. The list ranks the catalog's categories, so
            "all" of them is the categories tree. */}
        <Link
          to="/categories"
          className={cn(
            buttonVariants({ variant: "outline", size: "sm" }),
            "shrink-0"
          )}
        >
          View all
        </Link>
      </FrameHeader>
      <FramePanel className="flex flex-1 flex-col p-0!">
        {!topCategories ? (
          <TopCategoriesSkeleton />
        ) : topCategories.length === 0 ? (
          // A resolved empty list is not the loading `undefined` above: nothing
          // sold in the selected period, which is as true of a store with no
          // orders at all as of a period that happens to hold none.
          <p className="px-4 py-10 text-center text-sm text-muted-foreground">
            No category sales in this period. Create an order to see categories
            ranked here.
          </p>
        ) : (
          <ul className="flex flex-col">
            {topCategories.map((category, index) => (
              <li key={category.label}>
                {/* A router Link, not a bare anchor: the rows used to reload the
                  whole app to reach a route it already holds. Each row goes to
                  its OWN category page; only a category with no record behind
                  it falls back to the catalog. */}
                <Link
                  {...(category.categoryId
                    ? {
                        to: "/categories/$categoryId" as const,
                        params: { categoryId: category.categoryId },
                      }
                    : { to: "/products" as const })}
                  aria-label={`View ${category.label} category`}
                  className="group flex items-center gap-2.5 px-4 py-3 transition-colors outline-none hover:bg-muted/40 focus-visible:bg-muted/40 focus-visible:ring-2 focus-visible:ring-ring/40"
                >
                  <div className="relative shrink-0 overflow-hidden rounded-md bg-muted">
                    <img
                      src={category.thumbnail}
                      alt=""
                      aria-hidden="true"
                      className="size-7 object-cover transition-transform duration-300 group-hover:scale-105"
                      loading="lazy"
                    />
                  </div>

                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm leading-tight font-semibold text-foreground transition-colors group-hover:text-primary">
                      {category.label}
                    </p>
                    <p className="truncate text-xs leading-tight text-muted-foreground tabular-nums">
                      {category.value}
                      <span
                        className="mx-1.5 inline-block size-1 rounded-full bg-muted-foreground/40 align-middle"
                        aria-hidden="true"
                      />
                      {category.unitsSold.toLocaleString()} units
                    </p>
                  </div>

                  <CategoryTrendBadge
                    direction={category.trendDirection}
                    value={category.trend}
                  />
                </Link>
                {index < topCategories.length - 1 ? <Separator /> : null}
              </li>
            ))}
          </ul>
        )}
      </FramePanel>
    </Frame>
  )
}
