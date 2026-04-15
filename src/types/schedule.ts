export type Category =
  | 'yoga'
  | 'dance'
  | 'cardio'
  | 'martial-cardio'
  | 'hybrid'
  | 'strength'
  | 'cycling'
  | 'hiit'
  | 'pilates'

export interface ScheduleClass {
  id: string
  location: string
  datetime: string
  class_name: string
  instructor: string[]
  category: Category | string
  tags: string[]
}

export interface ScheduleMeta {
  effective_from: string
  timezone: string
  locations: string[]
  notes: string[]
}

export interface ScheduleFiltersData {
  locations: string[]
  categories: string[]
  instructors: string[]
  class_names: string[]
  tags: string[]
}

export interface ScheduleDataset {
  meta: ScheduleMeta
  classes: ScheduleClass[]
  filters: ScheduleFiltersData
}

export type TimeRange = 'all' | 'morning' | 'afternoon' | 'evening' | 'after_work'

export interface ActiveFilters {
  search: string
  locations: string[]
  categories: string[]
  instructors: string[]
  tags: string[]
  dayKeys: string[]
  timeRange: TimeRange
  lesMillsOnly: boolean
}

export interface DayGroup {
  key: string
  label: string
  shortLabel: string
  classes: ScheduleClass[]
}
