import api from '@/hooks/useApi'

export const productUomBatchesService = {
  list: (params?: any) => api.get('/product-uom-batches', { params }),
  findById: (id: number, params?: any) =>
    api.get(`/product-uom-batches/${id}`, { params }),
}

export default productUomBatchesService
