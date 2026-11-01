import { memo, useState } from "react"
import { CategoryRef } from "@/components/shared/category-ref"
import { useQuery } from "@tanstack/react-query"
import { Badge } from "@/components/reui/badge"
import { DataGridColumnHeader } from "@/components/reui/data-grid/data-grid-column-header"
import { DataGridTableDndRowHandle } from "@/components/reui/data-grid/data-grid-table-dnd-rows"
import type { ColumnDef } from "@tanstack/react-table"
import { toast } from "sonner"

import { cn } from "@/lib/utils"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Skeleton } from "@/components/ui/skeleton"
import { childCategories, type Category } from "@/lib/data/categories"
import {
  categoriesListQuery,
  useDeleteCategory,
  useUpdateCategory,
} from "../queries"
import { CategoryFormSheet } from "./category-form-sheet"
import {
  CaretRightIcon as ChevronRightIcon,
  DotsThreeIcon as MoreHorizontalIcon,
  PencilIcon,
  FolderPlusIcon,
  TrashIcon as Trash2Icon,
} from "@phosphor-icons/react"

// A flattened tree row: the category plus its depth, whether it has children,
// and a rolled-up product count (computed in the grid).
export interface CategoryRow {
  category: Category
  depth: number
  hasChildren: boolean
  productCount: number
}

export interface CategoriesTableMeta {
  isExpanded: (id: string) => boolean
  toggleExpand: (id: string) => void
}

function readMeta(table: { options: { meta?: unknown } }): CategoriesTableMeta {
  return table.options.meta as CategoriesTableMeta
}

// ── Status ──

export const StatusBadge = memo(function StatusBadge({
  category,
}: {
  category: Category
}) {
  return (
    <span className="flex flex-wrap items-center gap-1.5">
      {category.isActive ? (
        <Badge variant="success-light">Active</Badge>
      ) : (
        <Badge variant="secondary">Inactive</Badge>
      )}
      {category.isInternal ? (
        <Badge variant="info-light">Internal</Badge>
      ) : null}
    </span>
  )
})

// ── Cells ──

function CategoryNameCell({
  row,
  meta,
}: {
  row: CategoryRow
  meta: CategoriesTableMeta
}) {
  const { category, depth, hasChildren } = row
  const expanded = meta.isExpanded(category.id)
  return (
    <div
      className="flex min-w-0 items-center gap-2"
      style={{ paddingInlineStart: `${depth * 20}px` }}
    >
      {hasChildren ? (
        <Button
          type="button"
          size="icon-sm"
          variant="ghost"
          className="size-6 shrink-0 text-muted-foreground hover:text-foreground"
          aria-label={`${expanded ? "Collapse" : "Expand"} ${category.name}`}
          onClick={(event) => {
            event.stopPropagation()
            meta.toggleExpand(category.id)
          }}
        >
          <ChevronRightIcon
            className={cn(
              "size-3.5 shrink-0 transition-transform duration-150",
              expanded && "rotate-90"
            )}
            aria-hidden="true"
          />
        </Button>
      ) : (
        <span className="size-6 shrink-0" aria-hidden="true" />
      )}
      {category.image ? (
        <img
          src={category.image}
          alt=""
          loading="lazy"
          className="size-9 shrink-0 rounded-md border object-cover"
        />
      ) : (
        <span className="flex size-9 shrink-0 items-center justify-center rounded-md border bg-muted text-[10px] font-medium text-muted-foreground">
          {category.name.slice(0, 2).toUpperCase()}
        </span>
      )}
      <div className="flex min-w-0 flex-col gap-0.5">
        <CategoryRef category={{ name: category.name, id: category.id }} />
        {category.description ? (
          <span className="truncate text-xs text-muted-foreground">
            {category.description}
          </span>
        ) : null}
      </div>
    </div>
  )
}

