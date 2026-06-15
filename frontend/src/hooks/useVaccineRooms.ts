import { useEffect, useState } from 'react'
import { apiClient } from '../lib/api-client'
import type { VaccineRoom, PaginatedResponse } from '../types'

export interface ApiVaccineRoom {
  id: string
  location_id: string
  location_name?: string
  description: string
  is_deleted: boolean
  deleted_by?: string
  deleted_at?: string
  created_at: string
}

export function mapApiVaccineRoom(a: ApiVaccineRoom): VaccineRoom {
  return {
    id: a.id,
    locationId: a.location_id,
    locationName: a.location_name,
    description: a.description,
    isDeleted: a.is_deleted,
    deletedBy: a.deleted_by,
    deletedAt: a.deleted_at,
    createdAt: a.created_at,
  }
}

export function useVaccineRooms(): { vaccineRooms: VaccineRoom[]; loadingRooms: boolean } {
  const [vaccineRooms, setVaccineRooms] = useState<VaccineRoom[]>([])
  const [loadingRooms, setLoadingRooms] = useState(true)

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const res = await apiClient.get<PaginatedResponse<ApiVaccineRoom>>(
          '/vaccine-rooms?page=1&page_size=20'
        )
        if (!cancelled) {
          setVaccineRooms(res.data.map(mapApiVaccineRoom))
        }
      } finally {
        if (!cancelled) setLoadingRooms(false)
      }
    }
    void load()
    return () => { cancelled = true }
  }, [])

  return { vaccineRooms, loadingRooms }
}
