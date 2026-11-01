import { useState, type ReactElement } from "react"
import { useQuery } from "@tanstack/react-query"
import { toast } from "sonner"

import {
  fileToDataUrl,
  useFileUpload,
  type FileMetadata,
  type FileWithPreview,
} from "@/hooks/use-file-upload"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { FieldError, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import { Spinner } from "@/components/ui/spinner"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { descendantIds, type Category } from "@/lib/data/categories"
import { slugify } from "@/lib/data/seed-utils"
import { ImageIcon } from "@phosphor-icons/react"
import {
  categoriesListQuery,
  useCreateCategory,
  useUpdateCategory,
} from "../queries"

const NO_PARENT = "__none__"

// An existing image is a plain url on the Category; hydrate it as the upload
// hook's metadata shape so editing shows the current art.
function imageAsInitialFiles(image: string | null | undefined): FileMetadata[] {
  if (!image) return []
  return [
    {
      id: "category-image",
      name: "Category image",
      size: 0,
      type: "image/*",
      url: image,
    },
  ]
}

/**
 * Resolve the picked file to what Category.image stores: null when there is no
 * art (the surfaces that show one then fall back to a product photo), the
 * existing url when it was left alone, or base64 for a newly picked file.
 */
async function resolveImage(files: FileWithPreview[]): Promise<string | null> {
  const picked = files.at(0)
  if (!picked) return null
  return picked.file instanceof File
    ? fileToDataUrl(picked.file)
    : picked.file.url
}

// Single-image picker. Mirrors the product editor's media field (same hook, same
// base64 persistence), but a category holds one optional image rather than a
// gallery, and clearing it is meaningful: null means "fall back to a product
// photo", so Remove is a real action rather than just an undo.
function CategoryImageField({
  inputId,
  initialFiles,
  onFilesChange,
}: {
  inputId: string
  initialFiles: FileMetadata[]
  onFilesChange: (files: FileWithPreview[]) => void
}) {
  const [
    { files, isDragging, errors },
    {
      removeFile,
      handleDragEnter,
      handleDragLeave,
      handleDragOver,
      handleDrop,
      openFileDialog,
      getInputProps,
    },
  ] = useFileUpload({
    maxFiles: 1,
    maxSize: 3 * 1024 * 1024,
    accept: "image/*",
    multiple: false,
    initialFiles,
    onFilesChange,
  })

  const picked = files.at(0)

  return (
    <div className="flex flex-col gap-1.5">
      <div
        className={cn(
          "flex min-w-0 items-center gap-3 rounded-lg border border-dashed p-3 transition-colors",
          isDragging
            ? "border-primary bg-primary/5"
            : "border-muted-foreground/25 hover:border-muted-foreground/50"
        )}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
      >
        <input
          {...getInputProps({
            id: inputId,
            "aria-label": "Upload category art",
          })}
          className="sr-only"
        />

        {picked?.preview ? (
          <img
            src={picked.preview}
            alt=""
            className="size-12 shrink-0 rounded-md border object-cover"
          />
        ) : (
          <div
            className="flex size-12 shrink-0 items-center justify-center rounded-md border bg-muted text-muted-foreground"
            aria-hidden="true"
          >
            <ImageIcon className="size-5" />
          </div>
        )}

        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <p className="min-w-0 text-sm text-muted-foreground">
            {picked
              ? "Category art. Replace or remove it."
              : "Drop an image here, or browse. Without art, a product photo is used."}
          </p>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={openFileDialog}
            >
              {picked ? "Replace" : "Add image"}
            </Button>
            {picked && (
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => removeFile(picked.id)}
              >
                Remove
              </Button>
            )}
          </div>
        </div>
      </div>

      {errors.length > 0 && (
        <p className="text-sm text-destructive">{errors[0]}</p>
      )}
    </div>
  )
}

