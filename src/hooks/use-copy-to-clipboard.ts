"use client"

import { useState } from "react"

export function useCopyToClipboard({
  timeout = 2000,
  onCopy,
}: {
  timeout?: number
  onCopy?: () => void
} = {}) {
  const [isCopied, setIsCopied] = useState(false)

  const copyToClipboard = (value: string) => {
    // lib.dom types navigator.clipboard as always present, but it is undefined
    // in insecure contexts (non-HTTPS), so the optional chain is load-bearing.
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    if (typeof window === "undefined" || !navigator.clipboard?.writeText) {
      return
    }

    if (!value) return

    navigator.clipboard.writeText(value).then(() => {
      setIsCopied(true)

      if (onCopy) {
        onCopy()
      }

      if (timeout !== 0) {
        setTimeout(() => {
          setIsCopied(false)
        }, timeout)
      }
    }, console.error)
  }

  return { isCopied, copyToClipboard }
}
