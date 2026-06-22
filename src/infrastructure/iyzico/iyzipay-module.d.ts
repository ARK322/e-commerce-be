declare module 'iyzipay' {
  type IyzipayCallback<T> = (err: unknown, result: T) => void;

  type IyzipayApiResult = {
    status: string;
    errorCode?: string;
    errorMessage?: string;
    token?: string;
    paymentPageUrl?: string;
    checkoutFormContent?: string;
    subMerchantKey?: string;
    paymentId?: string;
    basketId?: string;
    conversationId?: string;
    paymentStatus?: string;
    paidPrice?: string;
    itemTransactions?: Array<{
      itemId?: string;
      paymentTransactionId?: string;
      transactionStatus?: number;
      price?: number;
      paidPrice?: number;
      merchantPayoutAmount?: number;
      subMerchantPrice?: number;
      subMerchantPayoutRate?: number;
      subMerchantPayoutAmount?: number;
    }>;
  };

  type IyzipayResourceApi = {
    create?: (
      request: Record<string, unknown>,
      callback: IyzipayCallback<IyzipayApiResult>
    ) => void;
    retrieve?: (
      request: Record<string, unknown>,
      callback: IyzipayCallback<IyzipayApiResult>
    ) => void;
    update?: (
      request: Record<string, unknown>,
      callback: IyzipayCallback<IyzipayApiResult>
    ) => void;
  };

  type IyzipayClient = {
    checkoutFormInitialize: {
      create: (
        request: Record<string, unknown>,
        callback: IyzipayCallback<IyzipayApiResult>
      ) => void;
    };
    checkoutForm: {
      retrieve: (
        request: Record<string, unknown>,
        callback: IyzipayCallback<IyzipayApiResult>
      ) => void;
    };
    subMerchant: IyzipayResourceApi;
    approval: IyzipayResourceApi;
    payment: IyzipayResourceApi;
  };

  type IyzipayConfig = {
    apiKey: string;
    secretKey: string;
    uri: string;
  };

  const Iyzipay: {
    new (config: IyzipayConfig): IyzipayClient;
    LOCALE: { TR: string; EN: string };
    CURRENCY: { TRY: string };
    PAYMENT_GROUP: { PRODUCT: string; LISTING: string; SUBSCRIPTION: string };
    BASKET_ITEM_TYPE: { PHYSICAL: string; VIRTUAL: string };
    SUB_MERCHANT_TYPE: {
      PERSONAL: string;
      PRIVATE_COMPANY: string;
      LIMITED_OR_JOINT_STOCK_COMPANY: string;
    };
  };

  export = Iyzipay;
}
