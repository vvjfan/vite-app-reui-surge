import { createFileRoute, Link } from "@tanstack/react-router"
import { useQuery } from "@tanstack/react-query"

import { cn } from "@/lib/utils"
import { buttonVariants } from "@/components/ui/button"
import { ProductEditor } from "@/features/products/components/product-editor"
import { productDetailQuery } from "@/features/products/queries"
import {
  SpinnerGapIcon as Loader2Icon,
  PackageIcon as PackageXIcon,
  WarningIcon as TriangleAlertIcon,
} from "@phosphor-icons/react"

export const Route = createFileRoute("/_app/products/$productId")({
  component: ProductDetailPage,
  errorComponent: () => (
    <div className="mx-auto flex w-full max-w-3xl flex-col items-center gap-3 p-10 text-center">
      <TriangleAlertIcon
        className="size-10 text-muted-foreground"
        aria-hidden="true"
      />
      <p className="text-sm font-medium text-foreground">
        Couldn&apos;t load this product
      </p>
      <p className="text-sm text-muted-foreground">
        Something went wrong. Please try again.
      </p>
      <Link
        to="/products"
        className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
      >
        Back to products
      </Link>
    </div>
  ),
})

function ProductDetailPage() {
  const { productId } = Route.useParams()
  // Reads from the shared query cache: reflects live edits, and shows the
  // not-found state if the product was deleted. The full-page editor edits in
  // place (admin-style), so this route is both the detail and the editor.
  const productQuery = useQuery(productDetailQuery(productId))

  // Pending: the client is reading the store. Show a loading state so no seed is
  // rendered, and no false "not found" flashes before the read settles.
  if (productQuery.isPending) {
    return (
      <div className="mx-auto flex w-full max-w-3xl flex-col items-center gap-3 p-10 text-center">
        <Loader2Icon
          className="size-10 animate-spin text-muted-foreground"
          aria-hidden="true"
        />
        <p className="text-sm text-muted-foreground">Loading product</p>
      </div>
    )
  }

  const product = productQuery.data

  if (!product) {
    return (
      <div className="mx-auto flex w-full max-w-3xl flex-col items-center gap-3 p-10 text-center">
        <PackageXIcon
          className="size-10 text-muted-foreground"
          aria-hidden="true"
        />
        <p className="text-sm font-medium text-foreground">Product not found</p>
        <p className="text-sm text-muted-foreground">
          This product doesn&apos;t exist or may have been removed.
        </p>
        <Link
          to="/products"
          className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
        >
          Back to products
        </Link>
      </div>
    )
  }

  // key by id so navigating between products re-initializes the editor form.
  return <ProductEditor key={product.id} mode="edit" product={product} />
}
