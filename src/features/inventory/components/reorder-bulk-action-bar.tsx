import { Button } from "@/components/ui/button"
import {
  FileArrowDownIcon as FileDownIcon,
  ShoppingCartIcon,
} from "@phosphor-icons/react"

interface BulkActionBarProps {
  selectedCount: number
  suggestedTotal: number
  onCreatePo: () => void
  onExport: () => void
  onClear: () => void
}

export function BulkActionBar({
  selectedCount,
  suggestedTotal,
  onCreatePo,
  onExport,
  onClear,
}: BulkActionBarProps) {
  return (
    <div className="flex flex-col gap-3 bg-muted/25 px-(--frame-panel-header-px) py-(--frame-panel-header-py) lg:flex-row lg:items-center lg:justify-between">
      <div className="flex min-w-0 flex-col gap-0.5">
        <span className="text-sm font-medium">
          {selectedCount} SKU{selectedCount === 1 ? "" : "s"} selected
        </span>
        <span className="text-xs text-muted-foreground">
          Raise a purchase order for {suggestedTotal.toLocaleString()} suggested
          units in one step.
        </span>
      </div>

      {/* Actions */}
      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" variant="outline" onClick={onExport}>
          <FileDownIcon data-icon="inline-start" aria-hidden="true" />
          Export
        </Button>

        <Button type="button" onClick={onCreatePo}>
          <ShoppingCartIcon data-icon="inline-start" aria-hidden="true" />
          Create PO
        </Button>

        <Button type="button" variant="ghost" onClick={onClear}>
          Clear
        </Button>
      </div>
    </div>
  )
}
