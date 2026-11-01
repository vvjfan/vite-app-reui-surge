import type { CustomerGroup } from "../../types"
import type { CustomerGroupsRepository } from "../types"
import { makeDemoCollection } from "./make-collection"

// Sample groups keep their slug ids (vip, wholesale, ...); newly created groups
// take the factory's random id, which never collides with a slug - the property
// the old `grp-N` counter was reaching for. The counter also handed a deleted
// group's id to the next one created, and Customer.groups holds these ids, so
// the new group arrived already populated with the old one's members.
export const demoCustomerGroupsRepository: CustomerGroupsRepository =
  makeDemoCollection<CustomerGroup>((db) => db.customerGroups)
