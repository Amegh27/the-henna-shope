import Category from '../models/Category.js';
import Product from '../models/Product.js';

// GET all categories
// Only return categories actually stored in MongoDB.
export async function list(req, res) {
  const categories = await Category.find()
    .sort({ createdAt: 1 });

  res.json({ categories });
}

// ADD category
export async function create(req, res) {
  const name = req.body.name?.trim();

  if (!name) {
    return res.status(400).json({
      message: 'Category name is required.'
    });
  }

  const escapedName = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  const existing = await Category.findOne({
    name: { $regex: `^${escapedName}$`, $options: 'i' }
  });

  if (existing) {
    return res.status(409).json({
      message: 'Category already exists.'
    });
  }

  const category = await Category.create({ name });

  res.status(201).json({ category });
}

// RENAME category
export async function rename(req, res) {
  const oldName = req.body.oldName?.trim();
  const newName = req.body.newName?.trim();

  if (!oldName || !newName) {
    return res.status(400).json({
      message: 'Both old and new category names are required.'
    });
  }

  const category = await Category.findOne({ name: oldName });

  if (!category) {
    return res.status(404).json({
      message: 'Category not found.'
    });
  }

  const escapedName = newName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  const duplicate = await Category.findOne({
    name: {
      $regex: `^${escapedName}$`,
      $options: 'i'
    },
    _id: { $ne: category._id }
  });

  if (duplicate) {
    return res.status(409).json({
      message: 'That category name already exists.'
    });
  }

  await Product.updateMany(
    { category: oldName },
    { $set: { category: newName } }
  );

  category.name = newName;
  await category.save();

  res.json({
    message: 'Category renamed successfully.',
    category
  });
}

// DELETE category
export async function remove(req, res) {
  const name = req.body.name?.trim();
  const replacementCategory = req.body.replacementCategory?.trim();

  if (!name) {
    return res.status(400).json({
      message: 'Category name is required.'
    });
  }

  if (replacementCategory === name) {
    return res.status(400).json({
      message: 'Choose a different replacement category.'
    });
  }

  const category = await Category.findOne({ name });

  if (!category) {
    return res.status(404).json({
      message: 'Category not found.'
    });
  }

  const productCount = await Product.countDocuments({
    category: name
  });

  if (productCount > 0 && !replacementCategory) {
    return res.status(400).json({
      message: 'Choose a replacement category for existing products.'
    });
  }

  if (productCount > 0) {
    const replacementExists = await Category.findOne({
      name: replacementCategory
    });

    if (!replacementExists) {
      return res.status(400).json({
        message: 'Replacement category does not exist.'
      });
    }

    await Product.updateMany(
      { category: name },
      { $set: { category: replacementCategory } }
    );
  }

  await Category.deleteOne({ _id: category._id });

  res.json({
    message: 'Category deleted successfully.'
  });
}

// Legacy sync endpoint
// Does not recreate categories from old browser storage.
export async function sync(req, res) {
  res.json({
    message: 'Automatic category syncing is disabled.'
  });
}