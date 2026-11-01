import { useState } from "react"
import {
  UserCircleIcon as CircleUserIcon,
  ImageIcon,
  UploadSimpleIcon as UploadIcon,
  XIcon,
} from "@phosphor-icons/react"

import { useFileUpload } from "@/hooks/use-file-upload"
import { cn } from "@/lib/utils"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"

interface ImageUploadFieldProps {
  ariaLabel: string
  inputId?: string
  variant?: "avatar" | "image"
  defaultImage?: string
  alt?: string
  /** Notified with the chosen image as an inline data URI (or null when cleared). */
  onImageChange?: (dataUri: string | null) => void
}

// Avatar / image picker relocated from the ReUI profile-1 block. The block's
// icon-placeholder indirection is swapped for direct lucide icons (the project's
// icon library). Client-only: it never uploads to a server, it surfaces the
// chosen image as a data URI so the form can hold it as a persistable draft value.
export function ImageUploadField({
  ariaLabel,
  inputId,
  variant = "image",
  defaultImage,
  alt = "Uploaded image",
  onImageChange,
}: ImageUploadFieldProps) {
  const [removedCurrentImage, setRemovedCurrentImage] = useState(false)
  const [{ files }, { removeFile, openFileDialog, getInputProps }] =
    useFileUpload({
      accept: "image/*",
      onFilesChange: (next) => {
        // Surface a persistable data URI, not the transient object-URL preview
        // (which is revoked on remove and dead after a reload).
        const file = next.at(0)?.file
        if (file instanceof File) {
          const reader = new FileReader()
          reader.onload = () => {
            if (typeof reader.result === "string") {
              onImageChange?.(reader.result)
            }
          }
          reader.readAsDataURL(file)
        } else {
          onImageChange?.(null)
        }
      },
    })

  // files.at(0), not files[0]: with noUncheckedIndexedAccess off the index type
  // lies (never undefined), which would make the null-guards below read as
  // "unnecessary" to lint. .at() keeps the honest `| undefined`.
  const currentFile = files.at(0) ?? null
  const hasSavedImage = Boolean(defaultImage) && !removedCurrentImage
  const previewUrl =
    currentFile?.preview ?? (hasSavedImage ? (defaultImage ?? null) : null)
  const fileName = currentFile?.file.name
  const hasImage = Boolean(previewUrl)

  const handleCancelUpload = () => {
    if (!currentFile) {
      return
    }
    removeFile(currentFile.id)
  }

  const handleRemoveImage = () => {
    if (currentFile) {
      removeFile(currentFile.id)
    }
    setRemovedCurrentImage(true)
    onImageChange?.(null)
  }

  return (
    <div className="flex grow flex-wrap items-center justify-start gap-2">
      <div className="relative">
        <Avatar
          className={cn(
            "size-10 border",
            variant === "avatar"
              ? "rounded-full"
              : "rounded-lg after:rounded-lg"
          )}
        >
          <AvatarImage
            src={previewUrl ?? undefined}
            alt={fileName ?? alt}
            className={cn(variant === "avatar" ? "rounded-full" : "rounded-lg")}
          />
          <AvatarFallback
            className={cn(
              "bg-muted text-muted-foreground",
              variant === "avatar" ? "rounded-full" : "rounded-lg"
            )}
          >
            {variant === "avatar" ? (
              <CircleUserIcon
                className="size-4 opacity-60"
                aria-hidden="true"
              />
            ) : (
              <ImageIcon className="size-4 opacity-60" aria-hidden="true" />
            )}
          </AvatarFallback>
        </Avatar>

        {currentFile ? (
          <Button
            type="button"
            variant="outline"
            size="icon-xs"
            onClick={handleCancelUpload}
            className="absolute -top-1 -right-1 size-4 rounded-full"
            aria-label={`Cancel ${currentFile.file.name}`}
          >
            <XIcon aria-hidden="true" />
          </Button>
        ) : null}
      </div>

      {/* Actions */}
      <div className="relative inline-flex">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={openFileDialog}
          aria-haspopup="dialog"
        >
          <UploadIcon aria-hidden="true" />
          {hasImage ? "Change" : "Upload"}
        </Button>
        <input
          {...getInputProps({ id: inputId })}
          className="sr-only"
          aria-label={ariaLabel}
          tabIndex={-1}
        />
      </div>

      {hasImage ? (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleRemoveImage}
        >
          <XIcon aria-hidden="true" />
          Remove
        </Button>
      ) : null}
    </div>
  )
}
