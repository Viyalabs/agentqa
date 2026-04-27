import { createClient, type SupabaseClient } from '@supabase/supabase-js'

function getEnv(key: string): string {
  const val = process.env[key]
  if (!val) throw new Error(`Missing environment variable: ${key}`)
  return val
}

function makeLazySingleton(factory: () => SupabaseClient): () => SupabaseClient {
  let instance: SupabaseClient | null = null
  return () => {
    if (!instance) instance = factory()
    return instance
  }
}

export const getSupabaseClient = makeLazySingleton(() =>
  createClient(
    getEnv('NEXT_PUBLIC_SUPABASE_URL'),
    getEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY')
  )
)

export const getAdminClient = makeLazySingleton(() =>
  createClient(
    getEnv('NEXT_PUBLIC_SUPABASE_URL'),
    getEnv('SUPABASE_SERVICE_ROLE_KEY'),
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
)

async function uploadToStorage(
  path: string,
  buffer: Buffer,
  contentType: string
): Promise<string | null> {
  const admin = getAdminClient()
  const { error } = await admin.storage
    .from('screenshots')
    .upload(path, buffer, { contentType, upsert: true })
  if (error) {
    console.error('Storage upload error:', error.message)
    return null
  }
  const { data } = admin.storage.from('screenshots').getPublicUrl(path)
  return data.publicUrl
}

export async function uploadScreenshot(
  scanId: string,
  pageId: string,
  buffer: Buffer
): Promise<string | null> {
  return uploadToStorage(`${scanId}/${pageId}.png`, buffer, 'image/png')
}

export async function uploadMobileScreenshot(
  scanId: string,
  pageId: string,
  buffer: Buffer
): Promise<string | null> {
  return uploadToStorage(`${scanId}/${pageId}-mobile.png`, buffer, 'image/png')
}

export async function uploadVideo(
  scanId: string,
  pageId: string,
  buffer: Buffer
): Promise<string | null> {
  return uploadToStorage(`videos/${scanId}/${pageId}.webm`, buffer, 'video/webm')
}
