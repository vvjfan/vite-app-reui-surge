import { type ReactNode } from "react"
import {
  formatBytes,
  useFileUpload,
  type FileMetadata,
  type FileWithPreview,
} from "@/hooks/use-file-upload"
import { Alert, AlertDescription, AlertTitle } from "@/components/reui/alert"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldLabel,
  FieldTitle,
} from "@/components/ui/field"
import { Item, ItemMedia } from "@/components/ui/item"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import {
  getOptionLabel,
  PRODUCT_STATUS_OPTIONS,
  type ProductSelectOption,
  type ProductStatusValue,
} from "./product-form-data"
import {
  WarningCircleIcon as AlertCircleIcon,
  FileIcon,
  InfoIcon,
  PlusIcon,
  XIcon,
} from "@phosphor-icons/react"

// Form field helpers distilled from the ReUI form-12 block, shared by the
// product editor. The block's markup is preserved; only the option data and
// wiring change.

const dashedSeparatorClassName =
  "border-border bg-transparent data-horizontal:h-0 data-horizontal:border-t data-horizontal:border-dashed"

function DashedSeparator() {
  return <Separator className={dashedSeparatorClassName} />
}

export function InsetSeparator() {
  return (
    <div className="px-5 sm:px-6">
      <DashedSeparator />
    </div>
  )
}

function ProductFormHint({
  label,
  children,
}: {
  label: string
  children: string
}) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className="shrink-0 text-muted-foreground hover:text-foreground"
            aria-label={label}
          />
        }
      >
        <InfoIcon aria-hidden="true" />
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-60 text-xs leading-relaxed">
        {children}
      </TooltipContent>
    </Tooltip>
  )
}

export function ProductRow({
  title,
  description,
  hint,
  htmlFor,
  align = "center",
  children,
}: {
  title: string
  description: string
  hint?: string
  htmlFor?: string
  align?: "center" | "start"
  children: ReactNode
}) {
  return (
    <Field
      className={cn(
        "grid gap-3 px-5 py-4 sm:px-6 md:grid-cols-[minmax(0,14rem)_minmax(0,1fr)]",
        align === "start" ? "md:items-start" : "md:items-center"
      )}
    >
      <FieldContent className="gap-0.5 md:pt-0.5">
        <div className="flex min-w-0 items-center gap-1.5">
          {htmlFor ? (
            <FieldLabel htmlFor={htmlFor}>{title}</FieldLabel>
          ) : (
            <FieldTitle>{title}</FieldTitle>
          )}
          {hint ? (
            <ProductFormHint label={`${title} details`}>{hint}</ProductFormHint>
          ) : null}
        </div>
        <FieldDescription>{description}</FieldDescription>
      </FieldContent>
      <div className="min-w-0">{children}</div>
    </Field>
  )
}

export function OptionSelect<TValue extends string>({
  id,
  value,
  options,
  onValueChange,
}: {
  id: string
  value: TValue
  options: ProductSelectOption<TValue>[]
  onValueChange: (value: TValue) => void
}) {
  return (
    <Select
      value={value}
      onValueChange={(nextValue) => nextValue && onValueChange(nextValue)}
    >
      <SelectTrigger id={id} className="w-full [&_small]:hidden">
        <SelectValue>{getOptionLabel(options, value)}</SelectValue>
      </SelectTrigger>
      <SelectContent alignItemWithTrigger={false}>
        <SelectGroup>
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              <span className="flex min-w-0 flex-col items-start gap-px">
                <span className="font-medium">{option.label}</span>
                <small className="line-clamp-1 text-xs text-muted-foreground">
                  {option.description}
                </small>
              </span>
            </SelectItem>
          ))}
        </SelectGroup>
      </SelectContent>
    </Select>
  )
}

function ProductStatusLabel({
  option,
}: {
  option?: ProductSelectOption<ProductStatusValue>
}) {
  if (!option) {
    return null
  }

  return (
    <span className="flex min-w-0 items-center gap-2">
      <span className={cn("size-1.5 shrink-0 rounded-full", option.color)} />
      <span className="truncate">{option.label}</span>
    </span>
  )
}

