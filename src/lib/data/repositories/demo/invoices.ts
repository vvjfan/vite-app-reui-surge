import type { Invoice } from "../../billing"
import { makeDemoCollection } from "./make-collection"

export const demoInvoicesRepository = makeDemoCollection<Invoice>(
  (db) => db.invoices
)
