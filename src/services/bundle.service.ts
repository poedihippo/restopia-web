import api from '@/hooks/useApi'

const BASE = '/bundles'

const bundleService = {
  list: (params?: Record<string, any>) => api.get(BASE, { params }),
  findById: (id: number, params?: Record<string, any>) => api.get(`${BASE}/${id}`, { params }),
}

export default bundleService
