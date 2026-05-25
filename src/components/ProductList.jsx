import { useState, useEffect } from 'react'
import { Plus, SquarePen } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { formatDisplayDate } from '../lib/date'
import { useStore } from '../stores/useStore'
import ProductApprovalCell from './ProductApprovalCell'
import { notifyError } from '../lib/notify'

const normalizeRevisions = (value) => {
  if (!Array.isArray(value) || value.length === 0) {
    return []
  }

  return value.map((revision) => ({
    ...revision,
    files: Array.isArray(revision.files)
      ? revision.files
      : revision.file_url
        ? [{ url: revision.file_url, name: revision.file_name || 'File' }]
        : []
  }))
}

export default function ProductList({ onAddItem, onSelectItem, refreshKey = 0 }) {
  const { selectedProject } = useStore()
  const [orderItems, setOrderItems] = useState([])
  const [approvalRecordsByItem, setApprovalRecordsByItem] = useState({})
  const [loading, setLoading] = useState(false)

  const getActiveWorkflowTarget = (item) => {
    const records = approvalRecordsByItem[item.id] || []

    const candidates = records
      .map((record) => {
        const revisions = normalizeRevisions(record.revisions)
        const latestRevision = revisions[revisions.length - 1]

        if (!latestRevision?.target_date || latestRevision.status === 'APPROVED') {
          return null
        }

        const previousRevision = revisions[revisions.length - 2]
        const startDateValue =
          previousRevision?.reviewed_at ||
          latestRevision.reviewed_at ||
          latestRevision.uploaded_at ||
          item.requested_date ||
          selectedProject?.request_date

        return {
          approvalType: record.approval_type,
          startDateValue,
          targetDateValue: latestRevision.target_date
        }
      })
      .filter(Boolean)
      .sort((left, right) => new Date(left.targetDateValue).getTime() - new Date(right.targetDateValue).getTime())

    return candidates[0] || null
  }

  const getPriorityState = (item) => {
    const workflowTarget = getActiveWorkflowTarget(item)
    const startDateValue = workflowTarget?.startDateValue || item.requested_date || selectedProject?.request_date
    const endDateValue = workflowTarget?.targetDateValue || item.target_date

    if (!startDateValue || !endDateValue) {
      return {
        ratio: 0.18,
        tone: 'medium',
        label: 'No active target',
        sublabel: '-'
      }
    }

    const startDate = new Date(startDateValue)
    const endDate = new Date(endDateValue)
    const now = new Date()
    const total = Math.max(endDate.getTime() - startDate.getTime(), 1)
    const elapsed = Math.min(Math.max(now.getTime() - startDate.getTime(), 0), total)
    const ratio = elapsed / total
    const daysLeft = Math.ceil((endDate.getTime() - now.getTime()) / 86400000)

    let tone = 'low'
    if (ratio >= 0.8 || daysLeft <= 2) {
      tone = 'high'
    } else if (ratio >= 0.55 || daysLeft <= 5) {
      tone = 'medium'
    }

    const isWorkflowTarget = Boolean(workflowTarget?.targetDateValue)
    const labelPrefix = isWorkflowTarget ? 'Owner target' : 'Item target'
    const label = daysLeft < 0 ? `${labelPrefix} overdue ${Math.abs(daysLeft)}d` : `${labelPrefix} ${daysLeft}d left`
    const sublabel = endDateValue ? formatDisplayDate(endDateValue) : '-'
    return { ratio, tone, label, sublabel }
  }

  useEffect(() => {
    if (selectedProject) {
      fetchOrderItems()
    } else {
      setOrderItems([])
    }
  }, [selectedProject, refreshKey])

  const fetchOrderItems = async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('order_items')
        .select('*')
        .eq('project_id', selectedProject.id)
        .order('no', { ascending: true })

      if (error) throw error
      const nextItems = data || []
      setOrderItems(nextItems)

      if (!nextItems.length) {
        setApprovalRecordsByItem({})
        return
      }

      const itemIds = nextItems.map((item) => item.id)
      const { data: approvalData, error: approvalError } = await supabase
        .from('product_approvals')
        .select('order_item_id, approval_type, revisions')
        .in('order_item_id', itemIds)

      if (approvalError) throw approvalError

      const groupedRecords = (approvalData || []).reduce((accumulator, record) => {
        if (!accumulator[record.order_item_id]) {
          accumulator[record.order_item_id] = []
        }

        accumulator[record.order_item_id].push(record)
        return accumulator
      }, {})

      setApprovalRecordsByItem(groupedRecords)
    } catch (error) {
      console.error('Error fetching order items:', error)
      await notifyError('Failed to load order items', error.message || '')
    } finally {
      setLoading(false)
    }
  }

  const approvalTypes = [
    { id: 1, name: 'Sketsa', key: 'sketsa' },
    { id: 2, name: 'Shop Drawing', key: 'shop_drawing' },
    { id: 3, name: 'Tech Drawing', key: 'tech_drawing' },
    { id: 4, name: 'Index BOM', key: 'index_bom' },
    { id: 5, name: 'Carton Box', key: 'carton_box' }
  ]

  const handleApprovalRecordChange = (orderItemId, nextRecord) => {
    setApprovalRecordsByItem((current) => {
      const next = { ...current }
      const existingRecords = [...(next[orderItemId] || [])]
      const existingIndex = existingRecords.findIndex((record) => record.approval_type === nextRecord.approval_type)

      if (existingIndex >= 0) {
        existingRecords[existingIndex] = nextRecord
      } else {
        existingRecords.push(nextRecord)
      }

      next[orderItemId] = existingRecords
      return next
    })
  }

  if (!selectedProject) {
    return (
      <div className="card" style={{ padding: '16px 16px 22px', marginBottom: '20px' }}>
        <div className="product-table-head">
          <button
            type="button"
            className="btn btn-outline btn-sm"
            onClick={onAddItem}
            disabled
          >
            <Plus size={16} />
            Add Product
          </button>
          <h2 className="table-title product-table-title">List Product</h2>
        </div>
        <div className="table-scroll">
          <table className="table product">
            <thead>
              <tr>
                <th style={{ width: '42px' }}>No</th>
                <th style={{ width: '82px' }}>Code</th>
                <th style={{ width: '82px' }}>Area</th>
                <th style={{ width: '74px' }}>Picture</th>
                <th style={{ width: '108px' }}>Description</th>
                <th style={{ width: '108px' }}>Product Name</th>
                <th style={{ width: '58px' }}>L<br />(mm)</th>
                <th style={{ width: '58px' }}>D<br />(mm)</th>
                <th style={{ width: '58px' }}>H<br />(mm)</th>
                <th style={{ width: '58px' }}>m3</th>
                <th style={{ width: '60px' }}>Qty<br />(Pcs)</th>
                <th style={{ width: '66px' }}>Total<br />(m3)</th>
                <th style={{ width: '84px' }}>Main Material</th>
                <th style={{ width: '88px' }}>Others Material</th>
                <th style={{ width: '84px' }}>Finishing</th>
                <th style={{ width: '74px' }}>Fabric</th>
                <th style={{ width: '64px' }}>Foam</th>
                <th style={{ width: '84px' }}>Remarks</th>
                <th style={{ width: '78px' }}>Target Date</th>
                <th style={{ width: '82px' }}>Priority</th>
                <th style={{ width: '110px' }}>Aksi</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td colSpan="21" style={{ textAlign: 'center', color: 'var(--muted)', padding: '2rem' }}>
                  Belum ada project dipilih
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="card" style={{ padding: '16px 16px 22px', marginBottom: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'center', padding: '2rem' }}>
          <span className="loading loading-spinner loading-lg"></span>
        </div>
      </div>
    )
  }

  return (
    <div className="card" style={{ padding: '16px 16px 22px', marginBottom: '20px' }}>
      <div className="product-table-head">
        <button
          type="button"
          className="btn btn-outline btn-sm"
          onClick={onAddItem}
          disabled={!selectedProject}
        >
          <Plus size={16} />
          Add Product
        </button>
        <h2 className="table-title product-table-title">List Product</h2>
      </div>
      <div className="product-status-legend">
        <span className="approval-legend-item">
          <span className="approval-legend-swatch danger" />
          = Upload perlu diselesaikan
        </span>
        <span className="approval-legend-item">
          <span className="approval-legend-swatch warning" />
          = Menunggu approve / revisi
        </span>
        <span className="approval-legend-item">
          <span className="approval-legend-swatch success" />
          = Approved
        </span>
      </div>
      <div className="table-scroll">
        <table className="table product product-table">
          <thead>
            <tr>
              <th style={{ width: '42px' }}>No</th>
              <th style={{ width: '82px' }}>Code</th>
              <th style={{ width: '82px' }}>Area</th>
              <th style={{ width: '74px' }}>Picture</th>
              <th style={{ width: '108px' }}>Description</th>
              <th style={{ width: '108px' }}>Product Name</th>
              <th style={{ width: '58px' }}>L<br />(mm)</th>
              <th style={{ width: '58px' }}>D<br />(mm)</th>
              <th style={{ width: '58px' }}>H<br />(mm)</th>
              <th style={{ width: '58px' }}>m3</th>
              <th style={{ width: '60px' }}>Qty<br />(Pcs)</th>
              <th style={{ width: '66px' }}>Total<br />(m3)</th>
              <th style={{ width: '84px' }}>Main Material</th>
              <th style={{ width: '88px' }}>Others Material</th>
              <th style={{ width: '84px' }}>Finishing</th>
              <th style={{ width: '74px' }}>Fabric</th>
              <th style={{ width: '64px' }}>Foam</th>
                <th style={{ width: '84px' }}>Remarks</th>
                <th style={{ width: '88px' }}>Target Date</th>
                <th style={{ width: '120px' }}>Priority</th>
                <th style={{ width: '110px' }}>Aksi</th>
              </tr>
            </thead>
            <tbody>
            {orderItems.length === 0 ? (
              <tr>
                <td colSpan="21" style={{ textAlign: 'center', color: 'var(--muted)', padding: '2rem' }}>
                  No order items yet. Click "+ Add Item" to create one.
                </td>
              </tr>
            ) : (
              orderItems.map((item) => {
                const volume = ((item.length_mm || 0) * (item.depth_mm || 0) * (item.height_mm || 0)) / 1000000000
                const totalVolume = volume * item.qty
                return (
                  <tr key={item.id}>
                    <td>
                      <button
                        type="button"
                        className="row-edit-button"
                        onClick={() => onSelectItem(item)}
                        aria-label={`Edit ${item.code}`}
                      >
                        <SquarePen size={12} />
                        <span>{item.no}</span>
                      </button>
                    </td>
                    <td>{item.code}</td>
                    <td>{item.area}</td>
                    <td>
                      {item.picture_url ? (
                        <img src={item.picture_url} alt={item.description} className="thumb" />
                      ) : (
                        <div className="thumb"></div>
                      )}
                    </td>
                    <td className="text-left">{item.description}</td>
                    <td className="text-left">{item.product_name}</td>
                    <td>{item.length_mm}</td>
                    <td>{item.depth_mm}</td>
                    <td>{item.height_mm}</td>
                    <td>{volume.toFixed(3)}</td>
                    <td>{item.qty}</td>
                    <td>{totalVolume.toFixed(3)}</td>
                    <td>{item.main_material}</td>
                    <td>{item.others_material}</td>
                    <td>{item.finishing}</td>
                    <td>{item.fabric || '-'}</td>
                    <td>{item.foam || '-'}</td>
                    <td>{item.remarks || '-'}</td>
                    <td>{formatDisplayDate(item.target_date)}</td>
                    <td>
                      {(() => {
                        const priority = getPriorityState(item)
                        return (
                          <div className="priority-meter-wrap">
                            <div className="priority-meter">
                              <div
                                className={`priority-meter-fill ${priority.tone}`}
                                style={{ width: `${Math.max(priority.ratio * 100, 10)}%` }}
                              />
                            </div>
                            <div className={`priority-meter-label ${priority.tone}`}>
                              {priority.label}
                            </div>
                            <div className="priority-meter-subtext">
                              {priority.sublabel}
                            </div>
                          </div>
                        )
                      })()}
                    </td>
                    <td onClick={(e) => e.stopPropagation()}>
                      <div className="action-menu-stack">
                        {approvalTypes.map((type) => (
                          <ProductApprovalCell
                            key={type.id}
                            orderItemId={item.id}
                            approvalType={type}
                            itemCode={item.code}
                            record={(approvalRecordsByItem[item.id] || []).find((record) => record.approval_type === type.key) || null}
                            onRecordChange={(nextRecord) => handleApprovalRecordChange(item.id, nextRecord)}
                          />
                        ))}
                      </div>
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
