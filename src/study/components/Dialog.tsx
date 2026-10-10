import { useEffect, useRef, type ReactNode } from 'react'
import { useI18n } from '../i18n'
export function Dialog({
  title,
  onClose,
  children,
  className = '',
}: {
  title: string
  onClose: () => void
  children: ReactNode
  className?: string
}) {
  const { t } = useI18n()
  const ref = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null,
      dialog = ref.current!
    dialog.showModal()
    dialog.querySelector<HTMLElement>('[data-initial-focus]')?.focus()
    return () => {
      dialog.close()
      previous?.focus()
    }
  }, [])
  return (
    <dialog
      ref={ref}
      aria-label={title}
      className={'native-dialog ' + className}
      onKeyDown={(e) => {
        if (e.key !== 'Tab') return
        const controls = [
          ...ref.current!.querySelectorAll<HTMLElement>(
            'button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), a[href], [tabindex]:not([tabindex="-1"])',
          ),
        ].filter(
          (element) =>
            element.tabIndex >= 0 && element.getClientRects().length > 0,
        )
        const first = controls[0],
          last = controls[controls.length - 1]
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault()
          last?.focus()
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault()
          first?.focus()
        }
      }}
      onCancel={(e) => {
        e.preventDefault()
        onClose()
      }}
      onClick={(e) => {
        if (e.target === ref.current) onClose()
      }}
    >
      <div className="dialog-body">
        <div className="dialog-heading">
          <h2>{title}</h2>
          <button
            className="utility-button"
            onClick={onClose}
            aria-label={t('closeDialog')}
          >
            {t('close')}
          </button>
        </div>
        {children}
      </div>
    </dialog>
  )
}
