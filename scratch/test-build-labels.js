const data = {
  production_details: [
    {
      production_detail_materials: [
        {
          id: 29,
          product_inventory_id: 2,
          qty: 1,
          product_inventory: {
            id: 2,
            product_uom_batch_id: 2,
            stock: 89,
            status: "active",
            product_uom_batch: {
              id: 2,
              product_uom_id: 11,
              product_uom: {
                id: 11,
                code: "CK-PCCS",
                product: {
                  id: 11,
                  code: "CK-PCCS",
                  name: "Puding Cheese Cake 30X40"
                },
                uom: { id: 9, code: "PCS" }
              }
            }
          }
        }
      ]
    }
  ]
};

function getProductName(inv) {
  return (
    inv?.product_uom_batch?.product_uom?.product?.name ??
    inv?.product_uom?.product?.name ??
    ''
  )
}

function getUomCode(inv) {
  return (
    inv?.product_uom_batch?.product_uom?.uom?.code ??
    inv?.product_uom?.uom?.code ??
    ''
  )
}

function buildMaterialLabels(production) {
  const labels = {}
  ;(production?.production_details ?? []).forEach((d, di) => {
    ;(d?.production_detail_materials ?? []).forEach((m, mi) => {
      const inv = m?.product_inventory
      if (!inv) return
      const name = getProductName(inv)
      const uomCode = getUomCode(inv)
      const sku = inv?.code ?? ''
      labels[`${di}-${mi}`] = [name, uomCode, sku ? `SKU: ${sku}` : '']
        .filter(Boolean)
        .join(' · ')
    })
  })
  return labels
}

console.log(buildMaterialLabels(data));
