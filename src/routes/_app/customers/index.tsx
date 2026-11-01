import { createFileRoute } from "@tanstack/react-router"

import { CustomersDataGrid } from "@/features/customers/components/customers-data-grid"
import { CustomersHeader } from "@/features/customers/components/customers-header"

export const Route = createFileRoute("/_app/customers/")({
  component: CustomersListPage,
})

function CustomersListPage() {
  return (
    <div className="flex flex-col gap-4">
      <CustomersHeader />
      <CustomersDataGrid />
    </div>
  )
}
