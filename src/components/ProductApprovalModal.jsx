import { useEffect, useMemo, useState } from 'react'
import { Box, Download, File, FileImage, FileSpreadsheet, FileText, FileType, Upload, X } from 'lucide-react'
import mammoth from 'mammoth/mammoth.browser'
import * as XLSX from 'xlsx'
import { supabase } from '../lib/supabase'
import { uploadToCloudinary } from '../lib/cloudinary'
import { formatDisplayDate } from '../lib/date'
import { lockBodyScroll, unlockBodyScroll } from '../lib/modalScrollLock'
import { notifyError, notifyInfo } from '../lib/notify'
import ThreeModelPreview from './ThreeModelPreview'

const createRevisionRow = (index, targetDate = '') => ({
  label: index === 0 ? 'Submitted' : `Rev ${index}`,
  target_date: targetDate,
  files: [],
  status: 'EMPTY',
  uploaded_at: null,
  reviewed_at: null
})

const normalizeFiles = (revision) => {
  if (Array.isArray(revision.files)) {
    return revision.files
  }

  if (revision.file_url) {
    return [{
      url: revision.file_url,
      name: revision.file_name || 'File'
    }]
  }

  return []
}

const normalizeRevisions = (value) => {
  if (!Array.isArray(value) || value.length === 0) {
    return [createRevisionRow(0)]
  }

  return value.map((revision, index) => ({
    ...createRevisionRow(index),
    ...revision,
    files: normalizeFiles(revision)
  }))
}

const getFileMeta = (fileName = '') => {
  const ext = fileName.split('.').pop()?.toLowerCase() || ''

  if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext)) {
    return { icon: FileImage, accent: 'green', previewable: true, kind: 'image', ext }
  }

  if (ext === 'pdf') {
    return { icon: FileText, accent: 'red', previewable: true, kind: 'pdf', ext }
  }

  if (['xls', 'xlsx', 'csv'].includes(ext)) {
    return { icon: FileSpreadsheet, accent: 'green', previewable: true, kind: 'spreadsheet', ext }
  }

  if (['doc', 'docx'].includes(ext)) {
    return { icon: FileType, accent: 'blue', previewable: true, kind: 'document', ext }
  }

  if (['skp', 'dae', 'obj', 'fbx', '3ds'].includes(ext)) {
    return { icon: Box, accent: 'blue', previewable: false, kind: 'model', ext }
  }

  if (['glb', 'gltf'].includes(ext)) {
    return { icon: Box, accent: 'blue', previewable: true, kind: 'model3d', ext }
  }

  return { icon: File, accent: 'slate', previewable: false, kind: 'file', ext }
}