function ActionsCell({ row }: { row: CategoryRow }) {
  const category = row.category
  const [editOpen, setEditOpen] = useState(false)
  const [addSubOpen, setAddSubOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)

  const { data: categories = [] } = useQuery(categoriesListQuery())
  const updateCategory = useUpdateCategory()
  const deleteCategory = useDeleteCategory()

  const handleDeleteConfirm = () => {
    setDeleteOpen(false)
    // Reparent children to this category's parent so they are not orphaned.
    for (const child of childCategories(categories, category.id)) {
      updateCategory.mutate({
        id: child.id,
        patch: { parentId: category.parentId },
      })
    }
    deleteCategory.mutate(category.id, {
      onSuccess: () =>
        toast.success("Category deleted", { description: category.name }),
    })
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              size="icon-sm"
              variant="ghost"
              aria-label={`Actions for ${category.name}`}
            />
          }
        >
          <MoreHorizontalIcon aria-hidden="true" />
        </DropdownMenuTrigger>
        <DropdownMenuContent side="bottom" align="start" className="min-w-44">
          <DropdownMenuGroup>
            <DropdownMenuItem onClick={() => setEditOpen(true)}>
              <PencilIcon className="size-4" aria-hidden="true" />
              Edit category
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setAddSubOpen(true)}>
              <FolderPlusIcon className="size-4" aria-hidden="true" />
              Add subcategory
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              variant="destructive"
              onClick={() => setDeleteOpen(true)}
            >
              <Trash2Icon className="size-4" aria-hidden="true" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>

      <CategoryFormSheet
        mode="edit"
        category={category}
        open={editOpen}
        onOpenChange={setEditOpen}
      />
      <CategoryFormSheet
        mode="create"
        defaultParentId={category.id}
        open={addSubOpen}
        onOpenChange={setAddSubOpen}
      />

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent size="sm">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this category?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes{" "}
              <span className="font-medium text-foreground">
                {category.name}
              </span>
              . Any subcategories move up to its parent. Products keep their
              category label.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep category</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={handleDeleteConfirm}
            >
              Delete category
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

// ── Columns ──

export const columns: ColumnDef<CategoryRow>[] = [
  {
    id: "drag",
    header: "",
    // The row itself navigates on click; the handle only drags.
    cell: () => (
      <div onClick={(e) => e.stopPropagation()}>
        <DataGridTableDndRowHandle />
      </div>
    ),
    enableSorting: false,
    // The registry drag-drop grid's spacing, tightened one step: the handle
    // cell drops its end padding and narrows its start padding, the
    // neighbouring column drops its start padding, and the cell is sized to
    // the handle exactly - the grip sits directly beside the row content.
    size: 36,
    meta: {
      cellClassName: "ps-2! pe-0!",
      headerClassName: "ps-2!",
      skeleton: <Skeleton className="size-7 rounded" />,
    },
  },
  {
    id: "category",
    header: ({ column }) => (
      <DataGridColumnHeader title="Category" column={column} />
    ),
    cell: ({ row, table }) => (
      <CategoryNameCell row={row.original} meta={readMeta(table)} />
    ),
    enableSorting: false,
    minSize: 280,
    meta: {
      headerTitle: "Category",
      cellClassName: "ps-0!",
      headerClassName: "ps-0!",
      skeleton: (
        <div className="flex items-center gap-2">
          <Skeleton className="size-6 rounded" />
          <Skeleton className="size-9 shrink-0 rounded-md" />
          <div className="flex min-w-0 flex-col gap-0.5">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-3 w-40" />
          </div>
        </div>
      ),
    },
  },
  {
    id: "products",
    header: ({ column }) => (
      <DataGridColumnHeader title="Products" column={column} />
    ),
    cell: ({ row }) => (
      <span className="text-sm text-foreground tabular-nums">
        {row.original.productCount}{" "}
        <span className="text-muted-foreground">
          {row.original.productCount === 1 ? "product" : "products"}
        </span>
      </span>
    ),
    enableSorting: false,
    size: 140,
    meta: {
      headerTitle: "Products",
      skeleton: <Skeleton className="h-4 w-20" />,
    },
  },
  {
    id: "status",
    header: ({ column }) => (
      <DataGridColumnHeader title="Status" column={column} />
    ),
    cell: ({ row }) => <StatusBadge category={row.original.category} />,
    enableSorting: false,
    size: 160,
    meta: {
      headerTitle: "Status",
      skeleton: <Skeleton className="h-5 w-16 rounded-md" />,
    },
  },
  {
    id: "actions",
    header: "",
    cell: ({ row }) => (
      <div onClick={(e) => e.stopPropagation()}>
        <ActionsCell row={row.original} />
      </div>
    ),
    enableSorting: false,
    size: 50,
    meta: {
      skeleton: <Skeleton className="size-7 rounded" />,
    },
  },
]
