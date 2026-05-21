import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

export default function ProductApprovalButtons({ orderItemId, onExpand, isExpanded }) {
  const [approvals, setApprovals] = useState([])
  const [loading, setLoading] = useState(false)

  const approvalTypes = [
    { id: 1, name: 'Sketsa', key: 'sketsa', hasRevisions: true },
    { id: 2, name: 'Shop Drawing', key: 'shop_drawing', hasRevisions: true },
    { id: 3, name: 'Tech Drawing', key: 'tech_drawing', hasRevisions: true },
    { id: 4, name: 'Index BOM', key: 'index_bom', hasRevisions: false },
    { id: 5, name: 'Carton Box', key: 'carton_box', hasRevisions: true }
  ]

  useEffect(() => {
    if (orderItemId) {
      fetchApprovals()
    }
  }, [orderItemId])

  const fetchApprovals = async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('product_approvals')
        .select('*')
        .eq('order_item_id', orderItemId)
        .single()

      if (error && error.code !== 'PGRST116') throw error
      setApprovals(data || {})
    } catch (error) {
      console.error('Error fetching product approvals:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleApproval = async (approvalKey) => {
    try {
      const currentStatus = approvals[approvalKey] || 'PENDING'
      const newStatus = currentStatus === 'APPROVED' ? 'PENDING' : 'APPROVED'

      const updateData = {
        order_item_id: orderItemId,
        [approvalKey]: newStatus,
        [`${approvalKey}_at`]: newStatus === 'APPROVED' ? new Date().toISOString() : null
      }

      const { error } = await supabase
        .from('product_approvals')
        .upsert(updateData, { onConflict: 'order_item_id' })

      if (error) throw error

      await fetchApprovals()
    } catch (error) {
      console.error('Approval error:', error)
      alert('Failed to update approval')
    }
  }

  if (loading) {
    return <span className="loading loading-spinner loading-sm"></span>
  }

  return (
    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
      {approvalTypes.map((type) => {
        const status = approvals[type.key] || 'PENDING'
        return (
          <button
            key={type.id}
            className={`btn btn-xs ${status === 'APPROVED' ? 'btn-success' : 'btn-outline'}`}
            onClick={() => onExpand(type)}
            disabled={!orderItemId}
          >
            {status === 'APPROVED' ? '✓' : ''} {type.name}
          </button>
        )
      })}
    </div>
  )
}
