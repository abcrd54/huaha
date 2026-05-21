import axios from 'axios'

const cloudinaryUrl = import.meta.env.VITE_CLOUDINARY_URL
const cloudNameFromUrl = cloudinaryUrl?.match(/@([^/?]+)/)?.[1] || ''
const cloudName = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME || cloudNameFromUrl
const uploadPreset =
  import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET ||
  import.meta.env.VITE_CLOUDINARY_UNSIGNED_PRESET ||
  import.meta.env.VITE_CLOUDINARY_PRESET

const rawExtensions = new Set([
  'pdf',
  'doc',
  'docx',
  'xls',
  'xlsx',
  'csv',
  'dwg',
  'dxf',
  'skp',
  'dae',
  'obj',
  'fbx',
  '3ds'
])

const getExtension = (fileName = '') => fileName.split('.').pop()?.toLowerCase() || ''

const getResourceType = (file) => {
  const extension = getExtension(file?.name)
  const mimeType = file?.type || ''

  if (mimeType.startsWith('image/')) return 'image'
  if (mimeType.startsWith('video/')) return 'video'
  if (mimeType.startsWith('audio/')) return 'video'
  if (rawExtensions.has(extension)) return 'raw'

  return 'auto'
}

export const uploadToCloudinary = async (file) => {
  if (!cloudName) {
    throw new Error('Missing Cloudinary cloud name')
  }

  if (!uploadPreset) {
    throw new Error('Missing Cloudinary unsigned upload preset')
  }

  const resourceType = getResourceType(file)
  const formData = new FormData()
  formData.append('file', file)
  formData.append('upload_preset', uploadPreset)

  try {
    const response = await axios.post(
      `https://api.cloudinary.com/v1_1/${cloudName}/${resourceType}/upload`,
      formData
    )
    return response.data.secure_url
  } catch (error) {
    console.error('Cloudinary upload error:', error)
    const cloudinaryMessage = error.response?.data?.error?.message
    throw new Error(cloudinaryMessage || 'Cloudinary upload failed')
  }
}
