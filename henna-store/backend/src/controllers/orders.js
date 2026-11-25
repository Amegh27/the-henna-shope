import mongoose from 'mongoose';
import Product from '../models/Product.js';
import Order from '../models/Order.js';

export async function create(req, res) {
  try {
    const { customer, items } = req.body;

    if (
      !customer?.name ||
      !customer?.phone ||
      !customer?.address
    ) {
      return res.status(400).json({
        message: 'Name, phone and delivery address are required.'
      });
    }

    if (!Array.isArray(items) || !items.length) {
      return res.status(400).json({
        message: 'Your cart is empty.'
      });
    }

    const normalized = [];

    for (const item of items) {
      if (
        !mongoose.isValidObjectId(item.productId) ||
        !Number.isInteger(Number(item.quantity)) ||
        Number(item.quantity) < 1
      ) {
        return res.status(400).json({
          message: 'Invalid cart item.'
        });
      }

      const p = await Product.findOne({
        _id: item.productId,
        isActive: true
      });

      if (!p) {
        return res.status(400).json({
          message: 'A product is unavailable. Refresh your cart.'
        });
      }

      const quantity = Number(item.quantity);

      const originalTotal = p.price * quantity;

      // APPLY BULK DISCOUNT
      let bulkDiscount = 0;

      if (
        p.bulkDiscountEnabled &&
        quantity >= p.bulkMinimumQuantity
      ) {
        bulkDiscount = Math.min(
          p.bulkDiscountAmount,
          originalTotal
        );
      }

      const finalTotal = originalTotal - bulkDiscount;

      normalized.push({
        product: p._id,
        name: p.name,
        price: p.price,
        quantity,
        image: p.image,

        selectedSize: item.selectedSize || '',

        originalTotal,
        bulkDiscount,
        finalTotal
      });
    }

    // ORDER TOTALS
    const subtotal = normalized.reduce(
      (sum, item) => sum + item.originalTotal,
      0
    );

    const discountTotal = normalized.reduce(
      (sum, item) => sum + item.bulkDiscount,
      0
    );

    const total = subtotal - discountTotal;

    const orderNumber = `HN${Date.now().toString().slice(-8)}`;

    // SAVE THE NORMALIZED ITEMS
    const order = await Order.create({
      orderNumber,

      customer: {
        name: String(customer.name).trim(),
        phone: String(customer.phone).trim(),
        address: String(customer.address).trim()
      },

      items: normalized,

      subtotal,
      discountTotal,
      total
    });

    // WHATSAPP MESSAGE
    const phone = process.env.WHATSAPP_NUMBER || '';

    const itemText = normalized.map(item => {
      let text =
        `- ${item.name}` +
        (item.selectedSize ? ` (${item.selectedSize})` : '') +
        ` x ${item.quantity}\n` +
        `  Price: Rs. ${item.price}\n` +
        `  Original amount: Rs. ${item.originalTotal}`;

      if (item.bulkDiscount > 0) {
        text += `\n  Bulk discount: -Rs. ${item.bulkDiscount}`;
      }

      text += `\n  Final amount: Rs. ${item.finalTotal}`;

      return text;
    }).join('\n\n');

    const message = [
      `Hello! I would like to place order ${orderNumber}.`,
      `Customer: ${order.customer.name}`,
      `Phone: ${order.customer.phone}`,
      `Address: ${order.customer.address}`,
      '',
      'Items:',
      itemText,
      '',
      `Subtotal: Rs. ${subtotal}`,
      `Bulk discount: Rs. ${discountTotal}`,
      `Final total: Rs. ${total}`,
      '',
      'Please confirm availability and delivery.'
    ].join('\n');

    const whatsappUrl = phone
      ? `https://wa.me/${phone}?text=${encodeURIComponent(message)}`
      : null;

    return res.status(201).json({
      message: 'Order saved. Continue to WhatsApp.',
      order,
      whatsappUrl
    });

  } catch (error) {
    console.error('ORDER CREATION ERROR:', error);

    return res.status(500).json({
      message: 'Failed to create order.',
      error: error.message
    });
  }
}

export async function list(req, res) {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);

    const limit = Math.min(
      100,
      Math.max(1, Number(req.query.limit) || 20)
    );

    const [orders, total] = await Promise.all([
      Order.find()
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit),

      Order.countDocuments()
    ]);

    res.json({
      orders,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });

  } catch (error) {
    console.error('ORDER LIST ERROR:', error);

    res.status(500).json({
      message: 'Failed to fetch orders.',
      error: error.message
    });
  }
}

export async function setStatus(req, res) {
  try {
    const statuses = [
      'pending',
      'confirmed',
      'processing',
      'shipped',
      'delivered',
      'cancelled'
    ];

    if (!statuses.includes(req.body.status)) {
      return res.status(400).json({
        message: 'Invalid order status.'
      });
    }

    const order = await Order.findByIdAndUpdate(
      req.params.id,
      { status: req.body.status },
      {
        new: true,
        runValidators: true
      }
    );

    if (!order) {
      return res.status(404).json({
        message: 'Order not found.'
      });
    }

    res.json({ order });

  } catch (error) {
    console.error('ORDER STATUS ERROR:', error);

    res.status(500).json({
      message: 'Failed to update order status.',
      error: error.message
    });
  }
}