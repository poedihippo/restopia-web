import api from '@/hooks/useApi'

export const productUomBatchesService = {
  list: (params?: any) => api.get('/product-uom-batches', { params }),
  findById: (id: number, params?: any) =>
    api.get(`/product-uom-batches/${id}`, { params }),
  create: (body: any) => api.post('/product-uom-batches', body),
  update: (id: number, body: any) =>
    api.patch(`/product-uom-batches/${id}`, body),
  remove: (id: number) => api.delete(`/product-uom-batches/${id}`),
}

export default productUomBatchesService
