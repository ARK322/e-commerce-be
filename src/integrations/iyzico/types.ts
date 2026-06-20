export type InitializeCheckoutBuyer = {
  email: string;
  firstName: string;
  lastName: string;
  phone: string;
  nationalId: string;
  country: string;
  city: string;
  address: string;
  createdAt: Date;
};

export type InitializeCheckoutItem = {
  productId: string;
  name: string;
  price: number;
  quantity: number;
  subtotal: number;
  subMerchantKey: string;
  subMerchantPrice: number;
};

export type InitializeCheckoutInput = {
  orderId: string;
  buyerId: string;
  amount: number;
  currency: string;
  clientIp: string;
  buyer: InitializeCheckoutBuyer;
  items: InitializeCheckoutItem[];
};

export type InitializeCheckoutResult = {
  token: string;
  paymentPageUrl: string | null;
  checkoutFormContent: string | null;
};

export type CompleteCheckoutResult =
  | {
      status: 'completed';
      externalId: string;
      orderId: string;
      paidAmount: number;
      itemTransactions: Array<{
        itemId: string;
        paymentTransactionId: string;
      }>;
    }
  | {
      status: 'failed';
      orderId: string;
      reason: string;
    };

export type IyzicoItemTransaction = {
  itemId: string;
  paymentTransactionId: string;
};
