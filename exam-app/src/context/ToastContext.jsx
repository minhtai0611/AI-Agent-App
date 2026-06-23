import { toast } from 'sonner'

// ToastProvider is kept as a passthrough for backward compatibility.
// The actual toast renderer (<Toaster />) is mounted in App.jsx.
export function ToastProvider({ children }) {
  return children
}

// Returns sonner's toast object directly.
// API: toast.success(msg), toast.error(msg), toast.info(msg), toast.dismiss(id)
export function useToast() {
  return toast
}
