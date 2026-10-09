/**
 * SafarGo - Supabase Cloud Integration
 * Provides Cloud Storage for avatars, driver documents, and real-time database sync
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://dmjyooyanotmcbuwvdkm.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRtanlvb3lhbm90bWNidXd2ZGttIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc5MTU0MzQwMCwiZXhwIjoyMTA3MTE5NDAwfQ.eJHRdh5aTAvY5Qy1BMZ9naNo-6xRJNBpNjhK2Fa-bHo';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRtanlvb3lhbm90bWNidXd2ZGttIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTE1NDM0MDAsImV4cCI6MjEwNzExOTQwMH0.ZtKkUVDfe5Hpe0H_qnFP6sDelpmB8v5Io8TZrnuw2Qk';

export const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});

export const supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Storage Bucket Names
export const BUCKETS = {
  AVATARS: 'safargo-avatars',
  DOCUMENTS: 'safargo-documents',
};

/**
 * Automatically initializes required storage buckets on Supabase
 */
export async function initSupabaseStorage() {
  try {
    const { data: buckets, error } = await supabaseAdmin.storage.listBuckets();
    if (error) {
      console.warn('[Supabase Storage] List buckets notice:', error.message);
      return;
    }

    const existingNames = (buckets || []).map((b) => b.name);

    if (!existingNames.includes(BUCKETS.AVATARS)) {
      const { error: createErr } = await supabaseAdmin.storage.createBucket(BUCKETS.AVATARS, {
        public: true,
        fileSizeLimit: 5242880, // 5MB
        allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp'],
      });
      if (createErr) console.warn('[Supabase Storage] Create avatars bucket:', createErr.message);
      else console.log('[Supabase Storage] Created bucket:', BUCKETS.AVATARS);
    }

    if (!existingNames.includes(BUCKETS.DOCUMENTS)) {
      const { error: createErr } = await supabaseAdmin.storage.createBucket(BUCKETS.DOCUMENTS, {
        public: true,
        fileSizeLimit: 10485760, // 10MB
        allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'],
      });
      if (createErr) console.warn('[Supabase Storage] Create documents bucket:', createErr.message);
      else console.log('[Supabase Storage] Created bucket:', BUCKETS.DOCUMENTS);
    }
  } catch (err) {
    console.warn('[Supabase Storage] Init warning:', err.message);
  }
}

// Automatically initialize buckets on startup
initSupabaseStorage().catch(() => {});

/**
 * Upload a file to Supabase Storage and return public URL
 */
export async function uploadToSupabaseStorage(bucket, path, fileBuffer, contentType) {
  try {
    const { data, error } = await supabaseAdmin.storage
      .from(bucket)
      .upload(path, fileBuffer, {
        contentType,
        upsert: true,
      });

    if (error) throw error;

    const { data: urlData } = supabaseAdmin.storage.from(bucket).getPublicUrl(path);
    return urlData.publicUrl;
  } catch (err) {
    console.warn(`[Supabase Upload to ${bucket} failed]:`, err.message);
    return null;
  }
}

/**
 * Synchronize user to Supabase Database (if 'users' table exists)
 */
export async function syncUserToSupabase(user) {
  try {
    const safeUser = {
      id: user.id,
      email: user.email,
      phone: user.phone,
      full_name: user.fullName,
      username: user.username,
      avatar_url: user.avatarUrl,
      role: user.role,
      status: user.status,
      is_verified: user.isVerified,
      created_at: user.createdAt || new Date().toISOString(),
    };

    const { error } = await supabaseAdmin
      .from('users')
      .upsert(safeUser, { onConflict: 'email' });

    if (error && !error.message.includes('relation "public.users" does not exist')) {
      console.warn('[Supabase DB User Sync]:', error.message);
    }
  } catch {
    // Non-blocking sync
  }
}