export function ProductStatusSelect({
  value,
  onValueChange,
}: {
  value: ProductStatusValue
  onValueChange: (value: ProductStatusValue) => void
}) {
  const selectedOption = PRODUCT_STATUS_OPTIONS.find(
    (option) => option.value === value
  )

  return (
    <Select
      value={value}
      onValueChange={(nextValue) => nextValue && onValueChange(nextValue)}
    >
      <SelectTrigger id="product-status" className="w-full">
        <SelectValue>
          <ProductStatusLabel option={selectedOption} />
        </SelectValue>
      </SelectTrigger>
      <SelectContent alignItemWithTrigger={false}>
        <SelectGroup>
          {PRODUCT_STATUS_OPTIONS.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              <span className="flex min-w-0 items-start gap-2">
                <span
                  className={cn(
                    "mt-2 size-1.5 shrink-0 rounded-full",
                    option.color
                  )}
                />
                <span className="flex min-w-0 flex-col gap-px">
                  <span className="font-medium">{option.label}</span>
                  <small className="line-clamp-1 text-xs text-muted-foreground">
                    {option.description}
                  </small>
                </span>
              </span>
            </SelectItem>
          ))}
        </SelectGroup>
      </SelectContent>
    </Select>
  )
}

interface ProductThumbnailUploadProps {
  inputId: string
  maxFiles?: number
  maxSize?: number
  accept?: string
  multiple?: boolean
  className?: string
  initialFiles?: FileMetadata[]
  onFilesChange?: (files: FileWithPreview[]) => void
}

export function ProductThumbnailUpload({
  inputId,
  maxFiles = 8,
  maxSize = 3 * 1024 * 1024,
  accept = "image/*",
  multiple = true,
  className,
  initialFiles,
  onFilesChange,
}: ProductThumbnailUploadProps) {
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
    maxFiles,
    maxSize,
    accept,
    multiple,
    initialFiles,
    onFilesChange,
  })

  function isImage(file: File | FileMetadata) {
    return file.type.startsWith("image/")
  }

  return (
    <div className={cn("w-full", className)}>
      <div
        className={cn(
          "flex min-w-0 items-center gap-3 rounded-lg border border-dashed border-border p-4 transition-colors",
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
            "aria-label": "Upload product thumbnails",
          })}
          className="sr-only"
        />

        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={openFileDialog}
          className={cn(isDragging && "animate-bounce")}
        >
          <PlusIcon data-icon="inline-start" aria-hidden="true" />
          Add files
        </Button>

        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
          {files.length === 0 ? (
            <p className="min-w-0 text-sm text-muted-foreground">
              Drop product photos here or click to browse.
            </p>
          ) : (
            files.map((fileItem) => (
              <div key={fileItem.id} className="group/item relative shrink-0">
                {isImage(fileItem.file) && fileItem.preview ? (
                  <img
                    src={fileItem.preview}
                    alt={fileItem.file.name}
                    className="size-12 rounded-lg border object-cover"
                    width={48}
                    height={48}
                    title={`${fileItem.file.name} (${formatBytes(
                      fileItem.file.size
                    )})`}
                  />
                ) : (
                  <Item
                    className="flex size-12 items-center justify-center border bg-muted p-0"
                    title={`${fileItem.file.name} (${formatBytes(
                      fileItem.file.size
                    )})`}
                  >
                    <ItemMedia variant="icon" className="size-auto">
                      <FileIcon
                        className="size-5 text-muted-foreground"
                        aria-hidden="true"
                      />
                    </ItemMedia>
                  </Item>
                )}

                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="absolute -top-2 -right-2 size-5 rounded-full opacity-100 shadow-md transition-opacity sm:opacity-0 sm:group-hover/item:opacity-100"
                  aria-label={`Remove ${fileItem.file.name}`}
                  onClick={() => removeFile(fileItem.id)}
                >
                  <XIcon className="size-3" aria-hidden="true" />
                </Button>
              </div>
            ))
          )}
        </div>

        {files.length > 0 ? (
          <div className="shrink-0 text-xs text-muted-foreground">
            {files.length}/{maxFiles}
          </div>
        ) : null}
      </div>

      {errors.length > 0 ? (
        <Alert variant="destructive" className="mt-3">
          <AlertCircleIcon aria-hidden="true" />
          <AlertTitle>File upload error</AlertTitle>
          <AlertDescription>
            {errors.map((error) => (
              <p key={error} className="last:mb-0">
                {error}
              </p>
            ))}
          </AlertDescription>
        </Alert>
      ) : null}
    </div>
  )
}