export default function ProductApprovalModal({
  open,
  onClose,
  orderItemId,
  itemCode,
  approvalType,
  initialRecord,
  onSaved
}) {
  const [revisions, setRevisions] = useState(normalizeRevisions(initialRecord?.revisions))
  const [saving, setSaving] = useState(false)
  const [uploadingIndex, setUploadingIndex] = useState(null)
  const [revisionPromptIndex, setRevisionPromptIndex] = useState(null)
  const [nextTargetDate, setNextTargetDate] = useState('')
  const [previewFile, setPreviewFile] = useState(null)
  const [previewLoading, setPreviewLoading] = useState(false)
  const [previewError, setPreviewError] = useState(false)
  const [previewDocHtml, setPreviewDocHtml] = useState('')
  const [previewSheetRows, setPreviewSheetRows] = useState([])
  const [previewSheetName, setPreviewSheetName] = useState('')

  const latestRevisionIndex = useMemo(() => revisions.length - 1, [revisions])

  useEffect(() => {
    if (!open) return undefined
    lockBodyScroll()
    return () => unlockBodyScroll()
  }, [open])

  useEffect(() => {
    setRevisions(normalizeRevisions(initialRecord?.revisions))
  }, [initialRecord])

  useEffect(() => {
    if (!previewFile) {
      setPreviewLoading(false)
      setPreviewError(false)
      setPreviewDocHtml('')
      setPreviewSheetRows([])
      setPreviewSheetName('')
      return undefined
    }

    const isImage = previewFile.kind === 'image'
    const isPdf = previewFile.kind === 'pdf'
    const isDoc = previewFile.kind === 'document'
    const isSheet = previewFile.kind === 'spreadsheet'
    setPreviewLoading(isImage || isPdf || isDoc || isSheet)
    setPreviewError(false)

    let cancelled = false

    const loadStructuredPreview = async () => {
      try {
        if (isDoc) {
          const response = await fetch(previewFile.url)
          if (!response.ok) throw new Error('Failed to fetch document')

          const arrayBuffer = await response.arrayBuffer()
          const result = await mammoth.convertToHtml({ arrayBuffer })
          if (cancelled) return

          setPreviewDocHtml(result.value || '')
          setPreviewLoading(false)
          return
        }

        if (isSheet) {
          const response = await fetch(previewFile.url)
          if (!response.ok) throw new Error('Failed to fetch spreadsheet')

          const arrayBuffer = await response.arrayBuffer()
          const workbook = XLSX.read(arrayBuffer, { type: 'array' })
          const firstSheetName = workbook.SheetNames[0]
          const sheet = workbook.Sheets[firstSheetName]
          const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, blankrows: false })

          if (cancelled) return

          setPreviewSheetName(firstSheetName || '')
          setPreviewSheetRows(rows || [])
          setPreviewLoading(false)
        }
      } catch (error) {
        console.error('Preview parse error:', error)
        if (!cancelled) {
          setPreviewLoading(false)
          setPreviewError(true)
        }
      }
    }

    if (isDoc || isSheet) {
      loadStructuredPreview()
    }

    return () => {
      cancelled = true
    }
  }, [previewFile])

  if (!open) return null

  const statusLabel = (status) => {
    if (status === 'APPROVED') return 'Approved'
    if (status === 'REVISION_REQUESTED') return 'Revision Requested'
    if (status === 'PENDING') return 'Need Review'
    return 'Waiting Upload'
  }

  const persistRevisions = async (nextRevisions) => {
    setSaving(true)
    try {
      const payload = {
        order_item_id: orderItemId,
        approval_type: approvalType.key,
        revisions: nextRevisions
      }

      const { data, error } = await supabase
        .from('product_approvals')
        .upsert(payload, { onConflict: 'order_item_id,approval_type' })
        .select()
        .single()

      if (error) throw error

      const normalized = normalizeRevisions(data.revisions)
      setRevisions(normalized)
      onSaved({ ...data, revisions: normalized })
    } catch (error) {
      console.error('Error saving product approval:', error)
      await notifyError('Failed to save approval workflow', error.message || '')
    } finally {
      setSaving(false)
    }
  }

  const handleFileUpload = async (index, fileList) => {
    const selectedFiles = Array.from(fileList || [])
    if (!selectedFiles.length) return

    setUploadingIndex(index)
    setSaving(true)
    try {
      const uploadedFiles = []
      for (const file of selectedFiles) {
        const uploadedUrl = await uploadToCloudinary(file)
        uploadedFiles.push({
          url: uploadedUrl,
          name: file.name
        })
      }

      const nextRevisions = revisions.map((revision, revisionIndex) => (
        revisionIndex === index
          ? {
              ...revision,
              files: uploadedFiles,
              uploaded_at: new Date().toISOString(),
              status: 'PENDING',
              reviewed_at: null
            }
          : revision
      ))

      await persistRevisions(nextRevisions)
    } catch (error) {
      console.error('Upload error:', error)
      await notifyError('Failed to upload file', error.message || '')
    } finally {
      setSaving(false)
      setUploadingIndex(null)
    }
  }

  const handleApprove = async (index) => {
    const nextRevisions = revisions.map((revision, revisionIndex) => (
      revisionIndex === index
        ? {
            ...revision,
            status: 'APPROVED',
            reviewed_at: new Date().toISOString()
          }
        : revision
    ))

    await persistRevisions(nextRevisions)
  }

  const handleRequestRevision = async (index) => {
    if (!nextTargetDate) {
      await notifyInfo('Please select a target date for the next revision')
      return
    }

    const nextRevisions = revisions.map((revision, revisionIndex) => (
      revisionIndex === index
        ? {
            ...revision,
            status: 'REVISION_REQUESTED',
            reviewed_at: new Date().toISOString()
          }
        : revision
    ))

    nextRevisions.push(createRevisionRow(revisions.length, nextTargetDate))
    setRevisionPromptIndex(null)
    setNextTargetDate('')
    await persistRevisions(nextRevisions)
  }

  return (
    <div className="modal modal-open">
      <div className="approval-modal-shell">
        <button
          type="button"
          className="modal-close-external modal-close-approval"
          onClick={onClose}
          disabled={saving}
          aria-label="Close modal"
        >
          <X size={30} />
        </button>

        <div className="modal-box approval-modal-box">
          <div className="approval-modal-head">
            <h3 className="approval-modal-title">{approvalType.name}</h3>

            <div className="approval-modal-summary">
              <div className="approval-summary-list">
                <div className="approval-summary-row">
                  <span className="approval-summary-label">Item</span>
                  <span className="approval-summary-value">{itemCode || '-'}</span>
                </div>
                <div className="approval-summary-row">
                  <span className="approval-summary-label">Stage</span>
                  <span className="approval-summary-value">{revisions.length}</span>
                </div>
              </div>

              <div className="approval-summary-list">
                <div className="approval-summary-row">
                  <span className="approval-summary-label">Last Status</span>
                  <span className="approval-summary-value">
                    {statusLabel(revisions[latestRevisionIndex]?.status || 'EMPTY')}
                  </span>
                </div>
                <div className="approval-summary-row">
                  <span className="approval-summary-label">Last Target</span>
                  <span className="approval-summary-value">
                    {formatDisplayDate(revisions[latestRevisionIndex]?.target_date)}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="table-scroll approval-modal-table">
            <table className="table table-sm">
              <thead>
                <tr>
                  <th>Stage</th>
                  <th>Target Date</th>
                  <th>Files</th>
                  <th>Uploaded</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {revisions.map((revision, index) => {
                  const fileCount = revision.files?.length || 0
                  const canReview = fileCount > 0 && index === latestRevisionIndex
                  const waitingUpload = fileCount === 0
                  const showRevisionPrompt = revisionPromptIndex === index
                  const showReviewActions = !waitingUpload

                  return (
                    <tr key={`${approvalType.key}-${revision.label}`}>
                      <td>{revision.label}</td>
                      <td>{formatDisplayDate(revision.target_date)}</td>
                      <td>
                        {fileCount > 0 ? (
                          <div className="approval-file-list">
                            {revision.files.map((file) => (
                              <button
                                key={`${revision.label}-${file.name}-${file.url}`}
                                type="button"
                                className="approval-file-link approval-file-button"
                                onClick={() => {
                                  const meta = getFileMeta(file.name)
                                  setPreviewFile({ ...file, ...meta })
                                }}
                              >
                                {file.name}
                              </button>
                            ))}
                          </div>
                        ) : (
                          uploadingIndex === index && saving ? (
                            <div className="approval-upload-loading">
                              <span className="loading loading-spinner loading-sm" />
                              <span>Uploading...</span>
                            </div>
                          ) : (
                            <label className="btn btn-xs btn-outline approval-upload-button">
                              <Upload size={12} />
                              Upload
                              <input
                                type="file"
                                style={{ display: 'none' }}
                                onChange={(event) => handleFileUpload(index, event.target.files)}
                                disabled={saving}
                                multiple
                                accept=".skp,.pdf,.jpg,.jpeg,.png"
                              />
                            </label>
                          )
                        )}
                      </td>
                      <td>{formatDisplayDate(revision.uploaded_at)}</td>
                      <td>
                        <span className={`badge ${revision.status === 'APPROVED' ? 'low' : revision.status === 'REVISION_REQUESTED' ? 'high' : 'medium'}`}>
                          {statusLabel(revision.status)}
                        </span>
                      </td>
                      <td>
                        {showReviewActions && (
                          <div className="approval-row-actions">
                            <button
                              type="button"
                              className="btn btn-xs btn-success"
                              onClick={() => handleApprove(index)}
                              disabled={!canReview || saving || revision.status === 'APPROVED'}
                            >
                              Approve
                            </button>
                            <button
                              type="button"
                              className="btn btn-xs btn-outline"
                              onClick={() => {
                                setRevisionPromptIndex(index)
                                setNextTargetDate('')
                              }}
                              disabled={!canReview || saving || revision.status === 'APPROVED'}
                            >
                              Revisi
                            </button>
                          </div>
                        )}

                        {showRevisionPrompt && (
                          <div className="approval-revision-prompt">
                            <input
                              type="date"
                              className="input input-sm"
                              value={nextTargetDate}
                              onChange={(event) => setNextTargetDate(event.target.value)}
                              min={new Date().toISOString().slice(0, 10)}
                            />
                            <button
                              type="button"
                              className="btn btn-xs btn-primary"
                              onClick={() => handleRequestRevision(index)}
                              disabled={saving}
                            >
                              Save Rev
                            </button>
                          </div>
                        )}

                        {waitingUpload && index === latestRevisionIndex && revision.label !== 'Submitted' && (
                          <div className="approval-row-note">
                            Menunggu file revisi sesuai target date.
                          </div>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {previewFile && (
        <div className="modal modal-open approval-preview-modal">
          <button
            type="button"
            className="modal-close-external modal-close-file-preview"
            onClick={() => setPreviewFile(null)}
            aria-label="Close preview"
          >
            <X size={30} />
          </button>
          <div className="modal-box approval-preview-box">
            <div className="approval-preview-head">
              <h3 className="approval-preview-title">{previewFile.name}</h3>
              <p className="approval-preview-subtitle">
                {previewFile.kind === 'image'
                  ? 'Image preview'
                  : previewFile.kind === 'pdf'
                    ? 'PDF preview'
                    : previewFile.kind === 'document'
                      ? 'DOCX preview'
                      : previewFile.kind === 'spreadsheet'
                        ? 'XLSX preview'
                        : previewFile.kind === 'model3d'
                          ? '3D preview'
                        : 'Preview not available'}
              </p>
            </div>

            <div className="approval-preview-stage">
              {previewFile.previewable ? (
                <>
                  {previewLoading && (
                    <div className="preview-loading">
                      <span className="loading loading-spinner loading-lg" />
                      <span className="preview-loading-text">Loading preview...</span>
                    </div>
                  )}
                  {previewError ? (
                    <div className="preview-fallback">
                      <p className="preview-fallback-title">Preview failed</p>
                      <a
                        href={previewFile.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn btn-outline"
                      >
                        Open File
                      </a>
                    </div>
                  ) : previewFile.kind === 'image' ? (
                    <img
                      src={previewFile.url}
                      alt={previewFile.name}
                      onLoad={() => setPreviewLoading(false)}
                      onError={() => {
                        setPreviewLoading(false)
                        setPreviewError(true)
                      }}
                      className="approval-preview-media"
                      style={{ opacity: previewLoading ? 0 : 1 }}
                    />
                  ) : previewFile.kind === 'document' ? (
                    <div
                      className="approval-doc-preview"
                      style={{ opacity: previewLoading ? 0 : 1 }}
                      dangerouslySetInnerHTML={{
                        __html: previewDocHtml || '<p class="approval-doc-empty">No document content.</p>'
                      }}
                    />
                  ) : previewFile.kind === 'spreadsheet' ? (
                    <div className="approval-sheet-preview" style={{ opacity: previewLoading ? 0 : 1 }}>
                      <div className="approval-sheet-title">
                        {previewSheetName || 'Sheet 1'}
                      </div>
                      <div className="approval-sheet-scroll">
                        <table className="approval-sheet-table">
                          <tbody>
                            {previewSheetRows.map((row, rowIndex) => (
                              <tr key={`sheet-row-${rowIndex}`}>
                                {row.map((cell, cellIndex) => (
                                  <td key={`sheet-cell-${rowIndex}-${cellIndex}`}>
                                    {cell === null || cell === undefined || cell === '' ? '-' : String(cell)}
                                  </td>
                                ))}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  ) : previewFile.kind === 'model3d' ? (
                    <ThreeModelPreview url={previewFile.url} name={previewFile.name} />
                  ) : (
                    <iframe
                      src={previewFile.url}
                      title={previewFile.name}
                      onLoad={() => setPreviewLoading(false)}
                      onError={() => {
                        setPreviewLoading(false)
                        setPreviewError(true)
                      }}
                      className="approval-preview-iframe"
                      style={{ opacity: previewLoading ? 0 : 1 }}
                    />
                  )}
                </>
              ) : (
                <div className="approval-preview-fallback-file">
                  <div className={`file-summary-icon ${previewFile.accent}`}>
                    {(() => {
                      const PreviewIcon = previewFile.icon
                      return <PreviewIcon size={34} strokeWidth={2} />
                    })()}
                  </div>
                  <p className="preview-fallback-title">Preview not available in browser</p>
                  <p className="approval-preview-note">
                    {previewFile.kind === 'document'
                      ? 'DOCX preview needs an extra library if you want it rendered in-app.'
                      : previewFile.kind === 'spreadsheet'
                        ? 'XLSX preview also needs an extra parser / renderer.'
                        : previewFile.kind === 'model'
                          ? 'DWG/SKP perlu dikonversi backend menjadi GLB sebelum bisa dipreview dengan Three.js.'
                        : 'Use download to open this file locally.'}
                  </p>
                </div>
              )}
            </div>

            <div className="modal-action approval-preview-actions">
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => setPreviewFile(null)}
              >
                Close
              </button>
              <a
                href={previewFile.url}
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-outline"
                download={previewFile.name}
              >
                <Download size={14} />
                Download
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
