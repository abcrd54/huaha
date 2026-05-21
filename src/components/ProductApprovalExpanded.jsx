import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { uploadToCloudinary } from '../lib/cloudinary'
import { Upload, FileText, X } from 'lucide-react'

export default function ProductApprovalExpanded({ orderItemId, approvalType }) {
  const [approvals, setApprovals] = useState({})
  const [loading, setLoading] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [uploadedFiles, setUploadedFiles] = useState({})

  const revisions = approvalType.hasRevisions
    ? ['submitted', 'rev1', 'rev2', 'rev3']
    : ['submitted']

  useEffect(() => {
    if (orderItemId) {
      fetchApprovals()
    }
  }, [orderItemId, approvalType])

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

  const handleApproval = async (revision) => {
    try {
      const fieldKey = `${approvalType.key}_${revision}`
      const currentStatus = approvals[fieldKey] || 'PENDING'
      const newStatus = currentStatus === 'APPROVED' ? 'PENDING' : 'APPROVED'

      const updateData = {
        order_item_id: orderItemId,
        [fieldKey]: newStatus,
        [`${fieldKey}_at`]: newStatus === 'APPROVED' ? new Date().toISOString() : null
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

  const handleFileUpload = async (revision, e) => {
    const file = e.target.files[0]
    if (!file) return

    setUploading(true)
    try {
      const fileUrl = await uploadToCloudinary(file)

      const fieldKey = `${approvalType.key}_${revision}_file`
      const updateData = {
        order_item_id: orderItemId,
        [fieldKey]: fileUrl
      }

      const { error } = await supabase
        .from('product_approvals')
        .upsert(updateData, { onConflict: 'order_item_id' })

      if (error) throw error

      setUploadedFiles(prev => ({ ...prev, [`${approvalType.key}_${revision}`]: fileUrl }))
      alert('File uploaded successfully!')
    } catch (error) {
      console.error('Upload error:', error)
      alert('Failed to upload file')
    } finally {
      setUploading(false)
    }
  }

  if (loading) {
    return (
      <tr>
        <td colSpan="22" style={{ padding: '1rem', textAlign: 'center', background: '#f9fafb' }}>
          <span className="loading loading-spinner loading-sm"></span>
        </td>
      </tr>
    )
  }

  return (
    <tr>
      <td colSpan="22" style={{ padding: '1.5rem 2rem', background: '#f9fafb', borderBottom: '2px solid var(--line)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <h4 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: 'var(--dark)', minWidth: '150px' }}>
            {approvalType.name}:
          </h4>
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
            {revisions.map((revision) => {
              const fieldKey = `${approvalType.key}_${revision}`
              const status = approvals[fieldKey] || 'PENDING'
              const label = revision === 'submitted' ? 'Submitted' : revision.replace('rev', 'Rev ')

              return (
                <button
                  key={revision}
                  className={`btn btn-sm ${status === 'APPROVED' ? 'btn-success' : 'btn-outline'}`}
                  onClick={() => handleApproval(revision)}
                  style={{ minWidth: '100px' }}
                >
                  {status === 'APPROVED' ? '✓ ' : ''}{label}
                </button>
              )
            })}
          </div>
        </div>
      </td>
    </tr>
  )
}
