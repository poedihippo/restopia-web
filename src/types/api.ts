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
  code: string
  name: string
  is_default?: boolean
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
  nik?: string
  type?: 'superadmin' | 'user'
  phone?: string
  birth?: string
  gender?: 'male' | 'female'
  branch_ids?: number[]
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
  code: string
  name: string
  type: 'raw' | 'wip' | 'final'
  description?: string
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

export interface ProductInventory {
  id: number
  product_uom_id: number
  branch_id: number
  code?: string
  stock?: number
  qty?: number
  min_qty?: number
  base_price?: number
  online_price?: number
  price_editable?: boolean
  expiry_date?: string
  status?: 'active' | 'inactive'
  created_at?: string
  branch?: { id: number; name: string; code?: string }
  product_uom_batch?: {
    id: number
    code?: string
    expiry_date?: string
    product_uom?: {
      id: number
      code?: string
      product?: {
        id: number
        name: string
        type?: string
        product_category?: { id: number; name: string }
      }
      uom?: { id: number; name: string; code: string }
    }
  }
}

// Stock Movements
export interface StockMovementRequest {
  product_inventory_id: number
  qty: number
  direction: 'in' | 'out'
  description?: string
}

// Recipes
export interface RecipeMaterialItem {
  product_uom_id: number
  qty: number
}
export interface RecipeRequest {
  product_uom_id: number
  qty: number
  is_default: boolean
  materials: RecipeMaterialItem[]
}

// Productions
export interface ProductionMaterial {
  product_inventory_id: number
  qty: number
}
export interface ProductionDetail {
  product_uom_id: number
  qty: number
  status: 'pending' | 'final'
  expiry_date?: string
  description?: string
  materials?: ProductionMaterial[]
}
export interface ProductionRequest {
  code: string
  date: string
  status: 'pending' | 'final'
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
  discount_type: 'percent' | 'fixed'
  discount_value: number
  scope: 'company' | 'branch'
  valid_from: string
  valid_until: string
  status: 'active' | 'inactive'
  min_subtotal_price?: number
  max_discount_price?: number
  quota?: number
  description?: string
  branches?: VoucherBranch[]
  product_uoms?: VoucherProductUom[]
}

export interface VoucherStatusRequest {
  status: 'active' | 'inactive'
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
  code?: string
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
  settlement_status?: 'pending' | 'credit' | 'settled' | 'cancelled'
  credit_by_id?: number | null
  description?: string
  details: SalesOrderDetail[]
}

export interface SalesOrderSettlementItem {
  sales_order_id: number
  settlement_status: 'pending' | 'credit' | 'settled' | 'cancelled'
}

export interface SalesOrderBulkSettlementRequest {
  items: SalesOrderSettlementItem[]
}

export interface PosCartLotOption {
  product_inventory_id: number
  stock: number
  expiry_date?: string | null
  base_price: number
  online_price?: number | null
}

export interface PosCartItem {
  product_inventory_id: number
  name: string
  code: string
  price: number
  qty: number
  price_editable?: boolean
  expiry_date?: string | null
  lot_options?: PosCartLotOption[]
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

export interface PaymentUpdateRequest {
  payment_method_id: number
  amount: number
  description?: string
}
