import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useStore } from '../stores/useStore'
import { X } from 'lucide-react'
import { lockBodyScroll, unlockBodyScroll } from '../lib/modalScrollLock'
import { notifyError, notifyInfo, notifySuccess } from '../lib/notify'

const emptyForm = {
  no: '',
  code: '',
  area: '',
  description: '',
  product_name: '',
  picture_url: '',
  length_mm: '',
  depth_mm: '',
  height_mm: '',
  qty: 1,
  main_material: '',
  finishing: '',
  fabric: '',
  foam: '',
  others_material: '',
  brass_handles: '',
  requested_date: '',
  target_date: '',
  priority: 'MEDIUM',
  remarks: '',
  status: 'DRAFT'
}

export default function ProductDetail({ item, onClose, onSave }) {
  const { selectedProject } = useStore()
  const [formData, setFormData] = useState(emptyForm)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (item) {
      setFormData({
        no: item.no || '',
        code: item.code || '',
        area: item.area || '',
        description: item.description || '',
        product_name: item.product_name || '',
        picture_url: item.picture_url || '',
        length_mm: item.length_mm || '',
        depth_mm: item.depth_mm || '',
        height_mm: item.height_mm || '',
        qty: item.qty || 1,
        main_material: item.main_material || '',
        finishing: item.finishing || '',
        fabric: item.fabric || '',
        foam: item.foam || '',
        others_material: item.others_material || '',
        brass_handles: item.brass_handles || '',
        requested_date: item.requested_date || '',
        target_date: item.target_date || '',
        priority: item.priority || 'MEDIUM',
        remarks: item.remarks || '',
        status: item.status || 'DRAFT'
      })
      return
    }

    setFormData(emptyForm)
  }, [item])

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
    if (!selectedProject) {
      await notifyInfo('Please select a project first')
      return
    }

    setSaving(true)
    try {
      const payload = {
        ...formData,
        project_id: selectedProject.id,
        length_mm: formData.length_mm ? parseFloat(formData.length_mm) : null,
        depth_mm: formData.depth_mm ? parseFloat(formData.depth_mm) : null,
        height_mm: formData.height_mm ? parseFloat(formData.height_mm) : null,
        qty: parseInt(formData.qty, 10) || 1
      }

      if (item) {
        const { error } = await supabase
          .from('order_items')
          .update(payload)
          .eq('id', item.id)

        if (error) throw error
        await notifySuccess('Order item updated successfully')
      } else {
        const { error } = await supabase
          .from('order_items')
          .insert(payload)

        if (error) throw error
        await notifySuccess('Order item created successfully')
      }

      onSave()
      onClose()
    } catch (error) {
      console.error('Save error:', error)
      await notifyError('Failed to save order item', error.message || '')
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
      <div className="modal-box max-w-6xl">
        <h3 className="font-bold text-lg mb-4">
          {item ? 'Edit Order Item' : 'Add Order Item'}
        </h3>

        <form onSubmit={handleSubmit}>
          <div className="grid grid-cols-2 gap-4">
            <div className="form-control">
              <label className="label">
                <span className="label-text">No *</span>
              </label>
              <input
                type="number"
                name="no"
                value={formData.no}
                onChange={handleChange}
                className="input input-bordered input-sm"
                required
              />
            </div>

            <div className="form-control">
              <label className="label">
                <span className="label-text">Code *</span>
              </label>
              <input
                type="text"
                name="code"
                value={formData.code}
                onChange={handleChange}
                className="input input-bordered input-sm"
                required
              />
            </div>

            <div className="form-control">
              <label className="label">
                <span className="label-text">Area</span>
              </label>
              <input
                type="text"
                name="area"
                value={formData.area}
                onChange={handleChange}
                className="input input-bordered input-sm"
              />
            </div>

            <div className="form-control col-span-2">
              <label className="label">
                <span className="label-text">Description</span>
              </label>
              <textarea
                name="description"
                value={formData.description}
                onChange={handleChange}
                className="textarea textarea-bordered"
                rows="2"
              />
            </div>

            <div className="form-control">
              <label className="label">
                <span className="label-text">Product Name</span>
              </label>
              <input
                type="text"
                name="product_name"
                value={formData.product_name}
                onChange={handleChange}
                className="input input-bordered input-sm"
              />
            </div>

            <div className="form-control">
              <label className="label">
                <span className="label-text">Picture URL</span>
              </label>
              <input
                type="url"
                name="picture_url"
                value={formData.picture_url}
                onChange={handleChange}
                className="input input-bordered input-sm"
                placeholder="https://..."
              />
            </div>

            <div className="form-control">
              <label className="label">
                <span className="label-text">Length (mm)</span>
              </label>
              <input
                type="number"
                step="0.01"
                name="length_mm"
                value={formData.length_mm}
                onChange={handleChange}
                className="input input-bordered input-sm"
              />
            </div>

            <div className="form-control">
              <label className="label">
                <span className="label-text">Depth (mm)</span>
              </label>
              <input
                type="number"
                step="0.01"
                name="depth_mm"
                value={formData.depth_mm}
                onChange={handleChange}
                className="input input-bordered input-sm"
              />
            </div>

            <div className="form-control">
              <label className="label">
                <span className="label-text">Height (mm)</span>
              </label>
              <input
                type="number"
                step="0.01"
                name="height_mm"
                value={formData.height_mm}
                onChange={handleChange}
                className="input input-bordered input-sm"
              />
            </div>

            <div className="form-control">
              <label className="label">
                <span className="label-text">Quantity</span>
              </label>
              <input
                type="number"
                name="qty"
                value={formData.qty}
                onChange={handleChange}
                className="input input-bordered input-sm"
                min="1"
              />
            </div>

            <div className="form-control">
              <label className="label">
                <span className="label-text">Main Material</span>
              </label>
              <input
                type="text"
                name="main_material"
                value={formData.main_material}
                onChange={handleChange}
                className="input input-bordered input-sm"
              />
            </div>

            <div className="form-control">
              <label className="label">
                <span className="label-text">Finishing</span>
              </label>
              <input
                type="text"
                name="finishing"
                value={formData.finishing}
                onChange={handleChange}
                className="input input-bordered input-sm"
              />
            </div>

            <div className="form-control">
              <label className="label">
                <span className="label-text">Fabric</span>
              </label>
              <input
                type="text"
                name="fabric"
                value={formData.fabric}
                onChange={handleChange}
                className="input input-bordered input-sm"
              />
            </div>

            <div className="form-control">
              <label className="label">
                <span className="label-text">Foam</span>
              </label>
              <input
                type="text"
                name="foam"
                value={formData.foam}
                onChange={handleChange}
                className="input input-bordered input-sm"
              />
            </div>

            <div className="form-control">
              <label className="label">
                <span className="label-text">Others Material</span>
              </label>
              <input
                type="text"
                name="others_material"
                value={formData.others_material}
                onChange={handleChange}
                className="input input-bordered input-sm"
              />
            </div>

            <div className="form-control">
              <label className="label">
                <span className="label-text">Brass Handles</span>
              </label>
              <input
                type="text"
                name="brass_handles"
                value={formData.brass_handles}
                onChange={handleChange}
                className="input input-bordered input-sm"
              />
            </div>

            <div className="form-control">
              <label className="label">
                <span className="label-text">Requested Date</span>
              </label>
              <input
                type="date"
                name="requested_date"
                value={formData.requested_date}
                onChange={handleChange}
                className="input input-bordered input-sm"
              />
            </div>

            <div className="form-control">
              <label className="label">
                <span className="label-text">Target Date</span>
              </label>
              <input
                type="date"
                name="target_date"
                value={formData.target_date}
                onChange={handleChange}
                className="input input-bordered input-sm"
              />
            </div>

            <div className="form-control">
              <label className="label">
                <span className="label-text">Priority</span>
              </label>
              <select
                name="priority"
                value={formData.priority}
                onChange={handleChange}
                className="select select-bordered select-sm"
              >
                <option value="LOW">LOW</option>
                <option value="MEDIUM">MEDIUM</option>
                <option value="HIGH">HIGH</option>
              </select>
            </div>

            <div className="form-control">
              <label className="label">
                <span className="label-text">Status</span>
              </label>
              <select
                name="status"
                value={formData.status}
                onChange={handleChange}
                className="select select-bordered select-sm"
              >
                <option value="DRAFT">DRAFT</option>
                <option value="PENDING">PENDING</option>
                <option value="APPROVED">APPROVED</option>
                <option value="REJECTED">REJECTED</option>
                <option value="COMPLETED">COMPLETED</option>
              </select>
            </div>

            <div className="form-control col-span-2">
              <label className="label">
                <span className="label-text">Remarks</span>
              </label>
              <textarea
                name="remarks"
                value={formData.remarks}
                onChange={handleChange}
                className="textarea textarea-bordered"
                rows="2"
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
