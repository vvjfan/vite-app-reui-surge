import { type ReactNode } from "react"
import { Badge } from "@/components/reui/badge"
import {
  Timeline,
  TimelineContent,
  TimelineHeader,
  TimelineIndicator,
  TimelineItem,
  TimelineSeparator,
  TimelineTitle,
} from "@/components/reui/timeline"

import { cn } from "@/lib/utils"
import { ProductRef } from "@/components/shared/product-ref"
import { LocationRef } from "@/components/shared/location-ref"
import { locationName } from "@/lib/data/locations"
import { useLocations } from "@/features/locations/queries"
import { useSuppliers } from "@/features/suppliers/queries"
import { supplierName, type Supplier } from "@/lib/data/suppliers"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { type StockLot, type StockMovement } from "@/lib/data/inventory"
import type { StockRow, StockRowLevel } from "../queries"
import {
  MovementAuthorAvatar,
  movementKindIcon,
  movementKindIndicatorClass,
  statusVariant,
  type StockFact,
} from "./ledger-data"
import { SectionCard, STOCK_SHEET_CONTENT_CLASS } from "./stock-sheet"
import { PackageIcon, XIcon } from "@phosphor-icons/react"

// Stat: a label over its value, the tile grammar from the Stock Detail block.
function Stat({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <span className="text-xs text-muted-foreground">{label}</span>
      <div className="flex min-w-0 items-center text-lg font-semibold text-foreground tabular-nums">
        {children}
      </div>
    </div>
  )
}

// FactRow: definition facts as a label/value dl.
function FactRow({ fact }: { fact: StockFact }) {
  return (
    <div className="contents">
      <dt className="text-sm text-muted-foreground">{fact.label}</dt>
      <dd
        className={cn(
          "min-w-0 text-sm text-foreground",
          fact.mono && "font-mono text-xs"
        )}
      >
        {fact.value}
      </dd>
    </div>
  )
}

// LotRow: lots are text (lot + location + qty/cost), no imagery.
function LotRow({
  lot,
  lotLocationName,
}: {
  lot: StockLot
  lotLocationName: string
}) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="flex min-w-0 flex-col gap-0.5">
        <span className="truncate font-mono text-sm font-medium text-foreground">
          {lot.lot}
        </span>
        <span className="truncate text-sm text-muted-foreground">
          {lotLocationName}
        </span>
      </div>
      <div className="shrink-0 text-right text-xs text-muted-foreground tabular-nums">
        {lot.qty} units · ${lot.cost}
      </div>
    </div>
  )
}

// LevelRow: one location's stock. The sheet is the one place that breaks the
// row's totals back out per location, so `available` is each level's own
// (computed, never stored) rather than a share of the sum.
function LevelRow({
  level,
  levelLocationName,
}: {
  level: StockRowLevel
  levelLocationName: string
}) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="flex min-w-0 flex-col gap-0.5">
        <LocationRef
          name={levelLocationName}
          className="text-sm font-medium text-foreground"
        />
        <span className="truncate font-mono text-sm text-muted-foreground">
          {level.bin}
        </span>
      </div>
      <div className="shrink-0 text-right tabular-nums">
        <div className="text-sm font-medium text-foreground">
          {level.available.toLocaleString()} available
        </div>
        <div className="text-xs text-muted-foreground">
          {level.onHand.toLocaleString()} on hand ·{" "}
          {level.allocated.toLocaleString()} allocated
        </div>
      </div>
    </div>
  )
}

