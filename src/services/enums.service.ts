import api from '@/hooks/useApi'

export const enumsService = {
  getAll: () => api.get('/enums'),
}
