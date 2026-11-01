import { Button } from "@/components/ui/button"
import {
  GearSixIcon as Settings2Icon,
  ArrowsLeftRightIcon as ArrowLeftRightIcon,
  ReceiptIcon as ReceiptTextIcon,
} from "@phosphor-icons/react"

interface LedgerSelectionBarProps {
  selectedCount: number
  onAdjust: () => void
  onTransfer: () => void
  onCreatePO: () => void
  onClear: () => void
}

export function LedgerSelectionBar({
  selectedCount,
  onAdjust,
  onTransfer,
  onCreatePO,
  onClear,
}: LedgerSelectionBarProps) {
  return (
    <div className="flex flex-col gap-3 bg-muted/25 px-(--frame-panel-px) py-3 lg:flex-row lg:items-center lg:justify-between">
      <div className="flex min-w-0 flex-col gap-0.5">
        <span className="text-sm font-medium">
          {selectedCount} SKU{selectedCount === 1 ? "" : "s"} selected
        </span>
        <span className="text-xs text-muted-foreground">
          Adjust counts, transfer units, or raise a PO in one step.
        </span>
      </div>

      {/* Actions */}
      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" variant="outline" onClick={onAdjust}>
          <Settings2Icon data-icon="inline-start" aria-hidden="true" />
          Adjust
        </Button>

        <Button type="button" variant="outline" onClick={onTransfer}>
          <ArrowLeftRightIcon data-icon="inline-start" aria-hidden="true" />
          Transfer
        </Button>

        {/* The primary step: a selection of low-stock SKUs most often becomes a
            purchase order, so Create PO is the filled action. */}
        <Button type="button" onClick={onCreatePO}>
          <ReceiptTextIcon data-icon="inline-start" aria-hidden="true" />
          Create PO
        </Button>

        <Button type="button" variant="ghost" onClick={onClear}>
          Clear
        </Button>
      </div>
    </div>
  )
}
