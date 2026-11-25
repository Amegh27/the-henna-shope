import Product from '../models/Product.js';

export async function list(req, res) {
  const products = await Product.find(
    req.admin ? {} : { isActive: true }
  ).sort({ createdAt: -1 });

  res.json({ products });
}

export async function getOne(req, res) {
  const product = await Product.findOne({
    _id: req.params.id,
    isActive: true
  });

  if (!product) {
    return res.status(404).json({
      message: 'Product not found.'
    });
  }

  res.json({ product });
}

export async function create(req, res) {
  const product = await Product.create({
    name: req.body.name,
    category: req.body.category,
    price: req.body.price,
    oldPrice: req.body.oldPrice,
    tag: req.body.tag,
    description: req.body.description ?? req.body.desc,
    image: req.body.image,
    isActive: req.body.isActive ?? true,
    stock: req.body.stock ?? 0,

    sizes: req.body.sizes ?? [],

    bulkDiscountEnabled: req.body.bulkDiscountEnabled ?? false,
    bulkMinimumQuantity: req.body.bulkMinimumQuantity ?? 5,
    bulkDiscountAmount: req.body.bulkDiscountAmount ?? 0
  });

  res.status(201).json({ product });
}

export async function update(req, res) {
  const allowed = [
    'name',
    'category',
    'price',
    'oldPrice',
    'tag',
    'description',
    'desc',
    'image',
    'isActive',
    'stock',
    'sizes',
    'bulkDiscountEnabled',
    'bulkMinimumQuantity',
    'bulkDiscountAmount'
  ];

  const data = Object.fromEntries(
    Object.entries(req.body).filter(([key]) =>
      allowed.includes(key)
    )
  );

  if (data.desc !== undefined && data.description === undefined) {
    data.description = data.desc;
  }

  delete data.desc;

  const product = await Product.findByIdAndUpdate(
    req.params.id,
    data,
    {
      new: true,
      runValidators: true
    }
  );

  if (!product) {
    return res.status(404).json({
      message: 'Product not found.'
    });
  }

  res.json({ product });
}

export async function remove(req, res) {
  const product = await Product.findByIdAndDelete(req.params.id);

  if (!product) {
    return res.status(404).json({
      message: 'Product not found.'
    });
  }

  res.json({
    message: 'Product deleted.'
  });
}