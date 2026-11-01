import { useQuery } from "@tanstack/react-query"

import { PageHeader } from "@/components/shared/page-header"
import { Button } from "@/components/ui/button"
import { categoriesListQuery } from "../queries"
import { CategoryFormSheet } from "./category-form-sheet"
import { PlusIcon } from "@phosphor-icons/react"

export function CategoriesHeader() {
  // Undefined until the store read settles, so the badge appears only once real.
  const { data: categories } = useQuery(categoriesListQuery())
  const count = categories?.length

  return (
    <PageHeader
      title="Categories"
      count={count === undefined ? undefined : `${count} categories`}
      actions={
        <CategoryFormSheet
          mode="create"
          trigger={
            <Button>
              <PlusIcon
                data-icon="inline-start"
                className="size-4"
                aria-hidden="true"
              />
              New category
            </Button>
          }
        />
      }
    />
  )
}
