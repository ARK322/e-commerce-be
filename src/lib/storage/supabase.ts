import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { HttpError } from '../common/errors';
import { logger } from '../common/logger';

type SupabaseConfig = {
  url: string;
  serviceRoleKey: string;
  bucket: string;
};

let client: SupabaseClient | null = null;

export const getSupabaseConfig = (): SupabaseConfig => {
  const url = process.env.SUPABASE_URL?.trim();
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  const bucket = process.env.SUPABASE_STORAGE_BUCKET?.trim() || 'seller-documents';

  if (!url || !serviceRoleKey) {
    throw new HttpError(
      503,
      'Dosya yükleme servisi yapılandırılmamış (SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)'
    );
  }

  return { url, serviceRoleKey, bucket };
};

export const getSupabaseClient = (): SupabaseClient => {
  if (client) {
    return client;
  }

  const config = getSupabaseConfig();
  client = createClient(config.url, config.serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  return client;
};

export const uploadToSellerStorage = async (
  userId: string,
  objectPath: string,
  buffer: Buffer,
  contentType: string
) => {
  const { bucket } = getSupabaseConfig();
  const supabase = getSupabaseClient();

  const { error } = await supabase.storage.from(bucket).upload(objectPath, buffer, {
    contentType,
    upsert: false,
  });

  if (error) {
    logger.error(
      { bucket, objectPath, supabaseError: error.message },
      'Supabase storage upload failed'
    );
    throw new HttpError(503, 'Dosya yüklenemedi, lütfen tekrar deneyin');
  }

  const { data } = supabase.storage.from(bucket).getPublicUrl(objectPath);

  if (!data.publicUrl) {
    throw new HttpError(503, 'Dosya URL oluşturulamadı');
  }

  return data.publicUrl;
};