// EventRow: one movement as a Timeline item. The connector is matched to the
// size-5 filled indicator so the line meets the dot; every movement is past, so
// the connector runs the same neutral border the whole way down.
function EventRow({ event, step }: { event: StockMovement; step: number }) {
  return (
    <TimelineItem
      step={step}
      className="group-data-[orientation=vertical]/timeline:ms-8 group-data-[orientation=vertical]/timeline:not-last:pb-6"
    >
      <TimelineHeader className="flex min-w-0 items-start justify-between gap-2.5">
        <TimelineSeparator className="bg-border group-data-[orientation=vertical]/timeline:-left-6 group-data-[orientation=vertical]/timeline:h-[calc(100%-1.25rem)] group-data-[orientation=vertical]/timeline:translate-y-5" />
        <TimelineIndicator
          className={cn(
            "flex size-5 items-center justify-center rounded-full border group-data-[orientation=vertical]/timeline:-left-6 [&_svg]:size-3",
            movementKindIndicatorClass[event.kind]
          )}
        >
          {movementKindIcon[event.kind]}
        </TimelineIndicator>

        <TimelineTitle className="min-w-0 text-sm leading-5">
          <span className="font-medium text-foreground">{event.title}</span>
        </TimelineTitle>

        <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
          {event.timeLabel}
        </span>
      </TimelineHeader>

      <TimelineContent className="flex min-w-0 flex-col items-start gap-2 pb-1">
        {event.detail ? (
          <p className="max-w-[52ch] text-sm leading-5 text-muted-foreground">
            {event.detail}
          </p>
        ) : null}
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <MovementAuthorAvatar author={event.author} />
          <span>{event.author.name}</span>
        </div>
      </TimelineContent>
    </TimelineItem>
  )
}

// Facts are derived from the selected item's fields (no hardcoded singleton).
// The bin joins them only when the SKU sits at a single location: with one
// location the per-location card is dropped as a repeat of the Stock card, so
// the bin, its one piece of information the totals do not carry, moves here.
// With several, the bin reads per location in that card instead.
function deriveFacts(
  item: StockRow,
  suppliers: readonly Supplier[]
): StockFact[] {
  const singleBin = item.levels.length === 1 ? item.levels[0]?.bin : undefined
  return [
    { label: "Supplier", value: supplierName(suppliers, item.supplierId) },
    ...(singleBin ? [{ label: "Bin", value: singleBin, mono: true }] : []),
    {
      label: "Reorder point",
      value: `${item.reorderPoint.toLocaleString()} units`,
    },
    {
      label: "Safety stock",
      value: `${item.safetyStock.toLocaleString()} units`,
    },
    { label: "Lead time", value: `${item.leadTimeDays} days` },
    { label: "Unit cost", value: `$${item.unitCost.toFixed(2)} avg` },
    { label: "UPC", value: item.upc, mono: true },
  ]
}

