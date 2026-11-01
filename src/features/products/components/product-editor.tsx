import { useState } from "react"
import { Link, useNavigate } from "@tanstack/react-router"
import { toast } from "sonner"
import {
  fileToDataUrl,
  type FileMetadata,
  type FileWithPreview,
} from "@/hooks/use-file-upload"

import { PageHeader } from "@/components/shared/page-header"
import { cn } from "@/lib/utils"
import { Badge } from "@/components/reui/badge"
import {
  Frame,
  FrameHeader,
  FramePanel,
  FrameTitle,
} from "@/components/reui/frame"
import { Button, buttonVariants } from "@/components/ui/button"
import {
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldSet,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Spinner } from "@/components/ui/spinner"
import { Textarea } from "@/components/ui/textarea"
import type { Product, ProductKind, ProductVariant } from "@/lib/data/products"
import {
  type ProductSelectOption,
  type ProductStatusValue,
} from "./product-form-data"
import {
  InsetSeparator,
  OptionSelect,
  ProductRow,
  ProductStatusSelect,
  ProductThumbnailUpload,
} from "./product-form-fields"
import { ProductVariantsEditor } from "./product-variants-editor"
import { ProductReviewsPanel } from "@/features/reviews/components/product-reviews-panel"
import { useProductCategoryOptions } from "../hooks/use-category-options"
import { useCreateProduct, useUpdateProduct } from "../queries"
import { XIcon } from "@phosphor-icons/react"
import { slugify } from "@/lib/data/seed-utils"

// Full-page product editor. Composes the relocated form-12 fields (General),
// the useFileUpload gallery (Media), and the relocated data-grid-editing-2
// variants matrix, with an Organization + Status sidebar. Builds a full
// Omit<Product,"id"> (create) / Partial<Product> (update) - the repository seam
// already accepts full variants[] + options, so no data-layer changes.

const KIND_OPTIONS: ProductSelectOption<ProductKind>[] = [
  {
    value: "Physical",
    label: "Physical",
    description: "A shippable product with stock.",
  },
  {
    value: "Digital",
    label: "Digital",
    description: "Delivered online, no shipping.",
  },
]

// Error-key -> input id, in visual order, so a blocked submit focuses the first
// field that failed. Title is the only requirement today; the array keeps the
// focus path aligned with the other admin forms and ready for more rules.
const FIELD_ORDER: Array<[string, string]> = [["title", "product-title"]]

const PLACEHOLDER_THUMBNAIL = `data:image/svg+xml;utf8,${encodeURIComponent(
  "<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><rect width='160' height='160' fill='#e5e7eb'/><circle cx='58' cy='58' r='12' fill='#9ca3af'/><path d='M36 118l30-36 20 22 16-18 26 32z' fill='#9ca3af'/></svg>"
)}`

// Existing images arrive as FileMetadata (keep their url); new uploads are real
// Files converted to base64 so they persist in the demo store (no upload backend).
async function collectImages(files: FileWithPreview[]): Promise<string[]> {
  return Promise.all(
    files.map((item) =>
      item.file instanceof File
        ? fileToDataUrl(item.file)
        : Promise.resolve(item.file.url)
    )
  )
}

// A lightweight tag/collection chip input (Badge chips + Enter to add).
function ChipInput({
  values,
  onChange,
  placeholder,
  ariaLabel,
}: {
  values: string[]
  onChange: (values: string[]) => void
  placeholder: string
  ariaLabel: string
}) {
  const [draft, setDraft] = useState("")

  const add = () => {
    const value = draft.trim()
    if (value && !values.includes(value)) onChange([...values, value])
    setDraft("")
  }

  return (
    <div className="flex flex-col gap-2">
      {values.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {values.map((value) => (
            <Badge key={value} variant="secondary" className="gap-1">
              {value}
              <button
                type="button"
                onClick={() =>
                  onChange(values.filter((item) => item !== value))
                }
                aria-label={`Remove ${value}`}
                className="text-muted-foreground hover:text-foreground"
              >
                <XIcon className="size-3" aria-hidden="true" />
              </button>
            </Badge>
          ))}
        </div>
      ) : null}
      <Input
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault()
            add()
          }
        }}
        placeholder={placeholder}
        aria-label={`Add ${ariaLabel}`}
        autoComplete="off"
      />
    </div>
  )
}

