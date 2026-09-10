export interface DeliveryReceiptCheckable {
  id?: number | null
  source_type?: string | null
  branch_id?: number | null
  branch?: { id: number; name?: string } | null
  target_branch_id?: number | null
  target_branch?: { id: number; name?: string } | null
}

export interface UserReceiptCheckable {
  type?: string | null
  branch_id?: number | null
  branch?: { id: number; name?: string } | null
}

/**
 * Validates whether the logged in user / branch is permitted to create or process
 * a receipt for a given delivery.
 *
 * Business Rules:
 * 1. Internal transfers/orders ('po_from_branch', 'transfer_to_branch', 'so_to_branch'
 *    or whenever target_branch_id is defined and distinct from source branch_id):
 *    - The source branch (Cabang Y) is the shipper: they CANNOT create a receipt for goods they sent.
 *    - The destination/target branch (Cabang X) is the receiver: ONLY they can create receipts.
 * 2. External deliveries from supplier ('po_from_supplier'):
 *    - The destination is target_branch_id (falling back to branch_id).
 *    - Only the receiving branch can create receipts.
 * 3. Pure superadmins without a bound branch can process any receipt.
 */
export function canUserCreateReceiptForDelivery(
  delivery?: DeliveryReceiptCheckable | null,
  user?: UserReceiptCheckable | null,
  isSuperadmin: boolean = false
): boolean {
  if (!delivery) return false

  const userBranchId = user?.branch?.id ?? user?.branch_id

  // Pure superadmin without specific branch assignment has full access
  if (isSuperadmin && !userBranchId) {
    return true
  }

  // If user has no branch and is not superadmin, they cannot create receipt
  if (!userBranchId) {
    return false
  }

  const sourceBranchId = delivery.branch?.id ?? delivery.branch_id
  const targetBranchId = delivery.target_branch?.id ?? delivery.target_branch_id

  const isInternal =
    delivery.source_type === 'po_from_branch' ||
    delivery.source_type === 'transfer_to_branch' ||
    delivery.source_type === 'so_to_branch' ||
    (Boolean(targetBranchId) && Boolean(sourceBranchId) && targetBranchId !== sourceBranchId)

  if (isInternal) {
    // If current user is at the sending branch (Cabang Y), they cannot create receipt
    if (sourceBranchId && userBranchId === sourceBranchId && userBranchId !== targetBranchId) {
      return false
    }

    // Only the target branch (Cabang X) can create receipt
    if (targetBranchId) {
      return userBranchId === targetBranchId
    }

    return false
  }

  // Supplier delivery (po_from_supplier) or standard delivery
  const receivingBranchId = targetBranchId ?? sourceBranchId
  if (receivingBranchId) {
    return userBranchId === receivingBranchId
  }

  return true
}
