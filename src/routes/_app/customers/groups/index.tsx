import { createFileRoute } from "@tanstack/react-router"
import { useQuery } from "@tanstack/react-query"

import { PageHeader } from "@/components/shared/page-header"
import { Button } from "@/components/ui/button"
import { GroupFormSheet } from "@/features/customers/components/group-form-sheet"
import { GroupsDataGrid } from "@/features/customers/components/groups-data-grid"
import { customerGroupsListQuery } from "@/features/customers/queries"
import { PlusIcon } from "@phosphor-icons/react"

export const Route = createFileRoute("/_app/customers/groups/")({
  staticData: { crumb: "Groups" },
  component: GroupsListPage,
})

function GroupsListPage() {
  const groupsQuery = useQuery(customerGroupsListQuery())
  const groups = groupsQuery.data

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Customer groups"
        count={groups === undefined ? undefined : `${groups.length} groups`}
        actions={
          <GroupFormSheet
            mode="create"
            trigger={
              <Button>
                <PlusIcon
                  data-icon="inline-start"
                  className="size-4"
                  aria-hidden="true"
                />
                New group
              </Button>
            }
          />
        }
      />

      <GroupsDataGrid />
    </div>
  )
}
