import { Buyer, Cart, Order, Product, type OrderStatus } from '@/integrations/mongo';
import { createUserId } from '@/internal/ids';
import { EcommerceError } from '@/internal/ecommerce/errors';
import { clearCart } from '@/features/ecommerce/cart/cart.service';
import { assertCartItemQuantity } from '@/internal/ecommerce/product/product-order-quantity';
import { approvePaymentSplitsForOrder } from '@/internal/ecommerce/payment/payment-split';
import type { UpdateOrderStatusInput } from '@/features/ecommerce/order/update-order-status.schema';

type OrderItemRecord = {
  productId: string;
  sellerId: string;
  name: string;
  price: number;
  quantity: number;
  subtotal: number;
};

type ShippingAddressRecord = {
  firstName: string;
  lastName: string;
  phone: string;
  country: string;
  city: string;
  address: string;
};

type OrderRecord = {
  _id: unknown;
  buyerId: string;
  items: OrderItemRecord[];
  totalAmount: number;
  currency: string;
  status: OrderStatus;
  shippingAddress: ShippingAddressRecord;
  createdAt?: Date;
  updatedAt?: Date;
};

const toOrderResponse = (order: OrderRecord) => ({
  id: String(order._id),
  buyerId: order.buyerId,
  items: order.items,
  totalAmount: order.totalAmount,
  currency: order.currency,
  status: order.status,
  shippingAddress: order.shippingAddress,
  createdAt: order.createdAt,
  updatedAt: order.updatedAt,
});

const buildShippingAddress = async (buyerId: string): Promise<ShippingAddressRecord> => {
  const buyer = await Buyer.findById(buyerId).lean();

  if (
    !buyer?.firstName ||
    !buyer.lastName ||
    !buyer.phone ||
    !buyer.country ||
    !buyer.city ||
    !buyer.deliveryAddress
  ) {
    throw new EcommerceError(400, 'Sipariş için teslimat profili eksik');
  }

  return {
    firstName: buyer.firstName,
    lastName: buyer.lastName,
    phone: buyer.phone,
    country: buyer.country,
    city: buyer.city,
    address: buyer.deliveryAddress,
  };
};

export const getBuyerOrder = async (buyerId: string, orderId: string) => {
  const order = await Order.findOne({ _id: orderId, buyerId }).lean();

  if (!order) {
    throw new EcommerceError(404, 'Sipariş bulunamadı');
  }

  return order;
};

const getSellerOrder = async (sellerId: string, orderId: string) => {
  const order = await Order.findOne({
    _id: orderId,
    'items.sellerId': sellerId,
  }).lean();

  if (!order) {
    throw new EcommerceError(404, 'Sipariş bulunamadı');
  }

  return order;
};

const assertSellerStatusTransition = (currentStatus: OrderStatus, nextStatus: OrderStatus) => {
  if (nextStatus === 'shipped' && currentStatus !== 'paid') {
    throw new EcommerceError(400, 'Sipariş yalnızca paid durumundayken shipped yapılabilir');
  }

  if (nextStatus === 'delivered' && currentStatus !== 'shipped') {
    throw new EcommerceError(400, 'Sipariş yalnızca shipped durumundayken delivered yapılabilir');
  }
};

const rollbackStock = async (decrements: Array<{ productId: string; quantity: number }>) => {
  await Promise.all(
    decrements.map(({ productId, quantity }) =>
      Product.findByIdAndUpdate(productId, { $inc: { stock: quantity } })
    )
  );
};

export const createOrderFromCart = async (buyerId: string) => {
  const cart = await Cart.findById(buyerId);

  if (!cart || cart.items.length === 0) {
    throw new EcommerceError(400, 'Sepet boş');
  }

  const shippingAddress = await buildShippingAddress(buyerId);
  const orderItems: OrderItemRecord[] = [];
  const decrements: Array<{ productId: string; quantity: number }> = [];

  try {
    for (const item of cart.items) {
      const product = await Product.findOne({
        _id: item.productId,
        isActive: true,
      }).lean();

      if (!product) {
        throw new EcommerceError(400, 'Sepette geçersiz ürün var');
      }

      assertCartItemQuantity(item.quantity, product);

      const updatedProduct = await Product.findOneAndUpdate(
        {
          _id: item.productId,
          stock: { $gte: item.quantity },
          isActive: true,
        },
        {
          $inc: { stock: -item.quantity },
          $set: { updatedAt: new Date() },
        }
      );

      if (!updatedProduct) {
        throw new EcommerceError(400, 'Yetersiz stok');
      }

      decrements.push({ productId: item.productId, quantity: item.quantity });

      const price = product.price;

      orderItems.push({
        productId: item.productId,
        sellerId: product.sellerId,
        name: product.name,
        price,
        quantity: item.quantity,
        subtotal: price * item.quantity,
      });
    }

    const totalAmount = orderItems.reduce((sum, item) => sum + item.subtotal, 0);

    const order = await Order.create({
      _id: createUserId(),
      buyerId,
      items: orderItems,
      totalAmount,
      currency: 'TRY',
      status: 'pending',
      shippingAddress,
    });

    await clearCart(buyerId);

    return toOrderResponse(order.toObject() as OrderRecord);
  } catch (error) {
    if (decrements.length > 0) {
      await rollbackStock(decrements);
    }

    throw error;
  }
};

export const listBuyerOrders = async (buyerId: string) => {
  const orders = await Order.find({ buyerId }).sort({ createdAt: -1 }).lean();

  return orders.map((order) => toOrderResponse(order as OrderRecord));
};

export const getBuyerOrderById = async (buyerId: string, orderId: string) => {
  const order = await getBuyerOrder(buyerId, orderId);

  return toOrderResponse(order as OrderRecord);
};

export const listSellerOrders = async (sellerId: string) => {
  const orders = await Order.find({ 'items.sellerId': sellerId })
    .sort({ createdAt: -1 })
    .lean();

  return orders.map((order) => ({
    ...toOrderResponse(order as OrderRecord),
    items: order.items.filter((item) => item.sellerId === sellerId),
  }));
};

export const getSellerOrderById = async (sellerId: string, orderId: string) => {
  const order = await getSellerOrder(sellerId, orderId);

  return {
    ...toOrderResponse(order as OrderRecord),
    items: order.items.filter((item) => item.sellerId === sellerId),
  };
};

export const updateOrderStatus = async (
  sellerId: string,
  orderId: string,
  input: UpdateOrderStatusInput
) => {
  const order = await Order.findOne({
    _id: orderId,
    'items.sellerId': sellerId,
  });

  if (!order) {
    throw new EcommerceError(404, 'Sipariş bulunamadı');
  }

  assertSellerStatusTransition(order.status, input.status);

  order.status = input.status;
  order.updatedAt = new Date();
  await order.save();

  if (input.status === 'delivered') {
    await approvePaymentSplitsForOrder(orderId);
  }

  return toOrderResponse(order.toObject() as OrderRecord);
};
