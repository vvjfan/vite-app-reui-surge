import type { StockLocation } from "../../locations"
import type { LocationInput, LocationsRepository } from "../types"
import { notImplementedRepository } from "./not-implemented"

export const liveLocationsRepository: LocationsRepository =
  notImplementedRepository<StockLocation, LocationInput>("locations")
