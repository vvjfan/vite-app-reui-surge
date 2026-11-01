import { useState, type ReactNode } from "react"
import { Link } from "@tanstack/react-router"
import { useQuery } from "@tanstack/react-query"
import { toast } from "sonner"

import { PageHeader } from "@/components/shared/page-header"
import { useRecordCrumb } from "@/components/shared/app-shell/page-crumb"
import {
  Frame,
  FrameHeader,
  FramePanel,
  FrameTitle,
} from "@/components/reui/frame"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Spinner } from "@/components/ui/spinner"
import { Input } from "@/components/ui/input"
import { Separator } from "@/components/ui/separator"
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import type { Category } from "@/lib/data/categories"
import { productPriceRange, type Product } from "@/lib/data/products"
import { CategoryRef } from "@/components/shared/category-ref"
import { ProductRef } from "@/components/shared/product-ref"
import { formatCurrency } from "@/features/products/lib/format"
import {
  productsListQuery,
  useUpdateProduct,
} from "@/features/products/queries"
import { categoriesListQuery } from "../queries"
import { StatusBadge } from "./categories-columns"
import { CategoryFormSheet } from "./category-form-sheet"
import {
  ArrowLeftIcon,
  PencilIcon,
  PlusIcon,
  MagnifyingGlassIcon as SearchIcon,
} from "@phosphor-icons/react"

function DetailRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="truncate text-sm font-medium text-foreground">
        {value}
      </span>
    </div>
  )
}

function ProductRow({ product }: { product: Product }) {
  const { min, max } = productPriceRange(product)
  return (
    // The NAME is the link, not the row: ProductRef carries the underline and
    // hover arrow every other product reference in the app has, and it cannot
    // live inside a row-wide <a> (nested anchors are invalid). Same shape as the
    // products grid cell and the Assign products list below.
    <div className="flex items-center gap-3 border-b px-4 py-2.5 transition-colors last:border-b-0 hover:bg-muted/40">
      <img
        src={product.thumbnail}
        alt=""
        loading="lazy"
        className="size-9 shrink-0 rounded-md border object-cover"
      />
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <ProductRef product={{ id: product.id, title: product.title }} />
        <span className="truncate text-sm text-muted-foreground">
          {product.vendor}
        </span>
      </div>
      <span className="shrink-0 text-sm text-foreground tabular-nums">
        {min === max
          ? formatCurrency(min)
          : `${formatCurrency(min)} - ${formatCurrency(max)}`}
      </span>
    </div>
  )
}

export function CategoryDetail({ category }: { category: Category }) {
  const { data: categories = [] } = useQuery(categoriesListQuery())
  const productsQuery = useQuery(productsListQuery())
  const products = productsQuery.data ?? []
  const [assignOpen, setAssignOpen] = useState(false)

  const parent = categories.find((c) => c.id === category.parentId)
  const inCategory = products.filter((p) => p.category === category.name)

  // Name the record in the header trail, which otherwise stops at Categories
  // and marks the LIST as the page you are on.
  useRecordCrumb(category.name)

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title={category.name}
        description={`${inCategory.length} ${
          inCategory.length === 1 ? "product" : "products"
        }`}
        actions={
          <div className="flex items-center gap-3">
            <StatusBadge category={category} />
            {/* A real route up, not history.back(): this page is deep-linkable,
                so "back" has to mean the category list rather than wherever the
                browser happened to come from. */}
            <Button
              variant="ghost"
              nativeButton={false}
              render={<Link to="/categories" />}
            >
              <ArrowLeftIcon
                data-icon="inline-start"
                className="size-4"
                aria-hidden="true"
              />
              Back
            </Button>
            <CategoryFormSheet
              mode="edit"
              category={category}
              trigger={
                <Button variant="outline">
                  <PencilIcon
                    data-icon="inline-start"
                    className="size-4"
                    aria-hidden="true"
                  />
                  Edit
                </Button>
              }
            />
          </div>
        }
      />

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="flex min-w-0 flex-col gap-4">
          <Frame dense className="w-full">
            <FrameHeader className="flex-row items-center justify-between gap-3">
              <FrameTitle>Products</FrameTitle>
              <Button variant="outline" onClick={() => setAssignOpen(true)}>
                <PlusIcon
                  data-icon="inline-start"
                  className="size-4"
                  aria-hidden="true"
                />
                Assign products
              </Button>
            </FrameHeader>
            <FramePanel className="p-0! shadow-none!">
              {/* The product list derives from the products read, so its empty
                  state may only speak once that read has settled. */}
              {productsQuery.isPending ? (
                <div className="flex items-center justify-center gap-2 px-4 py-10 text-sm text-muted-foreground">
                  <Spinner className="size-4" /> Loading products
                </div>
              ) : inCategory.length === 0 ? (
                <p className="px-4 py-10 text-center text-sm text-muted-foreground">
                  No products in this category yet. Assign some to get started.
                </p>
              ) : (
                <div className="flex flex-col">
                  {inCategory.map((product) => (
                    <ProductRow key={product.id} product={product} />
                  ))}
                </div>
              )}
            </FramePanel>
          </Frame>
        </div>

        <div className="flex flex-col gap-4">
          <Frame dense className="w-full">
            <FrameHeader>
              <FrameTitle>Details</FrameTitle>
            </FrameHeader>
            <FramePanel className="flex flex-col gap-3 shadow-none!">
              <DetailRow
                label="Parent"
                value={
                  parent ? (
                    <CategoryRef
                      category={{ name: parent.name, id: parent.id }}
                    />
                  ) : (
                    "Top level"
                  )
                }
              />
              <DetailRow
                label="Status"
                value={category.isActive ? "Active" : "Inactive"}
              />
              <DetailRow
                label="Visibility"
                value={category.isInternal ? "Internal" : "Storefront"}
              />
              {category.description ? (
                <>
                  <Separator />
                  <p className="text-sm leading-relaxed text-muted-foreground">
                    {category.description}
                  </p>
                </>
              ) : null}
            </FramePanel>
          </Frame>
        </div>
      </div>

      <AssignProductsSheet
        category={category}
        open={assignOpen}
        onOpenChange={setAssignOpen}
      />
    </div>
  )
}

