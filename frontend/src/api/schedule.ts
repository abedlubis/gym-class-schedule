import { apiGet } from './client'
import type { Club, FilterOptions, ScheduleResult } from '@/types/schedule'

export const fetchClubs = (signal?: AbortSignal) =>
  apiGet<Club[]>('/clubs', {}, signal)

export const fetchSchedule = (
  params: { club?: string; week?: string },
  signal?: AbortSignal,
) => apiGet<ScheduleResult>('/schedule', params, signal)

export const fetchFilters = (club?: string, signal?: AbortSignal) =>
  apiGet<FilterOptions>('/filters', { club }, signal)
