import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import ProductApprovalModal from './ProductApprovalModal'

const normalizeRevisions = (value) => {
  if (!Array.isArray(value) || value.length === 0) {
    return []
  }

  return value.map((revision) => {
    if (Array.isArray(revision.files)) {
      return revision
    }

    const fallbackFiles = revision.file_url
      ? [{
          url: revision.file_url,
          name: revision.file_name || 'File'
        }]
      : []

    return {
      ...revision,
      files: fallbackFiles
    }
  })
}

const getSummary = (record) => {
  const revisions = normalizeRevisions(record?.revisions)
  const latest = revisions[revisions.length - 1]

  if (!latest) {
    return { className: 'action-missing' }
  }

  if (!latest.files?.length) {
    return { className: 'action-missing' }
  }

  if (latest.status === 'APPROVED') {
    return { className: 'btn-success' }
  }

  return { className: 'action-waiting' }
}

export default function ProductApprovalCell({ orderItemId, approvalType, itemCode }) {
  const [record, setRecord] = useState(null)
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (!orderItemId) {
      setRecord(null)
      return
    }

    const fetchApproval = async () => {
      setLoading(true)
      try {
        const { data, error } = await supabase
          .from('product_approvals')
          .select('*')
          .eq('order_item_id', orderItemId)
          .eq('approval_type', approvalType.key)
          .maybeSingle()

        if (error) throw error
        setRecord(data || null)
      } catch (error) {
        console.error('Error fetching product approval:', error)
        setRecord(null)
      } finally {
        setLoading(false)
      }
    }

    fetchApproval()
  }, [approvalType.key, orderItemId])

  const summary = useMemo(() => getSummary(record), [record])

  return (
    <>
      <button
        type="button"
        className={`btn btn-xs approval-trigger action-menu-button ${summary.className}`}
        onClick={() => setOpen(true)}
        disabled={loading}
      >
        {loading ? 'Loading...' : approvalType.name.toUpperCase()}
      </button>

      {open && (
        <ProductApprovalModal
          open={open}
          onClose={() => setOpen(false)}
          orderItemId={orderItemId}
          itemCode={itemCode}
          approvalType={approvalType}
          initialRecord={record}
          onSaved={setRecord}
        />
      )}
    </>
  )
}