function AssignProductsSheet({
  category,
  open,
  onOpenChange,
}: {
  category: Category
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const { data: products = [] } = useQuery(productsListQuery())
  const updateProduct = useUpdateProduct()
  const [search, setSearch] = useState("")
  const [selected, setSelected] = useState<Set<string>>(() => new Set())

  const resetInputs1 = [open] as const
  const [previousInputs1, setPreviousInputs1] = useState<
    typeof resetInputs1 | null
  >(null)
  if (
    previousInputs1 === null ||
    resetInputs1.some(
      (input, index) => !Object.is(input, previousInputs1[index])
    )
  ) {
    setPreviousInputs1(resetInputs1)

    if (open) {
      setSelected(new Set())
      setSearch("")
    }
  }

  // A product carries a single category, so the candidates are the ones not
  // already in this one; assigning moves them here.
  const candidates = products
    .filter((p) => p.category !== category.name)
    .filter((p) => p.title.toLowerCase().includes(search.trim().toLowerCase()))

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  const assign = () => {
    const ids = [...selected]
    for (const id of ids) {
      updateProduct.mutate({ id, patch: { category: category.name } })
    }
    onOpenChange(false)
    if (ids.length) {
      toast.success(
        `${ids.length} ${ids.length === 1 ? "product" : "products"} assigned`,
        { description: category.name }
      )
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="z-50 flex flex-col gap-0 overflow-hidden rounded-xl bg-popover p-0 outline-none data-[side=right]:inset-y-4 data-[side=right]:right-4 data-[side=right]:left-auto data-[side=right]:h-[calc(100svh-2rem)] data-[side=right]:w-[min(30rem,calc(100vw-2rem))] data-[side=right]:max-w-none data-[side=right]:sm:max-w-none"
      >
        <SheetHeader className="border-b px-5 py-4 sm:px-6">
          <SheetTitle>Assign products</SheetTitle>
          <SheetDescription>
            Move products into {category.name}. Each product keeps a single
            category.
          </SheetDescription>
        </SheetHeader>

        <div className="border-b px-5 py-4 sm:px-6">
          <div className="relative">
            <SearchIcon
              className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search products..."
              className="ps-8"
              aria-label="Search products"
            />
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto">
          {candidates.length === 0 ? (
            <p className="px-5 py-10 text-center text-sm text-muted-foreground">
              No products to assign.
            </p>
          ) : (
            candidates.map((product) => (
              <label
                key={product.id}
                className="flex cursor-pointer items-center gap-3 border-b px-5 py-2.5 transition-colors last:border-b-0 hover:bg-muted/40 sm:px-6"
              >
                <Checkbox
                  checked={selected.has(product.id)}
                  onCheckedChange={() => toggle(product.id)}
                  aria-label={`Assign ${product.title}`}
                />
                <img
                  src={product.thumbnail}
                  alt=""
                  loading="lazy"
                  className="size-8 shrink-0 rounded border object-cover"
                />
                <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <ProductRef
                    product={{ id: product.id, title: product.title }}
                  />
                  <span className="truncate text-sm text-muted-foreground">
                    Currently in {product.category}
                  </span>
                </div>
              </label>
            ))
          )}
        </div>

        <SheetFooter className="flex-row justify-end border-t px-5 py-4 sm:px-6">
          <SheetClose render={<Button type="button" variant="outline" />}>
            Cancel
          </SheetClose>
          <Button type="button" onClick={assign} disabled={selected.size === 0}>
            Assign{selected.size > 0 ? ` (${selected.size})` : ""}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
