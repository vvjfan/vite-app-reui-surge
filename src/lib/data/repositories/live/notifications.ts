import type { NotificationPrefsRepository } from "../types"
import { notImplementedRepository } from "./not-implemented"

export const liveNotificationPrefsRepository: NotificationPrefsRepository =
  notImplementedRepository("notification preferences")
