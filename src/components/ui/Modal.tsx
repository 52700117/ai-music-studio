/**
 * 通用弹窗组件
 */
import { type ReactNode, useEffect } from 'react'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'

interface ModalProps {
  open: boolean
  onClose?: () => void
  children: ReactNode
  size?: 'sm' | 'md' | 'lg' | 'full'
  closeOnBackdrop?: boolean
  hideClose?: boolean
  className?: string
}

const sizeMap = {
  sm: 'max-w-md',
  md: 'max-w-lg',
  lg: 'max-w-2xl',
  full: 'max-w-5xl',
}

export default function Modal({
  open,
  onClose,
  children,
  size = 'md',
  closeOnBackdrop = true,
  hideClose = false,
  className,
}: ModalProps) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && onClose) onClose()
    }
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [open, onClose])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
    >
      <div
        className="absolute inset-0 bg-ink/40 backdrop-blur-sm animate-fade-in"
        onClick={() => closeOnBackdrop && onClose?.()}
      />
      <div
        className={cn(
          'relative w-full bg-paper rounded-4xl shadow-lift animate-pop-in max-h-[88vh] overflow-hidden flex flex-col',
          sizeMap[size],
          className,
        )}
      >
        {!hideClose && onClose && (
          <button
            onClick={onClose}
            aria-label="关闭"
            className="absolute right-5 top-5 z-10 w-9 h-9 rounded-full flex items-center justify-center text-muted hover:bg-cream hover:text-ink transition-colors"
          >
            <X size={18} />
          </button>
        )}
        {children}
      </div>
    </div>
  )
}
