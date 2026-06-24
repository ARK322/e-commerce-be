import { User, Buyer } from '@/infrastructure/mongo';

export const listBuyersLean = async (page: number, limit: number, search?: string) => {
  const buyerIds = await User.find({ role: 'buyer' }).select('_id email isActive isEmailVerified createdAt').lean();
  const idSet = new Set(buyerIds.map((u) => String(u._id)));

  let filteredIds = [...idSet];

  if (search) {
    const regex = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    const matchingUsers = buyerIds.filter((u) => regex.test(u.email));
    const matchingBuyers = await Buyer.find({
      _id: { $in: filteredIds },
      $or: [
        { firstName: regex },
        { lastName: regex },
        { phone: regex },
      ],
    })
      .select('_id')
      .lean();

    const matchIds = new Set([
      ...matchingUsers.map((u) => String(u._id)),
      ...matchingBuyers.map((b) => String(b._id)),
    ]);
    filteredIds = filteredIds.filter((id) => matchIds.has(id));
  }

  const total = filteredIds.length;
  const skip = (page - 1) * limit;
  const pageIds = filteredIds.slice(skip, skip + limit);

  const [users, buyers] = await Promise.all([
    User.find({ _id: { $in: pageIds } }).lean(),
    Buyer.find({ _id: { $in: pageIds } }).lean(),
  ]);

  const buyerMap = new Map(buyers.map((b) => [String(b._id), b]));
  const userMap = new Map(users.map((u) => [String(u._id), u]));

  const items = pageIds.map((id) => {
    const user = userMap.get(id);
    const buyer = buyerMap.get(id);

    return {
      userId: id,
      email: user?.email ?? null,
      isActive: user?.isActive ?? false,
      isEmailVerified: user?.isEmailVerified ?? false,
      firstName: buyer?.firstName ?? null,
      lastName: buyer?.lastName ?? null,
      phone: buyer?.phone ?? null,
      city: buyer?.city ?? null,
      createdAt: user?.createdAt ?? null,
    };
  });

  return { items, total, page, limit };
};

export const findBuyerDetailLean = async (buyerId: string) => {
  const [user, buyer] = await Promise.all([
    User.findById(buyerId).lean(),
    Buyer.findById(buyerId).lean(),
  ]);

  if (!user || user.role !== 'buyer' || !buyer) {
    return null;
  }

  return { user, buyer };
};
