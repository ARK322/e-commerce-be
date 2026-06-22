import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { env } from '@/config/env';
import { HttpError } from '@/shared/errors';
import { logger } from '@/shared/logging';

type SupabaseConfig = {
  url: string;
  serviceRoleKey: string;
  bucket: string;
};

let client: SupabaseClient | null = null;

export const getSupabaseConfig = (): SupabaseConfig => {
  const url = env.supabaseUrl;
  const serviceRoleKey = env.supabaseServiceRoleKey;
  const bucket = env.supabaseStorageBucket;

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

export const parseStorageObjectPathFromPublicUrl = (publicUrl: string, bucket: string) => {
  const marker = `/storage/v1/object/public/${bucket}/`;
  const index = publicUrl.indexOf(marker);

  if (index === -1) {
    return null;
  }

  return decodeURIComponent(publicUrl.slice(index + marker.length));
};

export const deleteFromSellerStorage = async (objectPath: string) => {
  const { bucket } = getSupabaseConfig();
  const supabase = getSupabaseClient();

  const { error } = await supabase.storage.from(bucket).remove([objectPath]);

  if (error) {
    logger.warn(
      { bucket, objectPath, supabaseError: error.message },
      'Supabase depolama silme hatası'
    );
  }
};

export const uploadToSellerStorage = async (
  objectPath: string,
  buffer: Buffer,
  contentType: string
) => {
  const { bucket } = getSupabaseConfig();
  const supabase = getSupabaseClient();

  const { error } = await supabase.storage.from(bucket).upload(objectPath, buffer, {
    contentType,
    upsert: true,
  });

  if (error) {
    logger.error(
      { bucket, objectPath, supabaseError: error.message },
      'Supabase depolama yükleme hatası'
    );
    throw new HttpError(503, 'Dosya yüklenemedi, lütfen tekrar deneyin');
  }

  const { data } = supabase.storage.from(bucket).getPublicUrl(objectPath);

  if (!data.publicUrl) {
    throw new HttpError(503, 'Dosya URL oluşturulamadı');
  }

  return data.publicUrl;
};
