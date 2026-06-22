/** MongoDB $regex için kullanıcı girdisindeki özel karakterleri kaçırır. */
export const escapeRegex = (value: string): string =>
  value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
