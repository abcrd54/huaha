import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { X } from 'lucide-react'
import { lockBodyScroll, unlockBodyScroll } from '../lib/modalScrollLock'
import { notifyError, notifySuccess } from '../lib/notify'

const emptyForm = {
  company: '',
  project_name: '',
  description: '',
  request_date: '',
  initial_date: ''
}

export default function ProjectModal({ project, onClose, onSave }) {
  const [formData, setFormData] = useState(emptyForm)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (project) {
      setFormData({
        company: project.company || '',
        project_name: project.project_name || '',
        description: project.description || '',
        request_date: project.request_date || '',
        initial_date: project.initial_date || ''
      })
      return
    }

    setFormData(emptyForm)
  }, [project])

  useEffect(() => {
    lockBodyScroll()
    return () => unlockBodyScroll()
  }, [])

  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData((current) => ({ ...current, [name]: value }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSaving(true)

    try {
      if (project) {
        const { error } = await supabase
          .from('projects')
          .update(formData)
          .eq('id', project.id)

        if (error) throw error
        await notifySuccess('Project updated successfully')
      } else {
        const { error } = await supabase
          .from('projects')
          .insert(formData)

        if (error) throw error
        await notifySuccess('Project created successfully')
      }

      onSave()
      onClose()
    } catch (error) {
      console.error('Save error:', error)
      await notifyError('Failed to save project', error.message || '')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="modal modal-open">
      <button
        type="button"
        className="modal-close-external"
        onClick={onClose}
        disabled={saving}
        aria-label="Close modal"
      >
        <X size={18} />
      </button>
      <div className="modal-box" style={{ width: '90vw', maxWidth: 'none', padding: '3rem' }}>
        <h3 style={{ fontWeight: 'bold', fontSize: '1.75rem', marginBottom: '2rem' }}>
          {project ? 'Edit Project' : 'Add Project'}
        </h3>

        <form onSubmit={handleSubmit}>
          <div className="form-control mb-4">
            <label className="label">
              <span className="label-text">Company *</span>
            </label>
            <input
              type="text"
              name="company"
              value={formData.company}
              onChange={handleChange}
              className="input input-bordered"
              required
            />
          </div>

          <div className="form-control mb-4">
            <label className="label">
              <span className="label-text">Project Name *</span>
            </label>
            <input
              type="text"
              name="project_name"
              value={formData.project_name}
              onChange={handleChange}
              className="input input-bordered"
              required
            />
          </div>

          <div className="form-control mb-4">
            <label className="label">
              <span className="label-text">Description</span>
            </label>
            <textarea
              name="description"
              value={formData.description}
              onChange={handleChange}
              className="textarea textarea-bordered"
              rows="3"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="form-control mb-4">
              <label className="label">
                <span className="label-text">Request Date</span>
              </label>
              <input
                type="date"
                name="request_date"
                value={formData.request_date}
                onChange={handleChange}
                className="input input-bordered"
              />
            </div>

            <div className="form-control mb-4">
              <label className="label">
                <span className="label-text">Initial Date</span>
              </label>
              <input
                type="date"
                name="initial_date"
                value={formData.initial_date}
                onChange={handleChange}
                className="input input-bordered"
              />
            </div>
          </div>

          <div className="modal-action">
            <button
              type="button"
              className="btn btn-ghost"
              onClick={onClose}
              disabled={saving}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={saving}
            >
              {saving ? 'Saving...' : 'Save'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
