/**
 * SafarGo - Client-side Supabase Integration
 * Handles Realtime updates, Storage, and Supabase client-side API
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://dmjyooyanotmcbuwvdkm.supabase.co';
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRtanlvb3lhbm90bWNidXd2ZGttIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTE1NDM0MDAsImV4cCI6MjEwNzExOTQwMH0.ZtKkUVDfe5Hpe0H_qnFP6sDelpmB8v5Io8TZrnuw2Qk';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

/**
 * Upload an image or document directly to Supabase Storage from browser
 */
export async function uploadToSupabaseBucket(bucketName, path, file) {
  try {
    const { data, error } = await supabase.storage
      .from(bucketName)
      .upload(path, file, { upsert: true });

    if (error) throw error;

    const { data: publicData } = supabase.storage
      .from(bucketName)
      .getPublicUrl(path);

    return publicData.publicUrl;
  } catch (err) {
    console.warn(`[Supabase Upload ${bucketName} failed]:`, err.message);
    return null;
  }
}
