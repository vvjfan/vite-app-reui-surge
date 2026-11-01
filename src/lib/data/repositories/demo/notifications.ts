import type { NotificationPref } from "../../notifications"
import { makeDemoCollection } from "./make-collection"

export const demoNotificationPrefsRepository =
  makeDemoCollection<NotificationPref>((db) => db.notificationPrefs)
