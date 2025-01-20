import React, { FC, useEffect, useMemo, useState } from 'react'
import { ExtensionPoint } from 'vtex.render-runtime'
import { OrderForm as OrderFormComponent } from 'vtex.order-manager'
import { useCssHandles, CssHandlesTypes } from 'vtex.css-handles'

import { fetchWithRetry } from './legacy/utils/fetchWithRetry'

const CSS_HANDLES = ['minicartSummary'] as const

interface Props {
  classes?: CssHandlesTypes.CustomClasses<typeof CSS_HANDLES>
}

interface Totalizer {
  id: string
  name: string
  value: number
  __typename: string
}

const Summary: FC<Props> = ({ classes }) => {
  const { useOrderForm } = OrderFormComponent

  const {
    orderForm: { totalizers, value, items, paymentData }
  } = useOrderForm()

  const [packagesSkuIds, setPackagesSkuIds] = useState<string[]>([])
  const [sgrSkuIds, setSgrSkuIds] = useState<string[]>([])

  const fetchSettings = () => {
    fetchWithRetry('/_v/private/api/cart-bags-manager/app-settings', 3).then((res: PackagesSkuIds) => {
      if (res) {
        try {
          const { bagsSettings, sgrSettings } = res?.data ?? {}

          setPackagesSkuIds(Object.values(bagsSettings))

          const allSkuIds: string[] = []

          Object.values(sgrSettings).forEach(sgrType => {
            if (sgrType?.skuIds) {
              allSkuIds.push(...sgrType.skuIds)
            }
          })

          setSgrSkuIds(allSkuIds)
        } catch (error) {
          console.error('Error in packages feature.', error)
        }
      }
    })
  }

  useEffect(() => {
    let isSubscribed = true

    if (isSubscribed) {
      fetchSettings()
    }

    return () => {
      isSubscribed = false
    }
  }, [])

  const flegValue = useMemo(() => {
    if (!packagesSkuIds.length) {
      return
    }
    return items.reduce((total: number, item: OrderFormItem) => {
      if (packagesSkuIds.includes(item.id)) {
        return (
          total + ((item?.listPrice as number) ?? 0) * (item?.quantity ?? 1)
        )
      }
      return total
    }, 0)
  }, [items, packagesSkuIds])

  const sgrValue = useMemo(() => {
    if (!sgrSkuIds.length) {
      return
    }
    return items.reduce((total: number, item: OrderFormItem) => {
      if (sgrSkuIds.includes(item.id)) {
        return (
          total + ((item?.listPrice as number) ?? 0) * (item?.quantity ?? 1)
        )
      }
      return total
    }, 0)
  }, [items, sgrSkuIds])

  const originalValue =
    items?.reduce(
      (total: number, item: OrderFormItem) =>
        (total as number) +
        ((item?.listPrice as number) ?? 0) * (item?.quantity ?? 1),
      0
    ) ?? 0

  const newTotalizers = useMemo(() => {
    if (!items?.length) {
      return []
    }

    const baseTotalizers = deepClone(totalizers)
    const totalizerItems = baseTotalizers.find((t: Totalizer) => t.id === 'Items')

    if (totalizerItems) {
      totalizerItems.value = originalValue - (flegValue + sgrValue)
    }

    const additionalTotalizers: Totalizer[] = []

    if (flegValue > 0) {
      additionalTotalizers.push({
        id: 'Packaging',
        name: 'Taxa ambalare',
        value: flegValue,
        __typename: 'Totalizer',
      })
    }

    if (sgrValue > 0) {
      additionalTotalizers.push({
        id: 'SGR',
        name: 'Garantie',
        value: sgrValue,
        __typename: 'Totalizer',
      })
    }

    const returnTotalizers = [...baseTotalizers, ...additionalTotalizers]

    if (items.length < 3 || items.length > 0) {
      fetchSettings()
    }

    const remainingItems = items.filter((item: any) => packagesSkuIds.includes(item.id) || sgrSkuIds.includes(item.id))

    if (remainingItems.length === items.length) {
      return [];
    }

    return returnTotalizers
  }, [totalizers, items, originalValue, flegValue, sgrValue])

  const { handles } = useCssHandles(CSS_HANDLES, { classes })

  return (
    <div className={`${handles.minicartSummary} ph4 ph6-l pt5`}>
      <ExtensionPoint
        id="checkout-summary"
        totalizers={newTotalizers}
        paymentData={paymentData}
        total={value}
        originalTotal={originalValue}
      />
    </div>
  )
}



function deepClone<T>(obj: T): T {
  try {
    return JSON.parse(JSON.stringify(obj))
  } catch (error) {
    return obj
  }
}

export default Summary
