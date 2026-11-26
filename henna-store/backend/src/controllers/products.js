import Product from '../models/Product.js';

const ALLOWED_SIZE_UNITS = ['inch', 'g', 'S', 'M', 'L', 'ml', 'mm', 'pcs'];

// Validate and normalize each size. Every size must have its own price.
function prepareSizes(sizes) {
  if (!Array.isArray(sizes) || sizes.length === 0) {
    return {
      error: 'Add at least one product size with its price.'
    };
  }

  const preparedSizes = [];

  for (const size of sizes) {
    const quantity = Number(size.quantity);
    const price = Number(size.price);
    const unit = String(size.unit || '').trim();

    if (!Number.isFinite(quantity) || quantity <= 0) {
      return { error: 'Every product size must have a quantity greater than zero.' };
    }

    if (!ALLOWED_SIZE_UNITS.includes(unit)) {
      return { error: `Invalid size unit: ${unit || '(empty)'}.` };
    }

    if (!Number.isFinite(price) || price <= 0) {
      return { error: 'Every product size must have a price greater than zero.' };
    }

    preparedSizes.push({ quantity, unit, price });
  }

  // Prevent duplicate sizes such as 50 g being added twice.
  const sizeKeys = preparedSizes.map((size) => `${size.quantity} ${size.unit}`);
  if (new Set(sizeKeys).size !== sizeKeys.length) {
    return { error: 'A product cannot contain the same size more than once.' };
  }

  return { sizes: preparedSizes };
}

// Get all products. Admins can see inactive products; customers see active ones.
export async function list(req, res) {
  const products = await Product.find(
    req.admin ? {} : { isActive: true }
  ).sort({ createdAt: -1 });

  res.json({ products });
}

// Get one active product.
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

// Create a product. Its customer-facing prices are stored on each size.
export async function create(req, res) {
  const sizeResult = prepareSizes(req.body.sizes);

  if (sizeResult.error) {
    return res.status(400).json({ message: sizeResult.error });
  }

  // Keep the old top-level price field as an internal compatibility value.
  // It is automatically set to the cheapest size and is not entered by the admin.
  const lowestSizePrice = Math.min(
    ...sizeResult.sizes.map((size) => size.price)
  );

  const product = await Product.create({
    name: req.body.name,
    category: req.body.category,
    price: lowestSizePrice,
    oldPrice: req.body.oldPrice,
    tag: req.body.tag,
    description: req.body.description ?? req.body.desc,
    image: req.body.image,
    isActive: req.body.isActive ?? true,
    stock: req.body.stock ?? 0,
    sizes: sizeResult.sizes,
    bulkDiscountEnabled: req.body.bulkDiscountEnabled ?? false,
    bulkMinimumQuantity: req.body.bulkMinimumQuantity ?? 5,
    bulkDiscountAmount: req.body.bulkDiscountAmount ?? 0
  });

  res.status(201).json({ product });
}

// Update an existing product.
export async function update(req, res) {
  const allowed = [
    'name',
    'category',
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
    Object.entries(req.body).filter(([key]) => allowed.includes(key))
  );

  if (data.desc !== undefined && data.description === undefined) {
    data.description = data.desc;
  }
  delete data.desc;

  // When sizes are edited, validate their prices and update the compatibility
  // price automatically to the lowest available size price.
  if (Object.prototype.hasOwnProperty.call(data, 'sizes')) {
    const sizeResult = prepareSizes(data.sizes);

    if (sizeResult.error) {
      return res.status(400).json({ message: sizeResult.error });
    }

    data.sizes = sizeResult.sizes;
    data.price = Math.min(...sizeResult.sizes.map((size) => size.price));
  }

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

// Permanently delete a product.
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