export function ProductEditor({
  mode,
  product,
}: {
  mode: "create" | "edit"
  product?: Product
}) {
  const navigate = useNavigate()
  const createProduct = useCreateProduct()
  const updateProduct = useUpdateProduct()
  const isSubmitting = createProduct.isPending || updateProduct.isPending

  const [title, setTitle] = useState(product?.title ?? "")
  const [subtitle, setSubtitle] = useState(product?.subtitle ?? "")
  const [description, setDescription] = useState(product?.description ?? "")
  const [status, setStatus] = useState<ProductStatusValue>(
    product?.status ?? "draft"
  )
  const [category, setCategory] = useState<string>(
    product?.category ?? "Apparel"
  )
  const [kind, setKind] = useState<ProductKind>(product?.kind ?? "Physical")
  const [vendor, setVendor] = useState(product?.vendor ?? "Manifest Atelier")
  const [collections, setCollections] = useState<string[]>(
    product?.collections ?? []
  )
  const [tags, setTags] = useState<string[]>(product?.tags ?? [])
  const [variants, setVariants] = useState<ProductVariant[]>(
    product?.variants ?? []
  )

  // Category choices come from the Categories entity, not a hardcoded list.
  const categoryOptions = useProductCategoryOptions()

  // Existing images hydrate the gallery; keep them in mediaFiles so an untouched
  // edit does not wipe them on save.
  const initialFiles: FileMetadata[] = (product?.images ?? []).map(
    (url, index) => ({
      id: `image-${index}`,
      name: `Image ${index + 1}`,
      size: 0,
      type: "image/*",
      url,
    })
  )
  const [mediaFiles, setMediaFiles] = useState<FileWithPreview[]>(() =>
    initialFiles.map((file) => ({ id: file.id, file, preview: file.url }))
  )

  // Inline validation state, one message per field. Errors surface under the
  // control (FieldError) and set aria-invalid, and clear as soon as the field
  // is edited, so the form corrects itself rather than nagging.
  const [errors, setErrors] = useState<Record<string, string>>({})
  function clearError(key: string) {
    setErrors((prev) => {
      if (!prev[key]) return prev
      const next = { ...prev }
      delete next[key]
      return next
    })
  }

  async function handleSave() {
    if (isSubmitting) return
    const name = title.trim()

    // Validate every field in one pass so problems surface inline under the
    // control rather than as a transient toast. Title is the only requirement.
    const nextErrors: Record<string, string> = {}
    if (!name) nextErrors.title = "Product title is required."

    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors)
      const firstInvalid = FIELD_ORDER.find(([key]) => nextErrors[key])
      if (firstInvalid) document.getElementById(firstInvalid[1])?.focus()
      return
    }
    setErrors({})

    const images = await collectImages(mediaFiles)
    const thumbnail = images[0] ?? PLACEHOLDER_THUMBNAIL
    // Variants carry a photo per colourway, but the form has no place to shoot
    // one: rows added here have no image, and rows loaded from a seeded product
    // already do. So fill the gaps from the thumbnail rather than saving a
    // variant with an empty src, which every grid that renders a sku would then
    // have to defend against.
    const nextVariants: ProductVariant[] =
      variants.length > 0
        ? variants.map((variant) => ({
            ...variant,
            image: variant.image || thumbnail,
          }))
        : [
            {
              id: "default",
              sku: slugify(name).slice(0, 12).toUpperCase() || "SKU",
              title: "Default",
              options: {},
              price: 0,
              image: thumbnail,
            },
          ]

    const payload = {
      title: name,
      subtitle: subtitle.trim(),
      description: description.trim(),
      status,
      category,
      kind,
      vendor: vendor.trim() || "Unbranded",
      thumbnail,
      images,
      tags,
      collections,
      variants: nextVariants,
    }

    if (mode === "edit" && product) {
      updateProduct.mutate(
        { id: product.id, patch: payload },
        {
          onSuccess: () =>
            toast.success("Product saved", { description: name }),
        }
      )
      return
    }

    createProduct.mutate(payload, {
      onSuccess: (created) => {
        toast.success("Product created", { description: created.title })
        navigate({
          to: "/products/$productId",
          params: { productId: created.id },
        })
      },
    })
  }

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title={
          title.trim() || (mode === "edit" ? "Untitled product" : "New product")
        }
        description={
          mode === "edit"
            ? `${variants.length} ${variants.length === 1 ? "variant" : "variants"}`
            : undefined
        }
        actions={
          <>
            <Link
              to="/products"
              className={cn(buttonVariants({ variant: "outline" }))}
            >
              Cancel
            </Link>
            <Button type="button" onClick={handleSave} disabled={isSubmitting}>
              {isSubmitting ? (
                <Spinner data-icon="inline-start" aria-hidden="true" />
              ) : null}
              {mode === "edit" ? "Save changes" : "Create product"}
            </Button>
          </>
        }
      />

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_20rem]">
        {/* Main column */}
        <div className="flex min-w-0 flex-col gap-4">
          {/* General */}
          <Frame dense className="w-full">
            <FrameHeader>
              <FrameTitle>General</FrameTitle>
            </FrameHeader>
            <FramePanel className="p-0! shadow-none!">
              <FieldSet className="gap-0">
                <FieldGroup className="gap-0">
                  <ProductRow
                    title="Title"
                    description="Storefront display name."
                    htmlFor="product-title"
                  >
                    <Input
                      id="product-title"
                      value={title}
                      onChange={(event) => {
                        setTitle(event.target.value)
                        clearError("title")
                      }}
                      placeholder="e.g. AeroFlex Runner"
                      autoComplete="off"
                      required
                      aria-invalid={!!errors.title}
                    />
                    {errors.title ? (
                      <FieldError>{errors.title}</FieldError>
                    ) : null}
                  </ProductRow>
                  <InsetSeparator />
                  <ProductRow
                    title="Subtitle"
                    description="A short tagline under the title."
                    htmlFor="product-subtitle"
                  >
                    <Input
                      id="product-subtitle"
                      value={subtitle}
                      onChange={(event) => setSubtitle(event.target.value)}
                      placeholder="Optional"
                      autoComplete="off"
                    />
                  </ProductRow>
                  <InsetSeparator />
                  <ProductRow
                    title="Description"
                    description="Sales copy for the product page."
                    htmlFor="product-description"
                    align="start"
                  >
                    <Textarea
                      id="product-description"
                      value={description}
                      onChange={(event) => setDescription(event.target.value)}
                      placeholder="Responsive knit running shoe with a cushioned midsole..."
                      className="min-h-28"
                    />
                  </ProductRow>
                </FieldGroup>
              </FieldSet>
            </FramePanel>
          </Frame>

          {/* Media */}
          <Frame dense className="w-full">
            <FrameHeader>
              <FrameTitle>Media</FrameTitle>
            </FrameHeader>
            <FramePanel className="shadow-none!">
              <ProductThumbnailUpload
                inputId="product-media"
                initialFiles={initialFiles}
                onFilesChange={setMediaFiles}
              />
            </FramePanel>
          </Frame>

          {/* Variants */}
          <Frame dense className="w-full">
            <FrameHeader>
              <FrameTitle>Variants</FrameTitle>
            </FrameHeader>
            <FramePanel className="shadow-none!">
              <ProductVariantsEditor value={variants} onChange={setVariants} />
            </FramePanel>
          </Frame>
        </div>

        {/* Sidebar */}
        <div className="flex flex-col gap-4">
          <Frame dense className="w-full">
            <FrameHeader>
              <FrameTitle>Status</FrameTitle>
            </FrameHeader>
            <FramePanel className="shadow-none!">
              <ProductStatusSelect value={status} onValueChange={setStatus} />
            </FramePanel>
          </Frame>

          <Frame dense className="w-full">
            <FrameHeader>
              <FrameTitle>Organization</FrameTitle>
            </FrameHeader>
            <FramePanel className="flex flex-col gap-4 shadow-none!">
              <div className="flex flex-col gap-1.5">
                <FieldLabel htmlFor="product-category">Category</FieldLabel>
                <OptionSelect
                  id="product-category"
                  value={category}
                  options={categoryOptions}
                  onValueChange={setCategory}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <FieldLabel htmlFor="product-kind">Type</FieldLabel>
                <OptionSelect
                  id="product-kind"
                  value={kind}
                  options={KIND_OPTIONS}
                  onValueChange={setKind}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <FieldLabel htmlFor="product-vendor">Vendor</FieldLabel>
                <Input
                  id="product-vendor"
                  value={vendor}
                  onChange={(event) => setVendor(event.target.value)}
                  placeholder="Vendor name"
                  autoComplete="off"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <FieldLabel>Collections</FieldLabel>
                <ChipInput
                  values={collections}
                  onChange={setCollections}
                  placeholder="Add a collection"
                  ariaLabel="collection"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <FieldLabel>Tags</FieldLabel>
                <ChipInput
                  values={tags}
                  onChange={setTags}
                  placeholder="Add a tag"
                  ariaLabel="tag"
                />
              </div>
            </FramePanel>
          </Frame>

          {/* Reviews are storefront submissions, so they exist only for a saved
              product. Read-only here: moderation lives on /reviews. */}
          {product ? (
            <ProductReviewsPanel
              productId={product.id}
              productTitle={product.title}
            />
          ) : null}
        </div>
      </div>
    </div>
  )
}
