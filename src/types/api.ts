// Generic API envelope
export interface ApiResponse<T = unknown> {
  success: boolean
  message: string
  data: T
}

// Pagination meta
export interface PaginatedMeta {
  current_page: number
  per_page: number
  total: number
  last_page: number
}

// Paginated response wrapper
export interface PaginatedData<T> {
  data: T[]
  meta: PaginatedMeta
}

// Common list query params
export interface ListParams {
  page?: number
  per_page?: number
  sort?: string
  include?: string
  'filter[search]'?: string
  [key: string]: string | number | boolean | undefined
}

// Auth
export interface TokenRequest {
  email: string
  password: string
}
export interface RefreshTokenRequest {
  refresh_token: string
}
export interface TokenResponse {
  access_token: string
  refresh_token: string
  token_type: string
  expires_in: number
}
export interface ChangeActiveBranchRequest {
  branch_id: number
}

// Companies
export interface CompanyRequest {
  name: string
  address?: string
  phone?: string
  email?: string
}

// Branches
export interface BranchRequest {
  company_id: number
  name: string
  address?: string
  phone?: string
  email?: string
}

// Roles
export interface RoleRequest {
  name: string
  permission_ids?: number[]
}

// Users
export interface UserRequest {
  name: string
  email: string
  password?: string
  branch_id: number
  role_ids?: number[]
}

// Product Categories
export interface ProductCategoryRequest {
  name: string
  description?: string
}

// Products
export interface ProductRequest {
  product_category_id: number
  name: string
  code?: string
  description?: string
  status: 'active' | 'inactive'
}

// UOMs
export interface UomRequest {
  name: string
  code: string
}

// Product Conversions
export interface ProductConversionRequest {
  product_id: number
  uom_id: number
  target_uom_id: number
  amount: number
}

// Product UOMs
export interface ProductUomRequest {
  product_id: number
  uom_id: number
  code?: string
  base_price: number
  online_price?: number
  price_editable?: boolean
  is_default?: boolean
}

// Product Inventories
export interface ProductInventoryRequest {
  product_uom_id: number
  code: string
  base_price: number
  online_price: number
  price_editable?: boolean
  expiry_date?: string
  status: 'active' | 'inactive'
}

export interface ProductInventoryUpdateRequest {
  code?: string
  base_price?: number
  online_price?: number
  price_editable?: boolean
  expiry_date?: string
  status?: 'active' | 'inactive'
}

// Stock Movements
export interface StockMovementRequest {
  product_inventory_id: number
  qty: number
  direction: 'in' | 'out'
  description?: string
}

// Recipes
export interface RecipeDetail {
  product_inventory_id: number
  qty: number
  description?: string
}
export interface RecipeRequest {
  product_uom_id: number
  name: string
  yield_qty: number
  description?: string
  details: RecipeDetail[]
}

// Productions
export interface ProductionDetail {
  recipe_id: number
  qty: number
  description?: string
}
export interface ProductionRequest {
  code: string
  branch_id: number
  date: string
  status: 'pending' | 'on_progress' | 'done' | 'cancelled'
  description?: string
  details: ProductionDetail[]
}

// Suppliers
export interface SupplierRequest {
  code: string
  name: string
  address?: string
  phone?: string
  email?: string
  pic?: string
}

// Purchase Orders
export interface PurchaseOrderDetail {
  id?: number
  product_inventory_id: number
  qty: number
  price: number
  description?: string
}
export interface PurchaseOrderRequest {
  code: string
  supplier_id?: number
  supplier_branch_id?: number
  branch_id?: number
  date: string
  total_price: number
  status: 'pending' | 'final'
  description?: string
  details: PurchaseOrderDetail[]
}

// Bundles
export interface BundleDetail {
  product_uom_id: number
  qty: number
}
export interface BundleRequest {
  name: string
  code?: string
  price: number
  status: 'active' | 'inactive'
  description?: string
  details: BundleDetail[]
}

// Deliveries
export interface DeliveryDetail {
  product_inventory_id: number
  qty: number
  price: number
  status: 'pending' | 'final'
  description?: string
}
export interface DeliveryRequest {
  code: string
  purchase_order_id?: number
  branch_id: number
  target_branch_id?: number
  date: string
  total_price: number
  status: 'pending' | 'final'
  description?: string
  details: DeliveryDetail[]
}

// Receipts
export interface ReceiptDetail {
  product_inventory_id: number
  delivery_detail_id?: number
  qty: number
  price: number
  status: 'pending' | 'final'
  description?: string
  client_ref?: string
}
export interface ReceiptRequest {
  code: string
  delivery_id: number
  date: string
  status: 'pending' | 'final'
  total_price: number
  description?: string
  details: ReceiptDetail[]
}

// Customers
export interface CustomerRequest {
  name: string
  phone?: string
  email?: string
  address?: string
}

// Vouchers
export interface VoucherBranch {
  branch_id: number
  quota?: number
}
export interface VoucherProductUom {
  product_uom_id: number
  quota?: number
}
export interface VoucherRequest {
  code: string
  name: string
  type: 'percentage' | 'fixed'
  value: number
  min_purchase?: number
  quota?: number
  start_date: string
  end_date: string
  status: 'active' | 'inactive'
  branches?: VoucherBranch[]
  product_uoms?: VoucherProductUom[]
}

// Sales Orders
export interface SalesOrderDetail {
  product_inventory_id?: number | null
  bundle_id?: number | null
  bundle_details?: { product_inventory_id: number; qty: number }[] | null
  qty: number
  price: number
  status: 'pending' | 'process' | 'completed'
  description?: string
}
export interface SalesOrderRequest {
  code: string
  type: 'offline' | 'online'
  customer_id?: number | null
  customer_name?: string
  customer_phone?: string
  date: string
  fulfillment_date?: string
  voucher_id?: number | null
  subtotal_price: number
  discount_price: number
  total_price: number
  status: 'pending' | 'final'
  description?: string
  details: SalesOrderDetail[]
}

export interface PosCartItem {
  product_inventory_id: number
  name: string
  code: string
  price: number
  qty: number
  price_editable?: boolean
}

export interface BundleDetail {
  product_uom_id: number
  qty: number
}

export interface Bundle {
  id: number
  code: string
  name: string
  price: number
  status: 'active' | 'inactive'
  description?: string
  details?: BundleDetail[]
}

export interface PosCartBundle {
  bundle_id: number
  name: string
  code: string
  price: number
  qty: number
  bundle_details: { product_inventory_id: number; qty: number }[]
}

export interface PaymentMethod {
  id: number
  name: string
}

export interface PaymentRequest {
  sales_order_id: number
  payment_method_id: number
  amount: number
  description?: string
}
