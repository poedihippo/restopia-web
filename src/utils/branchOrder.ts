/**
 * Business order of branch pickers (frontend only — branches have no sort
 * field in the API).
 *
 * PT Sumber Cemerlang Mandiri (company 2) is shown as outlet groups, each
 * outlet followed by its own pickup points:
 *
 *   Cibubur → Ciracas, Hankam, Tapos, Jatikramat, Kalisari
 *   Depok   → Jagakarsa, Sawangan, Cimanggis, Cibinong, Ciriung
 *   Bintaro → its pickup points, in the order the API returned them
 *   Meruyung→ its pickup points, in the order the API returned them
 *
 * Any other company-2 branch (warehouse, production, …) follows the four
 * groups. Branches of other companies are not reordered.
 */

const ORDERED_COMPANY_ID = 2

/** Outlets, in display order, each with its pickup points in display order. */
const GROUPS: { outlet: string; pickupPoints: string[] }[] = [
  { outlet: 'CIBUBUR', pickupPoints: ['CIRACAS', 'HANKAM', 'TAPOS', 'JATIKRAMAT', 'KALISARI'] },
  { outlet: 'DEPOK', pickupPoints: ['JAGAKARSA', 'SAWANGAN', 'CIMANGGIS', 'CIBINONG', 'CIRIUNG'] },
  { outlet: 'BINTARO', pickupPoints: [] },
  { outlet: 'MERUYUNG', pickupPoints: [] },
]

type AnyBranch = Record<string, any>

const normalize = (name: unknown) => String(name ?? '').toUpperCase().replace(/[^A-Z]/g, '')

function companyIdOf(b: AnyBranch): number | null {
  const id = b?.company_id ?? b?.company?.id
  return id == null ? null : Number(id)
}

/** Known pickup point by name → [group index, position within the group]. */
function pickupPointByName(name: string): [number, number] | null {
  const key = normalize(name)
  for (let g = 0; g < GROUPS.length; g++) {
    const idx = GROUPS[g].pickupPoints.findIndex((p) => key.includes(p))
    if (idx !== -1) return [g, idx]
  }
  return null
}

function outletGroupByName(name: string): number {
  const key = normalize(name)
  return GROUPS.findIndex((g) => key.includes(g.outlet))
}

function isPickupPoint(b: AnyBranch): boolean {
  return b?.format === 'pickup_point' || b?.parent_id != null
}

/** True when the branch belongs to the reordered company (by id, or by a known name when the id is missing). */
function isOrderedBranch(b: AnyBranch): boolean {
  const companyId = companyIdOf(b)
  if (companyId != null) return companyId === ORDERED_COMPANY_ID
  return pickupPointByName(b?.name) != null || outletGroupByName(b?.name) !== -1
}

/**
 * Returns the branches in business order. Company-2 branches are grouped
 * (outlet, then its pickup points) and placed where the first of them was;
 * every other branch keeps its position relative to the others.
 * Accepts any branch-like objects ({ id, name, company_id?, parent_id?, format? }).
 */
export function sortBranches<T>(branches: T[] | null | undefined): T[] {
  if (!Array.isArray(branches) || branches.length < 2) return branches ?? []
  const list = branches as unknown as AnyBranch[]

  const firstIdx = list.findIndex(isOrderedBranch)
  if (firstIdx === -1) return branches

  const ordered = list.filter(isOrderedBranch)
  const others = list.filter((b) => !isOrderedBranch(b))
  const byId = new Map<number, AnyBranch>()
  for (const b of ordered) if (b?.id != null) byId.set(Number(b.id), b)

  const unknownGroup = GROUPS.length
  const keyOf = (b: AnyBranch, originalIdx: number) => {
    const known = pickupPointByName(b?.name)
    if (isPickupPoint(b) || known) {
      const parent = b?.parent_id != null ? byId.get(Number(b.parent_id)) : undefined
      let group = parent ? outletGroupByName(parent.name) : -1
      if (group === -1 && known) group = known[0]
      if (group === -1) group = unknownGroup
      // Listed pickup points first in the client's order, the rest after in API order.
      const pos = known && known[0] === group ? known[1] : GROUPS[group]?.pickupPoints.length ?? 0
      return [group, 1, pos, originalIdx]
    }
    const group = outletGroupByName(b?.name)
    return [group === -1 ? unknownGroup : group, 0, 0, originalIdx]
  }

  const keyed = ordered.map((b) => ({ b, k: keyOf(b, list.indexOf(b)) }))
  keyed.sort((x, y) => {
    for (let i = 0; i < x.k.length; i++) if (x.k[i] !== y.k[i]) return x.k[i] - y.k[i]
    return 0
  })

  const othersBefore = list.slice(0, firstIdx).filter((b) => !isOrderedBranch(b))
  const othersAfter = others.slice(othersBefore.length)
  return [...othersBefore, ...keyed.map((x) => x.b), ...othersAfter] as unknown as T[]
}

/**
 * Sorts the branch array inside an API list response in place, whichever
 * envelope it comes in (`r.data.data` array or `r.data.data.data` paginated).
 */
export function sortBranchListResponse<R>(res: R): R {
  const body = (res as any)?.data
  if (Array.isArray(body?.data)) body.data = sortBranches(body.data)
  else if (Array.isArray(body?.data?.data)) body.data.data = sortBranches(body.data.data)
  return res
}
