import { useQuery } from "@tanstack/react-query"
import { toast } from "sonner"

import { PageHeader } from "@/components/shared/page-header"
import { Button } from "@/components/ui/button"
import { customersListQuery } from "../queries"
import { CustomerFormSheet } from "./customer-form-sheet"
import {
  DownloadSimpleIcon as DownloadIcon,
  PlusIcon,
} from "@phosphor-icons/react"

export function CustomersHeader() {
  // Undefined until the store read settles, so the badge appears only once real.
  const { data: customers } = useQuery(customersListQuery())
  const count = customers?.length

  return (
    <PageHeader
      title="Customers"
      count={count === undefined ? undefined : `${count} customers`}
      actions={
        <>
          <Button
            variant="outline"
            onClick={() =>
              toast.success("Export", {
                description: "Demo. Download from your storage.",
              })
            }
          >
            <DownloadIcon
              data-icon="inline-start"
              className="size-4"
              aria-hidden="true"
            />
            Export
          </Button>
          <CustomerFormSheet
            mode="create"
            trigger={
              <Button>
                <PlusIcon
                  data-icon="inline-start"
                  className="size-4"
                  aria-hidden="true"
                />
                Add customer
              </Button>
            }
          />
        </>
      }
    />
  )
}
