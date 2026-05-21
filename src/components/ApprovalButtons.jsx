import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { notifyError, notifySuccess } from '../lib/notify'

export default function ApprovalButtons({ projectId }) {
  const [approvals, setApprovals] = useState([])
  const [loading, setLoading] = useState(false)

  const checkers = [
    { id: 1, name: 'SOLA HARUN', role: 'Design' },
    { id: 2, name: 'LILIS DARBI', role: 'Production' },
    { id: 3, name: 'AZHARI', role: 'Quality' },
    { id: 4, name: 'JOSEP', role: 'Manager' }
  ]

  useEffect(() => {
    if (projectId) {
      fetchApprovals()
      return
    }

    setApprovals([])
  }, [projectId])

  const fetchApprovals = async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('approvals')
        .select('*')
        .eq('project_id', projectId)

      if (error) throw error
      setApprovals(data || [])
    } catch (error) {
      console.error('Error fetching approvals:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleApproval = async (checkerName, status) => {
    try {
      const existing = approvals.find((entry) => entry.checker_name === checkerName)

      if (existing) {
        const { error } = await supabase
          .from('approvals')
          .update({
            status,
            approved_at: status === 'APPROVED' ? new Date().toISOString() : null,
            comments: ''
          })
          .eq('id', existing.id)

        if (error) throw error
      } else {
        const { error } = await supabase
          .from('approvals')
          .insert({
            project_id: projectId,
            checker_name: checkerName,
            status,
            approved_at: status === 'APPROVED' ? new Date().toISOString() : null
          })

        if (error) throw error
      }

      await fetchApprovals()
      await notifySuccess(`${checkerName} ${status.toLowerCase()}`)
    } catch (error) {
      console.error('Approval error:', error)
      await notifyError('Failed to update approval', error.message || '')
    }
  }

  const renderCard = (checker, status = 'PENDING', disabled = false) => (
    <div key={checker.id} className="card approval-card">
      <div className="approval-card-head centered">
        <h3 className="approval-name">{checker.name}</h3>
        <p className="approval-role">{checker.role}</p>
        <span className={`status-chip ${status === 'APPROVED' ? 'approved' : 'pending'}`}>
          {status === 'APPROVED' ? 'Approved' : 'Pending'}
        </span>
      </div>

      <button
        className={`btn approval-action ${status === 'APPROVED' ? 'btn-success' : 'btn-outline'}`}
        onClick={() => handleApproval(checker.name, status === 'APPROVED' ? 'PENDING' : 'APPROVED')}
        disabled={disabled}
      >
        {status === 'APPROVED' ? 'Approved' : 'Approve'}
      </button>
    </div>
  )

  if (loading) {
    return (
      <div className="approval-grid">
        {checkers.map((checker) => (
          <div key={checker.id} className="card approval-card approval-card-loading">
            <span className="loading loading-spinner loading-sm"></span>
          </div>
        ))}
      </div>
    )
  }

  if (!projectId) {
    return (
      <div className="approval-grid">
        {checkers.map((checker) => renderCard(checker, 'PENDING', true))}
      </div>
    )
  }

  return (
    <div className="approval-grid">
      {checkers.map((checker) => {
        const approval = approvals.find((entry) => entry.checker_name === checker.name)
        const status = approval?.status || 'PENDING'
        return renderCard(checker, status, false)
      })}
    </div>
  )
}
