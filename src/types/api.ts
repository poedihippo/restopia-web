import { components } from './api.d'
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
export type TokenRequest = components["schemas"]["TokenRequest"]
export interface RefreshTokenRequest {
  refresh_token: string
}
export type TokenResponse = components["schemas"]["TokenResponse"]
export interface ChangeActiveBranchRequest {
  branch_id: number
}

// Companies
export interface CompanyRequest {
  name: string
  address?: string
  phone?: string
  email?: string
  product_types?: string | null
}

// Branches
export type BranchRequest = components["schemas"]["CreateBranchRequest"]
export type UpdateBranchRequest = components["schemas"]["UpdateBranchRequest"]

// Product Category Account Settings
export interface ProductCategoryAccountSettingRequest {
  product_category_id: number
  chart_of_account_id: number
  description?: string
}

export interface ProductCategoryAccountSettingUpdateRequest {
  product_category_id?: number
  chart_of_account_id?: number
  description?: string
}

// Branch Account Settings
export interface BranchAccountSettingRequest {
  branch_id: number
  account_setting_key_id: number
  chart_of_account_id: number
  description?: string
}

export interface BranchAccountSettingUpdateRequest {
  branch_id?: number
  account_setting_key_id?: number
  chart_of_account_id?: number
  description?: string
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
  department_ids?: number[]
  role_ids?: number[]
}



// Product Categories
export interface ProductCategoryRequest {
  name: string
  description?: string
}

// Products
export interface ProductConversionPayload {
  id?: number
  target_uom_id: number
  amount: number
}

export interface ProductUomPayload {
  id?: number
  uom_id: number
  code: string
  name?: string
  base_price: number
  online_price?: number
  franchise_price?: number
  price_editable?: boolean
  is_default?: boolean
  is_active?:boolean,
  conversions?: ProductConversionPayload[]
}

export interface ProductRequest {
  product_category_id: number
  code: string
  name: string
  type: 'raw' | 'wip' | 'final' | 'supply'
  description?: string
  base_uom_id?: number | null
  reorder_point?: number | null
  is_active?: boolean
  uoms?: ProductUomPayload[]
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
  name?: string
  base_price: number
  online_price?: number
  franchise_price?: number
  price_editable?: boolean
  is_default?: boolean
  is_active?: boolean
}

// GET /v1/product-uoms/name-suggestions?product_id=
export interface ProductUomNameSuggestion {
  product_uom_id: number
  uom_id: number
  uom_name: string
  base_uom_id: number
  base_uom_name: string
  factor: string | null
  suggested_name: string
  reason: 'base_uom' | 'conversion' | 'no_conversion_path' | 'ambiguous'
}

// Product Inventories
export interface ProductInventoryRequest {
  product_uom_id: number
  code: string
  expiry_date?: string
  status: 'active' | 'inactive'
}

export interface BulkUpdateProductInventoryItem {
  id: number
  stock?: number
}

export interface BulkUpdateProductInventoryRequest {
  items: BulkUpdateProductInventoryItem[]
}

export interface ProductInventoryUpdateRequest {
  code?: string
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
  display_qty?: number | null
  display_uom_code?: string | null
  base_stock?: number | null
  base_uom_code?: string | null
  converted_qty?: number | null
  converted_uom_code?: string | null
  min_qty?: number
  expiry_date?: string
  status?: 'active' | 'inactive'
  created_at?: string
  owner_ref?: string
  stage?: string
  location_ref?: string
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

export interface ConvertProductInventoryMovementSummary {
  product_inventory_id?: number
  product_uom_batch_id?: number
  product_uom_id?: number
  batch_code?: string
  direction?: 'in' | 'out'
  qty?: number
  stock_before?: number
  stock_after?: number
  uom_id?: number
  uom_code?: string
}

export interface ConvertProductInventoryRequest {
  product_inventory_id: number
  target_product_uom_id: number
  qty: number
}

export interface ConvertProductInventoryResponse {
  product_id?: number
  source_product_uom_id?: number
  source_uom_id?: number
  target_product_uom_id?: number
  target_uom_id?: number
  conversion_amount?: number
  target_product_inventory_created?: boolean
  source?: ConvertProductInventoryMovementSummary
  target?: ConvertProductInventoryMovementSummary
}

// Stock Movements
export interface StockMovementRequest {
  product_inventory_id?: number
  product_uom_batch_id?: number
  qty: number
  direction: 'in' | 'out'
  description?: string
  product_type?: 'raw' | 'wip' | 'final' | 'supply'
  product_category_id?: number
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
  owner_ref?: string | null
  stage?: string | null
  location_ref?: string | null
}
export interface ProductionDetail {
  product_uom_id: number
  qty: number
  status: 'pending' | 'final'
  expiry_date?: string
  description?: string
  owner_ref?: string | null
  stage?: string | null
  location_ref?: string | null
  materials?: ProductionMaterial[]
}
export interface ProductionRequest {
  code: string
  date: string
  status: 'pending' | 'final'
  description?: string
  source_owner_ref?: string
  source_stage?: string
  source_location_ref?: string
  output_owner_ref?: string
  output_stage?: string
  output_location_ref?: string
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
  fulfillment_date?: string
  total_price: number
  type: 'offline' | 'online' | 'franchise'
  status: 'pending' | 'final'
  description?: string
  details: PurchaseOrderDetail[]
}

// Bundles
export interface BundleDetail {
  items: {
    product_uom_id: number
    qty: number
  }[]
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
  bundle_details?: { bundle_detail_item_id: number; product_inventory_id: number }[] | null
  qty: number
  price: number
  status: 'pending' | 'process' | 'completed'
  description?: string
}
export interface SalesOrderPaymentSplit {
  payment_method_id: number
  amount: number
  description?: string
}

export interface SalesOrderRequest {
  code?: string
  type: 'offline' | 'online' | 'franchise'
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
  /** Create only — tenders taken at order creation (partial / full payment) */
  payments?: SalesOrderPaymentSplit[]
  /** Create only — claim validated by backend against sum(payments) */
  payment_status?: 'pending' | 'partial' | 'paid'
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
  /** sales_order_details.id when the line comes from a held order being edited */
  detail_id?: number
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
  /** sales_order_details.id when the line comes from a held order being edited */
  detail_id?: number
  bundle_id: number
  name: string
  code: string
  price: number
  qty: number
  bundle_details: { bundle_detail_item_id: number; product_inventory_id: number }[]
}

export interface PaymentMethod {
  id: number
  name: string
  type?: string
  chart_of_account_id?: number | null
  bank_account_id?: number | null
  bank_account?: {
    id: number
    bank_name: string
    account_number: string
    account_name: string
  } | null
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

// Bulk Product Inventories
export interface BulkUpdateProductInventoryItem {
  id: number
  stock?: number
  min_qty?: number
}

export interface BulkUpdateProductInventoryRequest {
  items: BulkUpdateProductInventoryItem[]
}

// Price Lists
export interface PriceList {
  id: number
  company_id: number
  name: string
  is_active: boolean
}

export interface PriceListRequest {
  name: string
  is_active?: boolean
}

export interface PriceListItem {
  id: number
  price_list_id: number
  product_uom_id: number
  base_price: number
  online_price: number
  franchise_price: number
  product_uom?: any
}

export interface BulkUpsertPriceListItem {
  id?: number
  price_list_id?: number
  product_uom_id: number
  base_price: number
  online_price: number
  franchise_price: number
}

export interface BulkUpsertPriceListItemRequest {
  items: BulkUpsertPriceListItem[]
}
