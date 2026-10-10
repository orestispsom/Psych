// Reuse Psych's public browser connection. No PsychFlash project credentials.
export const cloudUrl = import.meta.env.VITE_SUPABASE_URL || ''
export const publishableKey = import.meta.env.VITE_SUPABASE_ANON_KEY || ''
export const cloudEnabled = Boolean(cloudUrl && publishableKey)
