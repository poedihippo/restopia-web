import ProductionEdit from '@/views/Productions/ProductionEdit'
import { useRouter } from 'next/router'

const ProductionEditPage = () => {
  const router = useRouter()
  const id = router.query.id
  return <ProductionEdit id={Number(id)} />
}

export default ProductionEditPage;
