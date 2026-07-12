import type { DictCategory, DictMarket, DictPlatform } from "../../api/config"
export type DictShape = {
  platforms: DictPlatform[]
  markets: DictMarket[]
  categories: DictCategory[]
  sourcing_pipeline_stages?: { id: string; label: string; tone?: string }[]
} | null
