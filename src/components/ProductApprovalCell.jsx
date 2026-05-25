import { useEffect, useMemo, useState } from 'react'
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

export default function ProductApprovalCell({ orderItemId, approvalType, itemCode, record: recordProp, onRecordChange }) {
  const [record, setRecord] = useState(recordProp || null)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    setRecord(recordProp || null)
  }, [recordProp])

  const summary = useMemo(() => getSummary(record), [record])

  return (
    <>
      <button
        type="button"
        className={`btn btn-xs approval-trigger action-menu-button ${summary.className}`}
        onClick={() => setOpen(true)}
      >
        {approvalType.name.toUpperCase()}
      </button>

      {open && (
        <ProductApprovalModal
          open={open}
          onClose={() => setOpen(false)}
          orderItemId={orderItemId}
          itemCode={itemCode}
          approvalType={approvalType}
          initialRecord={record}
          onSaved={(nextRecord) => {
            setRecord(nextRecord)
            onRecordChange?.(nextRecord)
          }}
        />
      )}
    </>
  )
}
