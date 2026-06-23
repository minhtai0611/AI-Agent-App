import { Toaster as Sonner } from 'sonner'

export function Toaster(props) {
  return (
    <Sonner
      theme="dark"
      richColors
      position="bottom-right"
      gap={8}
      toastOptions={{
        style: {
          background: 'var(--surface-elevated, #161C2E)',
          border: '1px solid var(--border)',
          fontFamily: "'Sora', sans-serif",
          fontSize: '13px',
          color: 'var(--foreground)',
          borderRadius: '12px',
        },
      }}
      {...props}
    />
  )
}