export function StockDetailSheet({
  item,
  open,
  onOpenChange,
}: {
  item: StockRow | null
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  // Levels and lots reference a location by id; resolve the names for display.
  const { data: locations = [] } = useLocations()
  const { data: suppliers = [] } = useSuppliers()
  if (!item) return null

  const facts = deriveFacts(item, suppliers)
  // The Stock card reads the row's totals, already summed across every level.
  const stockValue = item.onHand * item.unitCost
  const locationLabel = locationName(locations, item.primaryLocationId)
  // Counted the way isMultiLocation is: only locations actually holding stock,
  // so an emptied level does not inflate the header.
  const extraLocationCount = item.levels.filter((l) => l.onHand > 0).length - 1

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      {/* Content: a floating right drawer. The inset/size land on
          data-[side=right]: so they beat the sheet's own side classes, which
          otherwise pin it flush to the edges and drop the outer margin. */}
      <SheetContent
        side="right"
        showCloseButton={false}
        initialFocus={false}
        className={STOCK_SHEET_CONTENT_CLASS}
      >
        {/* Header: the id/close row, then the title block with the status badge
            and a muted subtitle. */}
        <SheetHeader className="shrink-0 gap-0 border-b p-0">
          <div className="flex min-h-11 items-center justify-between gap-2 px-5">
            <span className="inline-flex items-center gap-2 font-mono text-xs text-muted-foreground">
              <PackageIcon className="size-3.5" aria-hidden="true" />
              {item.sku}
            </span>
            <SheetClose
              render={
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Close stock detail"
                  className="shrink-0"
                >
                  <XIcon aria-hidden="true" />
                </Button>
              }
            />
          </div>
          <div className="flex min-w-0 flex-col gap-2 px-5 pt-1 pb-4">
            <div className="flex min-w-0 items-center gap-2">
              <SheetTitle className="min-w-0 flex-1 truncate text-lg font-semibold tracking-tight">
                <ProductRef
                  product={{ id: item.productId, title: item.name }}
                  className="min-w-0 text-lg font-semibold tracking-tight"
                />
              </SheetTitle>
              <Badge variant={statusVariant[item.status]}>{item.status}</Badge>
            </div>
            <SheetDescription className="text-xs text-muted-foreground">
              {item.category} · {locationLabel}
              {item.isMultiLocation ? (
                <span className="text-muted-foreground/70">
                  {" "}
                  +{extraLocationCount} more
                </span>
              ) : null}
            </SheetDescription>
          </div>
        </SheetHeader>

        {/* Body: a stack of dense Frame cards. */}
        <div className="min-h-0 flex-1">
          <ScrollArea className="h-full min-h-0">
            <div className="flex flex-col gap-3 px-5 py-4">
              {/* Stock: the totals as a tile row. */}
              <SectionCard>
                <div className="grid grid-cols-4 gap-x-4 gap-y-3">
                  <Stat label="Available">
                    {item.available.toLocaleString()}
                  </Stat>
                  <Stat label="On hand">{item.onHand.toLocaleString()}</Stat>
                  <Stat label="Allocated">
                    {item.allocated.toLocaleString()}
                  </Stat>
                  <Stat label="Value">${stockValue.toLocaleString()}</Stat>
                </div>
              </SectionCard>

              {/* Per-location breakdown, but only when it says something the
                  Stock card does not. One location repeats the totals exactly,
                  so it is dropped (its bin moves to Details); several locations
                  each carry their own split, which the totals summed away. */}
              {item.levels.length === 0 ? (
                <SectionCard label="Locations">
                  {/* A SKU starts with no levels at all - a product creates its
                      rows before any stock is placed. */}
                  <p className="text-sm text-muted-foreground">
                    Not stocked at any location yet. Adjust this SKU to place
                    its first units.
                  </p>
                </SectionCard>
              ) : item.levels.length > 1 ? (
                <SectionCard label="Locations">
                  <div className="flex flex-col gap-3">
                    {item.levels.map((level) => (
                      <LevelRow
                        key={level.locationId}
                        level={level}
                        levelLocationName={locationName(
                          locations,
                          level.locationId
                        )}
                      />
                    ))}
                  </div>
                </SectionCard>
              ) : null}

              {/* Lots */}
              <SectionCard label="Lots">
                {item.lots.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No lots yet. They appear when stock arrives tracked by
                    batch.
                  </p>
                ) : (
                  <div className="flex flex-col gap-3">
                    {item.lots.map((lot) => (
                      <LotRow
                        key={lot.id}
                        lot={lot}
                        lotLocationName={locationName(
                          locations,
                          lot.locationId
                        )}
                      />
                    ))}
                  </div>
                )}
              </SectionCard>

              {/* Stock facts */}
              <SectionCard label="Details">
                <dl className="grid grid-cols-[7.5rem_1fr] gap-x-4 gap-y-2.5">
                  {facts.map((fact) => (
                    <FactRow key={fact.label} fact={fact} />
                  ))}
                </dl>
              </SectionCard>

              {/* Movement timeline */}
              <SectionCard label="Movements">
                {item.movements.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No movements yet. Adjustments, transfers, and fulfilled
                    orders show up here.
                  </p>
                ) : (
                  <Timeline defaultValue={0}>
                    {item.movements.map((movement, index) => (
                      <EventRow
                        key={movement.id}
                        event={movement}
                        step={index + 1}
                      />
                    ))}
                  </Timeline>
                )}
              </SectionCard>
            </div>
          </ScrollArea>
        </div>
      </SheetContent>
    </Sheet>
  )
}