export function CategoryFormSheet({
  mode = "create",
  category,
  defaultParentId = null,
  trigger,
  open: controlledOpen,
  onOpenChange,
}: {
  mode?: "create" | "edit"
  category?: Category
  defaultParentId?: string | null
  trigger?: ReactElement
  open?: boolean
  onOpenChange?: (open: boolean) => void
}) {
  const isEdit = mode === "edit" && !!category
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false)
  const open = controlledOpen ?? uncontrolledOpen
  const setOpen = onOpenChange ?? setUncontrolledOpen

  const { data: categories = [] } = useQuery(categoriesListQuery())
  const createCategory = useCreateCategory()
  const updateCategory = useUpdateCategory()
  const isSubmitting = createCategory.isPending || updateCategory.isPending

  const [name, setName] = useState(category?.name ?? "")
  const [description, setDescription] = useState(category?.description ?? "")
  const [parentId, setParentId] = useState<string | null>(
    category?.parentId ?? defaultParentId
  )
  const [isActive, setIsActive] = useState(category?.isActive ?? true)
  const [isInternal, setIsInternal] = useState(category?.isInternal ?? false)
  const [imageFiles, setImageFiles] = useState<FileWithPreview[]>([])

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

  // Reset the form to the target each time the sheet opens.
  const resetInputs1 = [open, category, defaultParentId] as const
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
      setName(category?.name ?? "")
      setDescription(category?.description ?? "")
      setParentId(category?.parentId ?? defaultParentId ?? null)
      setIsActive(category?.isActive ?? true)
      setIsInternal(category?.isInternal ?? false)
      setImageFiles(
        imageAsInitialFiles(category?.image).map((file) => ({
          id: file.id,
          file,
          preview: file.url,
        }))
      )
      setErrors({})
    }
  }

  const handle = isEdit ? category.handle : slugify(name)

  // Parent options: exclude self + descendants so the tree stays acyclic.
  const excluded = isEdit
    ? descendantIds(categories, category.id)
    : new Set<string>()
  const parentOptions = categories
    .filter((c) => !excluded.has(c.id))
    .sort((a, b) => a.name.localeCompare(b.name))

  async function handleSave() {
    if (isSubmitting) return
    const trimmed = name.trim()

    // Validate every field in one pass, so problems surface inline under the
    // control rather than as a toast that vanishes.
    const nextErrors: Record<string, string> = {}
    if (!trimmed) nextErrors.name = "Category name is required."

    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors)
      document.getElementById("category-name")?.focus()
      return
    }
    setErrors({})

    // Reading the picked file can fail; keep the sheet open and say so rather
    // than losing the edit to an unhandled rejection.
    let image: string | null
    try {
      image = await resolveImage(imageFiles)
    } catch {
      toast.error("Could not read the image file.", {
        description: "Pick a different image, or remove it.",
      })
      return
    }

    if (isEdit) {
      updateCategory.mutate(
        {
          id: category.id,
          patch: {
            name: trimmed,
            description: description.trim(),
            image,
            parentId,
            isActive,
            isInternal,
          },
        },
        {
          onSuccess: () => {
            setOpen(false)
            toast.success("Category saved", { description: trimmed })
          },
        }
      )
      return
    }

    const siblings = categories.filter((c) => c.parentId === parentId)
    const rank = siblings.reduce((max, c) => Math.max(max, c.rank), -1) + 1
    createCategory.mutate(
      {
        name: trimmed,
        handle: slugify(trimmed),
        description: description.trim(),
        image,
        parentId,
        isActive,
        isInternal,
        rank,
      },
      {
        onSuccess: (created) => {
          setOpen(false)
          toast.success("Category created", { description: created.name })
        },
      }
    )
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      {trigger ? <SheetTrigger render={trigger} /> : null}
      <SheetContent
        side="right"
        className="z-50 flex flex-col gap-0 overflow-hidden rounded-xl bg-popover p-0 outline-none data-[side=right]:inset-y-4 data-[side=right]:right-4 data-[side=right]:left-auto data-[side=right]:h-[calc(100svh-2rem)] data-[side=right]:w-[min(30rem,calc(100vw-2rem))] data-[side=right]:max-w-none data-[side=right]:sm:max-w-none"
      >
        <SheetHeader className="border-b px-5 py-4 sm:px-6">
          <SheetTitle>{isEdit ? "Edit category" : "New category"}</SheetTitle>
          <SheetDescription>
            {isEdit
              ? "Update the category details."
              : "Add a category to your catalog tree."}
          </SheetDescription>
        </SheetHeader>

        <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-5 py-4 sm:px-6">
          <div className="flex flex-col gap-1.5">
            <FieldLabel htmlFor="category-name">Name</FieldLabel>
            <Input
              id="category-name"
              value={name}
              onChange={(event) => {
                setName(event.target.value)
                clearError("name")
              }}
              placeholder="e.g. Outerwear"
              autoComplete="off"
              required
              aria-invalid={!!errors.name}
            />
            {errors.name ? <FieldError>{errors.name}</FieldError> : null}
          </div>

          <div className="flex flex-col gap-1.5">
            <FieldLabel htmlFor="category-handle">Handle</FieldLabel>
            <Input
              id="category-handle"
              value={handle}
              readOnly
              aria-readonly="true"
              className="text-muted-foreground"
            />
            <span className="text-sm text-muted-foreground">
              The storefront URL, derived from the name.
            </span>
          </div>

          <div className="flex flex-col gap-1.5">
            <FieldLabel htmlFor="category-description">Description</FieldLabel>
            <Textarea
              id="category-description"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="Short description for the category."
              className="min-h-20"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <FieldLabel htmlFor="category-image">Image</FieldLabel>
            {/* Remounted per target so an existing image rehydrates: the sheet
                stays mounted between opens, and the upload hook only reads
                initialFiles once. */}
            <CategoryImageField
              key={`${category?.id ?? "new"}:${String(open)}`}
              inputId="category-image"
              initialFiles={imageAsInitialFiles(category?.image)}
              onFilesChange={setImageFiles}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <FieldLabel htmlFor="category-parent">Parent category</FieldLabel>
            <Select
              value={parentId ?? NO_PARENT}
              onValueChange={(value) =>
                setParentId(value === NO_PARENT ? null : value)
              }
            >
              <SelectTrigger id="category-parent" className="w-full">
                <SelectValue>
                  {parentId === null
                    ? "None (top level)"
                    : categories.find((c) => c.id === parentId)?.name}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NO_PARENT}>None (top level)</SelectItem>
                {parentOptions.map((option) => (
                  <SelectItem key={option.id} value={option.id}>
                    {option.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 flex-col">
              <FieldLabel htmlFor="category-active">Active</FieldLabel>
              <span className="text-sm text-muted-foreground">
                Visible in the storefront.
              </span>
            </div>
            <Switch
              id="category-active"
              checked={isActive}
              onCheckedChange={setIsActive}
            />
          </div>

          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 flex-col">
              <FieldLabel htmlFor="category-internal">Internal</FieldLabel>
              <span className="text-sm text-muted-foreground">
                Admin-only, hidden from the storefront.
              </span>
            </div>
            <Switch
              id="category-internal"
              checked={isInternal}
              onCheckedChange={setIsInternal}
            />
          </div>
        </div>

        <SheetFooter className="flex-row justify-end border-t px-5 py-4 sm:px-6">
          <SheetClose render={<Button type="button" variant="outline" />}>
            Cancel
          </SheetClose>
          <Button type="button" onClick={handleSave} disabled={isSubmitting}>
            {isSubmitting ? (
              <Spinner data-icon="inline-start" aria-hidden="true" />
            ) : null}
            {isEdit ? "Save changes" : "Create category"}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
