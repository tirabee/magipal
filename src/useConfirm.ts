import { useState } from 'react'

interface ConfirmOptions {
  message: string
  confirmLabel?: string
  danger?: boolean
}

export function useConfirm() {
  const [pending, setPending] = useState<{
    options: ConfirmOptions
    resolve: (confirmed: boolean) => void
  } | null>(null)

  const confirm = (options: ConfirmOptions): Promise<boolean> => {
    return new Promise(resolve => {
      setPending({ options, resolve })
    })
  }

  const handleConfirm = () => {
    pending?.resolve(true)
    setPending(null)
  }

  const handleCancel = () => {
    pending?.resolve(false)
    setPending(null)
  }

  return { confirm, pending, handleConfirm, handleCancel }
}