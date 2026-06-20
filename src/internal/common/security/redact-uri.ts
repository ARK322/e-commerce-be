/** Loglarda MongoDB URI içindeki kimlik bilgilerini maskele. */
export const redactMongoUri = (uri: string): string =>
  uri.replace(/\/\/([^@/]+)@/, '//***@');
