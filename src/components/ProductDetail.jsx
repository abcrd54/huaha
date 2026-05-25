import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useStore } from '../stores/useStore'
import { uploadToCloudinary } from '../lib/cloudinary'
import { ImagePlus, Trash2, X } from 'lucide-react'
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
  target_date: '',
  remarks: ''
}

export default function ProductDetail({ item, onClose, onSave }) {
  const { selectedProject } = useStore()
  const [formData, setFormData] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [pictureFile, setPictureFile] = useState(null)
  const [picturePreview, setPicturePreview] = useState('')

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
        target_date: item.target_date || '',
        remarks: item.remarks || ''
      })
      setPictureFile(null)
      setPicturePreview(item.picture_url || '')
      return
    }

    setFormData(emptyForm)
    setPictureFile(null)
    setPicturePreview('')
  }, [item])

  useEffect(() => {
    lockBodyScroll()
    return () => unlockBodyScroll()
  }, [])

  useEffect(() => () => {
    if (picturePreview?.startsWith('blob:')) {
      URL.revokeObjectURL(picturePreview)
    }
  }, [picturePreview])

  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData((current) => ({ ...current, [name]: value }))
  }

  const handlePictureChange = (event) => {
    const nextFile = event.target.files?.[0]
    if (!nextFile) return

    setPictureFile(nextFile)
    setPicturePreview((current) => {
      if (current?.startsWith('blob:')) {
        URL.revokeObjectURL(current)
      }

      return URL.createObjectURL(nextFile)
    })
  }

  const handleRemovePicture = () => {
    setPictureFile(null)
    setPicturePreview((current) => {
      if (current?.startsWith('blob:')) {
        URL.revokeObjectURL(current)
      }

      return ''
    })
    setFormData((current) => ({ ...current, picture_url: '' }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!selectedProject) {
      await notifyInfo('Please select a project first')
      return
    }

    setSaving(true)
    try {
      let pictureUrl = formData.picture_url
      if (pictureFile) {
        pictureUrl = await uploadToCloudinary(pictureFile)
      }

      const payload = {
        ...formData,
        picture_url: pictureUrl,
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
            <div className="form-control col-span-2">
              <label className="label">
                <span className="label-text">Picture</span>
              </label>
              <div className="product-image-field">
                <div className="product-image-preview-card">
                  {picturePreview ? (
                    <img
                      src={picturePreview}
                      alt={formData.product_name || formData.code || 'Product preview'}
                      className="product-image-preview"
                    />
                  ) : (
                    <div className="product-image-placeholder">
                      <ImagePlus size={32} />
                      <span>No image selected</span>
                    </div>
                  )}
                </div>

                <div className="product-image-upload-card">
                  <div className="product-image-upload-copy">
                    <div className="product-image-upload-title">Product image</div>
                    <div className="product-image-upload-text">
                      Upload a clean product reference. JPG, PNG, or WEBP works best.
                    </div>
                  </div>

                  <div className="product-image-upload-actions">
                    <label className="btn btn-outline product-image-upload-button">
                      <ImagePlus size={16} />
                      {picturePreview ? 'Change Image' : 'Choose Image'}
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handlePictureChange}
                        style={{ display: 'none' }}
                        disabled={saving}
                      />
                    </label>

                    {picturePreview && (
                      <button
                        type="button"
                        className="btn btn-ghost product-image-remove-button"
                        onClick={handleRemovePicture}
                        disabled={saving}
                      >
                        <Trash2 size={15} />
                        Remove
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>

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
