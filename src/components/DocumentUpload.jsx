import { useState, useEffect } from 'react'
import { uploadToCloudinary } from '../lib/cloudinary'
import { formatDisplayDate } from '../lib/date'
import { supabase } from '../lib/supabase'
import { notifyConfirm, notifyError, notifyInfo, notifySuccess } from '../lib/notify'

export default function DocumentUpload({ orderItemId }) {
  const [documents, setDocuments] = useState([])
  const [uploading, setUploading] = useState(false)
  const [formData, setFormData] = useState({
    document_type: '',
    revision: ''
  })

  useEffect(() => {
    if (orderItemId) {
      fetchDocuments()
    }
  }, [orderItemId])

  const fetchDocuments = async () => {
    try {
      const { data, error } = await supabase
        .from('documents')
        .select('*')
        .eq('order_item_id', orderItemId)
        .order('uploaded_at', { ascending: false })

      if (error) throw error
      setDocuments(data || [])
    } catch (error) {
      console.error('Error fetching documents:', error)
    }
  }

  const handleFileUpload = async (e) => {
    const file = e.target.files[0]
    if (!file) return

    if (!formData.document_type || !formData.revision) {
      await notifyInfo('Please fill document type and revision')
      return
    }

    setUploading(true)
    try {
      const fileUrl = await uploadToCloudinary(file)

      const { data, error } = await supabase
        .from('documents')
        .insert({
          order_item_id: orderItemId,
          document_type: formData.document_type,
          revision: formData.revision,
          file_name: file.name,
          file_url: fileUrl,
          file_size: file.size
        })
        .select()

      if (error) throw error

      setDocuments([data[0], ...documents])
      setFormData({ document_type: '', revision: '' })
      e.target.value = ''
      await notifySuccess('Document uploaded successfully')
    } catch (error) {
      console.error('Upload error:', error)
      await notifyError('Upload failed', error.message || 'Unknown error')
    } finally {
      setUploading(false)
    }
  }

  const handleDelete = async (docId) => {
    const confirmed = await notifyConfirm({
      title: 'Delete this document?',
      text: 'This action cannot be undone.',
      confirmText: 'Delete'
    })
    if (!confirmed) return

    try {
      const { error } = await supabase
        .from('documents')
        .delete()
        .eq('id', docId)

      if (error) throw error

      setDocuments(documents.filter(d => d.id !== docId))
      await notifySuccess('Document deleted')
    } catch (error) {
      console.error('Delete error:', error)
      await notifyError('Delete failed', error.message || '')
    }
  }

  return (
    <div className="card bg-base-100 shadow-xl p-6">
      <h3 className="font-bold text-lg mb-4">Documents</h3>

      <div className="grid grid-cols-3 gap-2 mb-4">
        <div className="form-control">
          <label className="label label-text-alt">Document Type</label>
          <input
            type="text"
            placeholder="e.g. Drawing, Spec"
            value={formData.document_type}
            onChange={(e) => setFormData({ ...formData, document_type: e.target.value })}
            className="input input-bordered input-sm"
          />
        </div>

        <div className="form-control">
          <label className="label label-text-alt">Revision</label>
          <input
            type="text"
            placeholder="e.g. Rev A"
            value={formData.revision}
            onChange={(e) => setFormData({ ...formData, revision: e.target.value })}
            className="input input-bordered input-sm"
          />
        </div>

        <div className="form-control">
          <label className="label label-text-alt">File</label>
          <input
            type="file"
            className="file-input file-input-bordered file-input-sm"
            onChange={handleFileUpload}
            disabled={uploading}
            accept=".pdf,.dwg,.dxf,.jpg,.jpeg,.png,.xlsx,.xls"
          />
        </div>
      </div>

      {uploading && (
        <div className="flex justify-center mb-4">
          <span className="loading loading-spinner loading-sm"></span>
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="table table-sm">
          <thead>
            <tr>
              <th>Type</th>
              <th>Revision</th>
              <th>File Name</th>
              <th>Uploaded</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {documents.length === 0 ? (
              <tr>
                <td colSpan="5" className="text-center text-gray-500">
                  No documents uploaded yet
                </td>
              </tr>
            ) : (
              documents.map((doc) => (
                <tr key={doc.id}>
                  <td>{doc.document_type}</td>
                  <td>
                    <span className="badge badge-sm">{doc.revision}</span>
                  </td>
                  <td>
                    <a
                      href={doc.file_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="link link-primary"
                    >
                      {doc.file_name}
                    </a>
                  </td>
                  <td className="text-xs">
                    {formatDisplayDate(doc.uploaded_at)}
                  </td>
                  <td>
                    <button
                      className="btn btn-ghost btn-xs text-error"
                      onClick={() => handleDelete(doc.id)}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
