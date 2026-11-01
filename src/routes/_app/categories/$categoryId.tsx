import { createFileRoute, Link } from "@tanstack/react-router"
import { useQuery } from "@tanstack/react-query"

import { cn } from "@/lib/utils"
import { buttonVariants } from "@/components/ui/button"
import { CategoryDetail } from "@/features/categories/components/category-detail"
import { categoryDetailQuery } from "@/features/categories/queries"
import {
  FolderMinusIcon as FolderXIcon,
  SpinnerGapIcon as Loader2Icon,
} from "@phosphor-icons/react"

export const Route = createFileRoute("/_app/categories/$categoryId")({
  component: CategoryDetailPage,
})

function CategoryDetailPage() {
  const { categoryId } = Route.useParams()
  // Reads from the shared query cache: reflects live edits, and shows the
  // not-found state if the category was deleted.
  const categoryQuery = useQuery(categoryDetailQuery(categoryId))

  if (categoryQuery.isPending) {
    return (
      <div className="mx-auto flex w-full max-w-3xl flex-col items-center gap-3 p-10 text-center">
        <Loader2Icon
          className="size-10 animate-spin text-muted-foreground"
          aria-hidden="true"
        />
        <p className="text-sm text-muted-foreground">Loading category</p>
      </div>
    )
  }

  const category = categoryQuery.data

  if (!category) {
    return (
      <div className="mx-auto flex w-full max-w-3xl flex-col items-center gap-3 p-10 text-center">
        <FolderXIcon
          className="size-10 text-muted-foreground"
          aria-hidden="true"
        />
        <p className="text-sm font-medium text-foreground">
          Category not found
        </p>
        <p className="text-sm text-muted-foreground">
          This category doesn&apos;t exist or may have been removed.
        </p>
        <Link
          to="/categories"
          className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
        >
          Back to categories
        </Link>
      </div>
    )
  }

  return <CategoryDetail key={category.id} category={category} />
}
