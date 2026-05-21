import Swal from 'sweetalert2'

const baseOptions = {
  customClass: {
    popup: 'app-swal-popup',
    title: 'app-swal-title',
    confirmButton: 'app-swal-confirm',
    cancelButton: 'app-swal-cancel'
  },
  buttonsStyling: false,
  reverseButtons: true
}

export const notifySuccess = (title, text = '') => (
  Swal.fire({
    ...baseOptions,
    icon: 'success',
    title,
    text,
    confirmButtonText: 'OK'
  })
)

export const notifyError = (title, text = '') => (
  Swal.fire({
    ...baseOptions,
    icon: 'error',
    title,
    text,
    confirmButtonText: 'OK'
  })
)

export const notifyInfo = (title, text = '') => (
  Swal.fire({
    ...baseOptions,
    icon: 'info',
    title,
    text,
    confirmButtonText: 'OK'
  })
)

export const notifyConfirm = async ({
  title,
  text = '',
  confirmText = 'Yes',
  cancelText = 'Cancel',
  icon = 'warning'
}) => {
  const result = await Swal.fire({
    ...baseOptions,
    icon,
    title,
    text,
    showCancelButton: true,
    confirmButtonText: confirmText,
    cancelButtonText: cancelText
  })

  return result.isConfirmed
}
