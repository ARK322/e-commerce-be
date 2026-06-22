export const REGISTER_ACK_MESSAGE =
  'Kayıt talebiniz alındı. E-posta kutunuzu kontrol edin.';

export const buildRegisterAckResponse = () => ({
  message: REGISTER_ACK_MESSAGE,
});
