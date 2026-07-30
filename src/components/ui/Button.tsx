/**
 * 按钮组件：primary / outline / ghost / danger / wechat
 */
import { type ButtonHTMLAttributes, forwardRef } from 'react'
import { Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

type Variant = 'primary' | 'outline' | 'ghost' | 'danger' | 'wechat' | 'dark'
type Size = 'sm' | 'md' | 'lg'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
  block?: boolean
  loading?: boolean
}

const variantMap: Record<Variant, string> = {
  primary:
    'bg-coral text-white hover:bg-coral-600 shadow-coral active:scale-[0.98]',
  outline:
    'bg-paper border border-ink/15 text-ink hover:border-ink/40 hover:bg-cream',
  ghost: 'bg-transparent text-ink hover:bg-cream',
  danger:
    'bg-danger text-white hover:bg-red-700 shadow-[0_8px_24px_-8px_rgba(225,29,42,0.5)] active:scale-[0.98]',
  wechat: 'bg-wechat text-white hover:bg-[#06ad56] active:scale-[0.98]',
  dark: 'bg-ink text-paper hover:bg-black active:scale-[0.98]',
}

const sizeMap: Record<Size, string> = {
  sm: 'h-9 px-4 text-sm',
  md: 'h-11 px-6 text-sm',
  lg: 'h-14 px-8 text-base',
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'primary', size = 'md', block, loading, disabled, className, children, ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-full font-semibold tracking-tight transition-all duration-200 disabled:opacity-40 disabled:pointer-events-none whitespace-nowrap',
        variantMap[variant],
        sizeMap[size],
        block && 'w-full',
        className,
      )}
      {...props}
    >
      {loading && <Loader2 size={16} className="animate-spin" />}
      {children}
    </button>
  )
})

export default Button
