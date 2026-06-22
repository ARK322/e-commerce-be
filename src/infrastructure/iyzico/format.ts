export const formatIyzicoPrice = (amount: number): string => amount.toFixed(2);

export const formatIyzicoPhone = (phone: string): string => {
  const digits = phone.replace(/\D/g, '');

  if (digits.startsWith('90') && digits.length === 12) {
    return `+${digits}`;
  }

  if (digits.startsWith('0') && digits.length === 11) {
    return `+9${digits}`;
  }

  if (digits.length === 10) {
    return `+90${digits}`;
  }

  return phone.startsWith('+') ? phone : `+${digits}`;
};

export const formatIyzicoDate = (date: Date): string => {
  const pad = (value: number) => String(value).padStart(2, '0');

  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
};
