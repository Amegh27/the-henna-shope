import React, { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  ShoppingBag,
  Search,
  Menu,
  X,
  Plus,
  Minus,
  ArrowRight,
  Leaf,
  Sparkles,
  Instagram,
  MessageCircle,
  ShieldCheck,
  Package,
  LayoutDashboard,
  Trash2,
  Check,
  Pencil,
} from 'lucide-react';

import { getProducts } from './services/productService';
import API from './api';
import {
  getAdminProfile,
  adminLogout,
} from './services/authService';

import AdminLogin from './components/AdminLogin';
import UserLogin from './components/userLogin';
import UserSignup from './components/UserSignup';
import VerifyEmail from './components/VerifyEmail';
import { getCurrentUser, userLogout } from './services/userAuthService';
import Swal from 'sweetalert2';

const money = (n) => `₹${Number(n).toLocaleString('en-IN')}`;


// MongoDB product IDs are 24-character hexadecimal ObjectIds.
const isMongoObjectId = (id) =>
  typeof id === 'string' && /^[a-f\d]{24}$/i.test(id);

// Normalize MongoDB documents so the storefront consistently uses `id`.
const normalizeProduct = (product) => {
  const id = String(product._id || product.id || '');

  return {
    ...product,
    _id: id,
    id,
    desc: product.description ?? product.desc ?? '',
    inStock:
      typeof product.inStock === 'boolean'
        ? product.inStock
        : typeof product.stock === 'number'
          ? product.stock > 0
          : true,
    sizes: Array.isArray(product.sizes)
      ? product.sizes.map((size) => ({
          ...size,
          label: size.label || `${size.quantity} ${size.unit}`,
        }))
      : [],
  };
};

// Calculate the optional fixed bulk discount for one cart item.
const getBulkDiscount = (item) => {
  if (!item.bulkDiscountEnabled) return 0;

  const minimumQuantity = Number(item.bulkMinimumQuantity) || 0;
  const discountAmount = Number(item.bulkDiscountAmount) || 0;
  const originalTotal = Number(item.price) * Number(item.qty);

  if (minimumQuantity < 1 || Number(item.qty) < minimumQuantity) return 0;

  return Math.min(discountAmount, originalTotal);
};

export default function App() {
  const location = useLocation();
  const navigate = useNavigate();

  // PRODUCTS
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // AUTHENTICATION
  const [adminUser, setAdminUser] = useState(null);
  const [customerUser, setCustomerUser] = useState(() => getCurrentUser());
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [adminOpen, setAdminOpen] = useState(false);
  const [adminSessionChecked, setAdminSessionChecked] = useState(false);

  // STORE STATES
  // Restore the cart from localStorage when the app first loads.
  const [cart, setCart] = useState(() => {
    try {
      const savedCart = localStorage.getItem('henna-cart');
      return savedCart ? JSON.parse(savedCart) : [];
    } catch (error) {
      console.error('Failed to load cart from localStorage:', error);
      return [];
    }
  });
  const [category, setCategory] = useState('All');
  const [query, setQuery] = useState('');

  const [page, setPage] = useState('home');
  const [cartOpen, setCartOpen] = useState(false);
  const [isPlacingOrder, setIsPlacingOrder] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  const [order, setOrder] = useState({
    name: '',
    house: '',
    locality: '',
    postOffice: '',
    district: '',
    state: '',
    pincode: '',
    phone1: '',
    phone2: '',
  });

  const [notice, setNotice] = useState('');
  const [editing, setEditing] = useState(null);
  const [adminView, setAdminView] = useState('list');
  const [editingCategory, setEditingCategory] = useState(null);
  const [categoryEditValue, setCategoryEditValue] = useState('');
  const [deletingCategory, setDeletingCategory] = useState(null);
  const [categoryDeleteReplacement, setCategoryDeleteReplacement] = useState('');
  const [categorySaving, setCategorySaving] = useState(false);
  const [categoryMessage, setCategoryMessage] = useState('');
  const [productDeleteId, setProductDeleteId] = useState(null);
  const [productDeleting, setProductDeleting] = useState(false);
  const [productActionMessage, setProductActionMessage] = useState('');
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState('');
  const [productSizes, setProductSizes] = useState([]);
  const [sizeQuantity, setSizeQuantity] = useState('');
  const [sizeUnit, setSizeUnit] = useState('ml');
  const sizeUnits = ['inch', 'g', 'S', 'M', 'L', 'ml', 'mm', 'pcs'];

  // CATEGORIES: default categories plus any categories added by the admin.
  const defaultCategories = [
    'Henna Cones',
    'Henna Powder',
    'Kits & Sets',
    'Aftercare',
  ];

  const [customCategories, setCustomCategories] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('henna-categories') || 'null');
      return Array.isArray(saved)
        ? [...new Set(saved.filter(Boolean))]
        : defaultCategories;
    } catch (error) {
      console.error('Failed to load categories:', error);
      return defaultCategories;
    }
  });

  const categories = ['All', ...customCategories];

  // SAVE CART TO LOCAL STORAGE WHENEVER IT CHANGES
  useEffect(() => {
    localStorage.setItem('henna-cart', JSON.stringify(cart));
  }, [cart]);

  // KEEP CART DETAILS IN SYNC WITH THE LATEST PRODUCT AVAILABILITY.
  // If an admin marks a product as out of stock, the cart updates immediately.
  useEffect(() => {
    if (!products.length) return;

    setCart((currentCart) => {
      let changed = false;
      const syncedCart = currentCart.map((item) => {
        const itemId = String(item._id || item.id || '');
        const latestProduct = products.find((product) => String(product._id || product.id || '') === itemId);
        if (!latestProduct) {
          if (item.isAvailable === false) return item;
          changed = true;
          return { ...item, isAvailable: false };
        }

        const updatedItem = {
          ...item,
          ...latestProduct,
          isAvailable: true,
          qty: item.qty,
        };

        if (
          updatedItem.inStock !== item.inStock ||
          updatedItem.name !== item.name ||
          updatedItem.price !== item.price ||
          updatedItem.image !== item.image ||
          updatedItem.bulkDiscountEnabled !== item.bulkDiscountEnabled ||
          updatedItem.bulkMinimumQuantity !== item.bulkMinimumQuantity ||
          updatedItem.bulkDiscountAmount !== item.bulkDiscountAmount ||
          JSON.stringify(updatedItem.sizes || []) !== JSON.stringify(item.sizes || [])
        ) {
          changed = true;
        }

        return updatedItem;
      });

      return changed ? syncedCart : currentCart;
    });
  }, [products]);

  // FETCH PRODUCTS FROM MONGODB
  useEffect(() => {
    async function fetchProducts() {
      try {
        setLoading(true);
        setError('');

        const responseData = await getProducts();
        const receivedProducts = Array.isArray(responseData)
          ? responseData
          : Array.isArray(responseData?.products)
            ? responseData.products
            : [];

        // Only real MongoDB products are treated as purchasable products.
        const apiProducts = receivedProducts
          .map(normalizeProduct)
          .filter((product) => isMongoObjectId(product.id));

        // Keep old local-only products visible in the admin list so they can
        // be opened, edited and saved as new MongoDB products.
        const savedProducts = JSON.parse(
          localStorage.getItem('henna-products') || '[]'
        );
        const legacyProducts = Array.isArray(savedProducts)
          ? savedProducts.filter((product) =>
              !isMongoObjectId(String(product._id || product.id || ''))
            )
          : [];

        setProducts([
          ...apiProducts,
          ...legacyProducts.map((product) => ({
            ...product,
            requiresDatabaseSave: true,
          })),
        ]);

        // The local cache is only for legacy products, never database records.
        localStorage.setItem('henna-products', JSON.stringify(legacyProducts));

        // Remove stale cart lines that contain timestamp/local-only IDs.
        const databaseIds = new Set(apiProducts.map((product) => product.id));
        setCart((currentCart) =>
          currentCart.filter((item) =>
            databaseIds.has(String(item._id || item.id || ''))
          )
        );
      } catch (err) {
        console.error('Product loading failed:', err);
        setError('Unable to load products. Please try again.');
      } finally {
        setLoading(false);
      }
    }

    fetchProducts();
  }, []);

  // KEEP CUSTOMER SESSION IN SYNC AND PREVENT AUTHENTICATED USERS
  // FROM OPENING THE LOGIN OR SIGNUP PAGES.
  useEffect(() => {
    const refreshCustomer = () => {
      const storedUser = getCurrentUser();
      setCustomerUser(storedUser);

      if (storedUser && ['/login', '/signup'].includes(window.location.pathname)) {
        navigate('/', { replace: true });
      }
    };

    // Run on initial load and whenever React Router changes pages.
    refreshCustomer();

    window.addEventListener('storage', refreshCustomer);
    window.addEventListener('focus', refreshCustomer);
    window.addEventListener('henna-auth-changed', refreshCustomer);

    return () => {
      window.removeEventListener('storage', refreshCustomer);
      window.removeEventListener('focus', refreshCustomer);
      window.removeEventListener('henna-auth-changed', refreshCustomer);
    };
  }, [location.pathname, navigate]);

  // VALIDATE ADMIN SESSION AND PROTECT THE DASHBOARD ROUTE.
  useEffect(() => {
    let active = true;

    async function validateAdminSession() {
      const token = localStorage.getItem('adminToken');

      if (!token) {
        if (active) {
          setAdminUser(null);
          setAdminSessionChecked(true);
          if (location.pathname === '/admin/dashboard') {
            navigate('/admin', { replace: true });
          }
        }
        return;
      }

      try {
        const admin = await getAdminProfile();
        if (!active) return;
        setAdminUser(admin);
        if (location.pathname === '/admin/dashboard') {
          setAdminOpen(true);
        } else if (location.pathname === '/admin') {
          // An existing admin session should go straight to the dashboard.
          navigate('/admin/dashboard', { replace: true });
        }
      } catch (err) {
        console.error('Admin session validation failed:', err);
        adminLogout();
        if (active) {
          setAdminUser(null);
          setAdminOpen(false);
          if (location.pathname === '/admin/dashboard') {
            navigate('/admin', { replace: true });
          }
        }
      } finally {
        if (active) setAdminSessionChecked(true);
      }
    }

    validateAdminSession();
    return () => { active = false; };
  }, [location.pathname, navigate]);

  // FILTER PRODUCTS
  const shown = useMemo(() => {
    return products.filter(
      (p) =>
        (category === 'All' || p.category === category) &&
        p.name.toLowerCase().includes(query.toLowerCase())
    );
  }, [products, category, query]);

  const originalTotal = cart.reduce(
    (sum, item) => sum + item.price * item.qty,
    0
  );

  const discountTotal = cart.reduce(
    (sum, item) => sum + getBulkDiscount(item),
    0
  );

  const total = originalTotal - discountTotal;

  const count = cart.reduce(
    (sum, item) => sum + item.qty,
    0
  );

  const hasOutOfStockItems = cart.some((item) => item.inStock === false || item.isAvailable === false);

  // SHOW NOTIFICATION
  function showNotice(message) {
    setNotice(message);
    setTimeout(() => setNotice(''), 2500);
  }

  // REQUIRE CUSTOMER LOGIN BEFORE ADDING ANY PRODUCT TO THE CART.
  async function add(product) {
    const currentUser = getCurrentUser();
    setCustomerUser(currentUser);

    if (!currentUser) {
      setCartOpen(false);
      setProfileMenuOpen(false);
      navigate('/login');
      return;
    }

    const productId = String(product._id || product.id || '');

    if (!isMongoObjectId(productId)) {
      await Swal.fire({
        title: 'Product needs updating',
        text: 'This older product has not yet been saved to the database. Please ask the store admin to edit and save it before purchasing.',
        icon: 'info',
        confirmButtonColor: '#294b38',
      });
      return;
    }

    if (product.inStock === false || product.isAvailable === false) {
      showNotice('This product is currently unavailable');
      return;
    }

    let selectedSize = null;
    if (Array.isArray(product.sizes) && product.sizes.length > 0) {
      const options = product.sizes.map((size) => ({
        value: size.label || `${size.quantity} ${size.unit}`,
        text: size.label || `${size.quantity} ${size.unit}`,
      }));
      const result = await Swal.fire({
        title: 'Choose a size',
        input: 'select',
        inputOptions: Object.fromEntries(options.map((option) => [option.value, option.text])),
        inputPlaceholder: 'Select size',
        showCancelButton: true,
        confirmButtonText: 'Add to bag',
        confirmButtonColor: '#294b38',
        background: '#fffdf7',
        color: '#294b38',
        inputValidator: (value) => value ? undefined : 'Please select a size.',
      });
      if (!result.isConfirmed) return;
      selectedSize = product.sizes.find((size) => (size.label || `${size.quantity} ${size.unit}`) === result.value);
    }

    const sizeLabel = selectedSize ? (selectedSize.label || `${selectedSize.quantity} ${selectedSize.unit}`) : '';
    const cartKey = `${productId}::${sizeLabel}`;
    setCart((old) => {
      const found = old.find((item) => (item.cartKey || `${item.id}::${item.selectedSize || ''}`) === cartKey);
      return found
        ? old.map((item) => (item.cartKey || `${item.id}::${item.selectedSize || ''}`) === cartKey
          ? { ...item, qty: item.qty + 1 }
          : item)
        : [...old, { ...product, id: productId, _id: productId, selectedSize: sizeLabel, cartKey, qty: 1 }];
    });
    showNotice(`${product.name}${sizeLabel ? ` (${sizeLabel})` : ''} added to your bag`);
  }

  // CHANGE QUANTITY
  function changeQty(cartKey, difference) {
    setCart((old) =>
      old
        .map((item) =>
          (item.cartKey || `${item.id}::${item.selectedSize || ''}`) === cartKey
            ? { ...item, qty: item.qty + difference }
            : item
        )
        .filter((item) => item.qty > 0)
    );
  }

  // REMOVE A PRODUCT FROM THE CART (including products deleted by admin)
  async function removeCartItem(cartKey) {
    const itemToRemove = cart.find((item) => (item.cartKey || `${item.id}::${item.selectedSize || ''}`) === cartKey);
    if (!itemToRemove) return;

    const result = await Swal.fire({
      title: 'Remove from your bag?',
      text: `Remove “${itemToRemove.name}” from your cart?`,
      icon: 'warning',
      iconColor: '#9b8968',
      showCancelButton: true,
      confirmButtonText: 'Yes, remove it',
      cancelButtonText: 'Keep it',
      reverseButtons: true,
      background: '#fffdf7',
      color: '#294b38',
      width: '370px',
      padding: '1.25rem',
      confirmButtonColor: '#294b38',
      cancelButtonColor: '#b8a98a',
      customClass: {
        popup: 'henna-swal-popup',
        title: 'henna-swal-title',
        confirmButton: 'henna-swal-confirm',
        cancelButton: 'henna-swal-cancel',
      },
    });

    if (!result.isConfirmed) return;

    setCart((currentCart) => currentCart.filter((item) => (item.cartKey || `${item.id}::${item.selectedSize || ''}`) !== cartKey));

    await Swal.fire({
      title: 'Removed from your bag',
      text: 'The item has been removed from your cart.',
      icon: 'success',
      iconColor: '#294b38',
      background: '#fffdf7',
      color: '#294b38',
      confirmButtonColor: '#294b38',
      confirmButtonText: 'Lovely!',
      customClass: {
        popup: 'henna-swal-popup',
        title: 'henna-swal-title',
        confirmButton: 'henna-swal-confirm',
      },
    });
  }

  // ADD A NEW PRODUCT CATEGORY FROM THE ADMIN DASHBOARD
  async function addCategory() {
    const result = await Swal.fire({
      title: 'Add a category',
      input: 'text',
      inputLabel: 'Category name',
      inputPlaceholder: 'e.g. Bridal Henna',
      showCancelButton: true,
      confirmButtonText: 'Add category',
      confirmButtonColor: '#294b38',
      inputValidator: (value) => {
        const cleaned = value?.trim();
        if (!cleaned) return 'Please enter a category name.';
        if (customCategories.some((item) => item.toLowerCase() === cleaned.toLowerCase())) {
          return 'This category already exists.';
        }
        if (cleaned.length > 30) return 'Keep the category name under 30 characters.';
        return undefined;
      },
    });

    if (!result.isConfirmed) return;

    const newCategory = result.value.trim();
    const updatedCategories = [...customCategories, newCategory];
    setCustomCategories(updatedCategories);
    localStorage.setItem('henna-categories', JSON.stringify(updatedCategories));
    setCategory(newCategory);

    await Swal.fire({
      title: 'Category added!',
      text: `${newCategory} is now available in your shop filters and product form.`,
      icon: 'success',
      confirmButtonColor: '#294b38',
    });
  }

  // OPEN THE INLINE CATEGORY EDITOR INSIDE THE ADMIN DASHBOARD.
  function editCategory(oldName) {
    setDeletingCategory(null);
    setEditingCategory(oldName);
    setCategoryEditValue(oldName);
    setCategoryMessage('');
  }

  // Save category changes using the PATCH endpoint exposed by the backend.
  // Products already assigned to this category are updated in MongoDB first.
  async function saveCategoryEdit(oldName, proposedName = categoryEditValue) {
    const newName = String(proposedName || '').trim();

    if (categorySaving) return;
    if (!newName) {
      setCategoryMessage('Please enter a category name.');
      return;
    }
    if (newName.length > 30) {
      setCategoryMessage('Keep the category name under 30 characters.');
      return;
    }
    if (customCategories.some((item) =>
      item.toLowerCase() === newName.toLowerCase() && item !== oldName
    )) {
      setCategoryMessage('This category already exists.');
      return;
    }
    if (newName === oldName) {
      setEditingCategory(null);
      setCategoryEditValue('');
      setCategoryMessage('No changes to save.');
      return;
    }

    const affected = products.filter((product) => product.category === oldName);
    const databaseProducts = affected.filter((product) =>
      isMongoObjectId(String(product._id || product.id || ''))
    );
    const token = localStorage.getItem('adminToken');

    if (databaseProducts.length > 0 && !token) {
      setCategoryMessage('Your admin session has expired. Please log in again.');
      return;
    }

    const updatedIds = new Set();
    try {
      setCategorySaving(true);
      setCategoryMessage(`Updating ${databaseProducts.length} saved product(s)...`);

      for (const product of databaseProducts) {
        const id = String(product._id || product.id || '');
        const response = await fetch(`${API}/products/${encodeURIComponent(id)}`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ category: newName }),
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(data.message || data.error || `Could not update ${product.name} (HTTP ${response.status}).`);
        }
        updatedIds.add(id);
      }

      const updatedCategories = customCategories.map((item) =>
        item === oldName ? newName : item
      );
      const updatedProducts = products.map((product) =>
        product.category === oldName ? { ...product, category: newName } : product
      );

      setCustomCategories(updatedCategories);
      localStorage.setItem('henna-categories', JSON.stringify(updatedCategories));
      setProducts(updatedProducts);
      localStorage.setItem(
        'henna-products',
        JSON.stringify(updatedProducts.filter((product) =>
          !isMongoObjectId(String(product._id || product.id || ''))
        ))
      );
      setCategory((current) => current === oldName ? newName : current);
      setEditingCategory(null);
      setCategoryEditValue('');
      setCategoryMessage(`Saved successfully. “${oldName}” is now “${newName}”. ${affected.length} product(s) updated.`);
    } catch (error) {
      console.error('Category rename failed:', error);

      // Keep the UI consistent if the server updated some products before
      // another product failed. The category itself remains available to retry.
      if (updatedIds.size > 0) {
        const partiallyUpdated = products.map((product) => {
          const id = String(product._id || product.id || '');
          return updatedIds.has(id) ? { ...product, category: newName } : product;
        });
        setProducts(partiallyUpdated);
        localStorage.setItem(
          'henna-products',
          JSON.stringify(partiallyUpdated.filter((product) =>
            !isMongoObjectId(String(product._id || product.id || ''))
          ))
        );
      }
      setCategoryMessage(error.message || 'Could not save the category. Please try again.');
    } finally {
      setCategorySaving(false);
    }
  }

  // Start an inline category-delete confirmation inside the admin dashboard.
  function deleteCategory(categoryName) {
    const replacements = customCategories.filter((item) => item !== categoryName);
    if (products.some((product) => product.category === categoryName) && replacements.length > 0) {
      setCategoryDeleteReplacement(replacements[0]);
    } else {
      setCategoryDeleteReplacement('');
    }
    setEditingCategory(null);
    setDeletingCategory(categoryName);
    setCategoryMessage('');
  }

  // Move any products to another category before removing the category itself.
  async function confirmDeleteCategory(categoryName, replacementName = categoryDeleteReplacement) {
    if (categorySaving) return;

    const affected = products.filter((product) => product.category === categoryName);
    const replacement = String(replacementName || '').trim();
    const availableReplacements = customCategories.filter((item) => item !== categoryName);

    if (affected.length > 0 && !availableReplacements.includes(replacement)) {
      setCategoryMessage('Choose another category for the products before deleting this category.');
      return;
    }

    const databaseProducts = affected.filter((product) =>
      isMongoObjectId(String(product._id || product.id || ''))
    );
    const token = localStorage.getItem('adminToken');
    if (databaseProducts.length > 0 && !token) {
      setCategoryMessage('Your admin session has expired. Please log in again.');
      return;
    }

    const updatedIds = new Set();
    try {
      setCategorySaving(true);
      setCategoryMessage(`Moving ${databaseProducts.length} saved product(s)...`);

      for (const product of databaseProducts) {
        const id = String(product._id || product.id || '');
        const response = await fetch(`${API}/products/${encodeURIComponent(id)}`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ category: replacement }),
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(data.message || data.error || `Could not move ${product.name} (HTTP ${response.status}).`);
        }
        updatedIds.add(id);
      }

      const updatedProducts = products.map((product) =>
        product.category === categoryName ? { ...product, category: replacement } : product
      );
      const updatedCategories = customCategories.filter((item) => item !== categoryName);

      setProducts(updatedProducts);
      localStorage.setItem(
        'henna-products',
        JSON.stringify(updatedProducts.filter((product) =>
          !isMongoObjectId(String(product._id || product.id || ''))
        ))
      );
      setCustomCategories(updatedCategories);
      localStorage.setItem('henna-categories', JSON.stringify(updatedCategories));
      setCategory((current) => current === categoryName ? 'All' : current);
      setDeletingCategory(null);
      setCategoryDeleteReplacement('');
      setCategoryMessage(affected.length > 0
        ? `Category deleted. ${affected.length} product(s) moved to “${replacement}”.`
        : `“${categoryName}” has been deleted.`);
    } catch (error) {
      console.error('Category deletion failed:', error);
      if (updatedIds.size > 0) {
        const partiallyUpdated = products.map((product) => {
          const id = String(product._id || product.id || '');
          return updatedIds.has(id) ? { ...product, category: replacement } : product;
        });
        setProducts(partiallyUpdated);
      }
      setCategoryMessage(error.message || 'Could not delete this category. Please try again.');
    } finally {
      setCategorySaving(false);
    }
  }

  // UPLOAD PRODUCT IMAGE TO CLOUDINARY AND SAVE THE PRODUCT IN MONGODB.
  async function saveProduct(e) {
    e.preventDefault();

    const formElement = e.currentTarget;
    const form = new FormData(formElement);

    try {
      const token = localStorage.getItem('adminToken');

      if (!token) {
        throw new Error('Your admin session has expired. Please log in again.');
      }

      let imageUrl = editing?.image || '';

      if (imageFile) {
        const cloudName = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;
        const uploadPreset = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET;

        if (!cloudName || !uploadPreset) {
          throw new Error(
            'Add VITE_CLOUDINARY_CLOUD_NAME and VITE_CLOUDINARY_UPLOAD_PRESET to your frontend .env file, then restart Vite.'
          );
        }

        const uploadData = new FormData();
        uploadData.append('file', imageFile);
        uploadData.append('upload_preset', uploadPreset);

        const uploadResponse = await fetch(
          `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`,
          {
            method: 'POST',
            body: uploadData,
          }
        );
        const uploadResult = await uploadResponse.json();

        if (!uploadResponse.ok || !uploadResult.secure_url) {
          throw new Error(
            uploadResult.error?.message || 'Image upload failed. Please try again.'
          );
        }

        imageUrl = uploadResult.secure_url;
      }

      if (!imageUrl) {
        throw new Error('Please choose a product image before saving.');
      }

      const productData = {
        name: String(form.get('name') || '').trim(),
        category: form.get('category'),
        price: Number(form.get('price')),
        oldPrice: Number(form.get('oldPrice')) || null,
        tag: form.get('tag') || 'New',
        description: form.get('desc') || '',
        image: imageUrl,
        stock: form.get('inStock') === 'on' ? 1 : 0,
        bulkDiscountEnabled: form.get('bulkDiscountEnabled') === 'on',
        bulkMinimumQuantity: Math.max(
          1,
          Number(form.get('bulkMinimumQuantity')) || 5
        ),
        bulkDiscountAmount: Math.max(
          0,
          Number(form.get('bulkDiscountAmount')) || 0
        ),
        sizes: productSizes.map((size) => ({
          quantity: Number(size.quantity),
          unit: size.unit,
        })),
      };

      // Old timestamp-ID products are recreated with POST. Real MongoDB
      // products are updated with PUT.
      const editingId = String(editing?._id || editing?.id || '');
      const editingDatabaseProduct = isMongoObjectId(editingId);
      const url = editingDatabaseProduct
        ? `${API}/products/${encodeURIComponent(editingId)}`
        : `${API}/products`;
      const method = editingDatabaseProduct ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(productData),
      });

      const responseData = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(responseData.message || 'Unable to save product.');
      }

      if (!responseData.product) {
        throw new Error('The backend did not return the saved product.');
      }

      const savedProduct = normalizeProduct(responseData.product);

      if (!isMongoObjectId(savedProduct.id)) {
        throw new Error('The backend returned an invalid MongoDB product ID.');
      }

      const updatedProducts = [
        savedProduct,
        ...products.filter((product) =>
          String(product._id || product.id || '') !== editingId &&
          String(product._id || product.id || '') !== savedProduct.id
        ),
      ];

      setProducts(updatedProducts);

      // Keep only products that have not yet been migrated to MongoDB.
      localStorage.setItem(
        'henna-products',
        JSON.stringify(
          updatedProducts.filter((product) =>
            !isMongoObjectId(String(product._id || product.id || ''))
          )
        )
      );

      setEditing(null);
      setImageFile(null);
      setImagePreview('');
      setProductSizes([]);
      setSizeQuantity('');
      setSizeUnit('ml');
      formElement.reset();
      setAdminView('list');

      showNotice(
        editingDatabaseProduct
          ? 'Product updated successfully'
          : 'Product saved to database successfully'
      );
    } catch (error) {
      console.error('Product save failed:', error);
      await Swal.fire({
        title: 'Could not save product',
        text: error.message || 'Something went wrong while saving the product.',
        icon: 'error',
        confirmButtonColor: '#294b38',
      });
    }
  }

  // Show the product-delete confirmation inside the Admin Dashboard.
  function removeProduct(id) {
    setProductActionMessage('');
    setProductDeleteId(String(id));
  }

  // Permanently delete a MongoDB product, or remove a legacy local-only entry.
  async function confirmRemoveProduct(id) {
    if (productDeleting) return;

    const productToDelete = products.find(
      (product) => String(product._id || product.id) === String(id)
    );
    if (!productToDelete) return;

    const productId = String(productToDelete._id || productToDelete.id || '');
    const token = localStorage.getItem('adminToken');

    try {
      setProductDeleting(true);
      setProductActionMessage('Deleting product...');

      if (isMongoObjectId(productId)) {
        if (!token) throw new Error('Your admin session has expired. Please log in again.');

        const response = await fetch(`${API}/products/${encodeURIComponent(productId)}`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${token}` },
        });
        const responseData = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(responseData.message || responseData.error || `The product could not be deleted (HTTP ${response.status}).`);
        }
      }

      const updatedProducts = products.filter(
        (product) => String(product._id || product.id || '') !== productId
      );
      setProducts(updatedProducts);
      localStorage.setItem(
        'henna-products',
        JSON.stringify(updatedProducts.filter((product) =>
          !isMongoObjectId(String(product._id || product.id || ''))
        ))
      );
      setCart((currentCart) => currentCart.map((item) =>
        String(item._id || item.id || '') === productId
          ? { ...item, isAvailable: false }
          : item
      ));

      setProductDeleteId(null);
      setProductActionMessage(`“${productToDelete.name}” was deleted successfully.`);
    } catch (error) {
      console.error('Product deletion failed:', error);
      setProductActionMessage(error.message || 'Could not delete this product. Please try again.');
    } finally {
      setProductDeleting(false);
    }
  }

  // SAVE ORDER IN MONGODB, THEN OPEN WHATSAPP
  async function whatsappOrder(e) {
    e.preventDefault();

    if (!cart.length || isPlacingOrder) return;

    if (cart.some((item) => !isMongoObjectId(String(item._id || item.id || '')))) {
      Swal.fire({
        title: 'Invalid product in your bag',
        text: 'An older product in your bag does not have a MongoDB ID. Remove it and add the updated product again.',
        icon: 'warning',
        confirmButtonColor: '#294b38',
      });
      return;
    }

    if (cart.some((item) => item.inStock === false || item.isAvailable === false)) {
      Swal.fire({
        icon: 'warning',
        title: 'Item out of stock',
        text: 'Your bag contains an out-of-stock product. You cannot place the order until it is back in stock.',
        confirmButtonColor: '#294b38',
      });
      return;
    }

    const cleanPhone1 = order.phone1.replace(/\D/g, '');
    const cleanPhone2 = order.phone2.replace(/\D/g, '');
    const cleanPincode = order.pincode.replace(/\D/g, '');

    const requiredAddressFields = [
      order.name,
      order.house,
      order.locality,
      order.postOffice,
      order.district,
      order.state,
    ];

    if (requiredAddressFields.some((value) => !value.trim())) {
      Swal.fire({
        icon: 'warning',
        title: 'Complete your delivery details',
        text: 'Please fill in your name and every required address field.',
        confirmButtonColor: '#294b38',
      });
      return;
    }

    if (!/^[6-9]\d{9}$/.test(cleanPhone1)) {
      Swal.fire({
        icon: 'warning',
        title: 'Invalid primary phone number',
        text: 'Please enter a valid 10-digit mobile number for Phone number 1.',
        confirmButtonColor: '#294b38',
      });
      return;
    }

    if (order.phone2.trim() && !/^[6-9]\d{9}$/.test(cleanPhone2)) {
      Swal.fire({
        icon: 'warning',
        title: 'Invalid alternate phone number',
        text: 'Phone number 2 must be a valid 10-digit mobile number, or leave it empty.',
        confirmButtonColor: '#294b38',
      });
      return;
    }

    if (!/^\d{6}$/.test(cleanPincode)) {
      Swal.fire({
        icon: 'warning',
        title: 'Invalid pincode',
        text: 'Please enter a valid 6-digit Indian pincode.',
        confirmButtonColor: '#294b38',
      });
      return;
    }

    const deliveryAddress = [
      `House name/No: ${order.house.trim()}`,
      `Locality: ${order.locality.trim()}`,
      `Post office: ${order.postOffice.trim()}`,
      `District: ${order.district.trim()}`,
      `State: ${order.state.trim()}`,
      `Pincode: ${cleanPincode}`,
      `Phone number 1: ${cleanPhone1}`,
      order.phone2.trim() ? `Phone number 2: ${cleanPhone2}` : '',
    ].filter(Boolean).join('\n');

    // Open a blank tab immediately so the browser does not block WhatsApp
    // after the asynchronous order-save request.
    const whatsappTab = window.open('about:blank', '_blank');

    try {
      setIsPlacingOrder(true);

      const response = await fetch(`${API}/orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customer: {
            name: order.name.trim(),
            phone: cleanPhone1,
            address: deliveryAddress,
          },
          items: cart.map((item) => ({
            productId: String(item._id || item.id),
            quantity: Number(item.qty),
            selectedSize: item.selectedSize || '' 
          }))
        })
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data.message || 'Unable to save your order. Please try again.');
      }

      if (!data.whatsappUrl) {
        throw new Error('Your order was saved, but the WhatsApp number is not configured on the backend.');
      }

      // Clear the cart only after the backend confirms that it saved the order.
      setCart([]);
      setOrder({ name: '', house: '', locality: '', postOffice: '', district: '', state: '', pincode: '', phone1: '', phone2: '' });
      setCartOpen(false);

      if (whatsappTab) {
        whatsappTab.location.href = data.whatsappUrl;
      } else {
        window.location.href = data.whatsappUrl;
      }

      Swal.fire({
        title: 'Order saved!',
        text: `Your order ${data.order?.orderNumber || ''} has been saved. Please send the WhatsApp message to confirm it.`,
        icon: 'success',
        iconColor: '#294b38',
        background: '#fffdf7',
        color: '#294b38',
        confirmButtonColor: '#294b38',
        confirmButtonText: 'Lovely!',
        width: '360px',
        padding: '1.1rem'
      });
    } catch (error) {
      if (whatsappTab) whatsappTab.close();

      console.error('Order checkout failed:', error);
      Swal.fire({
        title: 'Unable to place order',
        text: error.message || 'Please try again.',
        icon: 'error',
        iconColor: '#294b38',
        background: '#fffdf7',
        color: '#294b38',
        confirmButtonColor: '#294b38',
        width: '360px',
        padding: '1.1rem'
      });
    } finally {
      setIsPlacingOrder(false);
    }
  }

  // OPEN THE CART ONLY FOR AUTHENTICATED CUSTOMERS.
  function handleCartClick() {
    const currentUser = getCurrentUser();

    setCustomerUser(currentUser);

    if (!currentUser) {
      setCartOpen(false);
      setProfileMenuOpen(false);
      navigate('/login');
      return;
    }

    setCartOpen(true);
  }

  // NAVIGATION
  const goShop = () => {
    setPage('shop');
    setAdminOpen(false);

    window.scrollTo({
      top: 0,
      behavior: 'smooth',
    });
  };

  // Open the homepage and scroll to the Contact section from any page.
  const goContact = () => {
    setPage('home');
    setAdminOpen(false);
    setMobileOpen(false);

    window.setTimeout(() => {
      document.getElementById('contact')?.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      });
    }, 100);
  };

  // Open WhatsApp directly for mehndi artist booking enquiries.
  const bookMehndiArtist = () => {
    const phone = (import.meta.env.VITE_WHATSAPP_NUMBER || '').replace(/\D/g, '');

    if (!phone || phone.includes('XXXXXXXXXX')) {
      Swal.fire({
        title: 'WhatsApp number not configured',
        text: 'Please contact the store owner to configure VITE_WHATSAPP_NUMBER.',
        icon: 'info',
        confirmButtonColor: '#294b38',
        background: '#fffdf7',
        color: '#294b38',
      });
      return;
    }

    const message =
      "Hello! I would like to book a mehndi artist through The Henna Shope. Please share your availability, packages, and pricing.";

    window.open(
      `https://wa.me/${phone}?text=${encodeURIComponent(message)}`,
      '_blank',
      'noopener,noreferrer'
    );
  };

  // SUCCESSFUL ADMIN LOGIN
  function handleLogin(admin) {
    setAdminUser(admin);
    setAdminSessionChecked(true);
    setAdminOpen(true);
    navigate('/admin/dashboard', { replace: true });
  }

  // ADMIN LOGOUT
  function handleLogout() {
    adminLogout();
    setAdminUser(null);
    setAdminOpen(false);
    setEditing(null);
    navigate('/admin', { replace: true });
  }

  // CUSTOMER LOGOUT (shared by the desktop profile dropdown and the mobile menu)
  async function handleCustomerLogout() {
    const result = await Swal.fire({
      title: 'Leaving so soon?',
      text: 'Are you sure you want to log out of your account?',
      icon: 'question',
      iconColor: '#294b38',
      showCancelButton: true,
      confirmButtonText: 'Yes, log out',
      cancelButtonText: 'Stay logged in',
      reverseButtons: true,
      background: '#fffdf7',
      color: '#294b38',
      width: '360px',
      padding: '1.25rem',
      confirmButtonColor: '#294b38',
      cancelButtonColor: '#b8a98a',
      customClass: {
        popup: 'henna-swal-popup',
        title: 'henna-swal-title',
        confirmButton: 'henna-swal-confirm',
        cancelButton: 'henna-swal-cancel'
      }
    });

    if (result.isConfirmed) {
      // Clear the customer's cart when they log out.
      // Remove the persisted copy as well as clearing React state.
      userLogout();
      setCart([]);
      localStorage.removeItem('henna-cart');
      setCartOpen(false);
      setCustomerUser(null);
      setProfileMenuOpen(false);
      setMobileOpen(false);
      navigate('/');

      Swal.fire({
        title: 'Logged out!',
        text: 'We hope to see you again soon.',
        icon: 'success',
        iconColor: '#294b38',
        background: '#fffdf7',
        color: '#294b38',
        width: '340px',
        padding: '1.1rem',
        confirmButtonColor: '#294b38',
        confirmButtonText: 'Lovely!'
      });
    }
  }

  // LOADING COMPONENT
  function ProductLoading() {
    return (
      <p className="empty">
        Loading products...
      </p>
    );
  }

  // ERROR COMPONENT
  function ProductError() {
    return (
      <div className="empty">
        <p>{error}</p>

        <button
          className="button outline"
          onClick={() => window.location.reload()}
        >
          Try again
        </button>
      </div>
    );
  }

  // ADMIN ROUTES: keep admin login separate from the customer storefront.
  if (location.pathname === '/admin') {
    // Do not show the login form again when a valid admin session exists.
    if (!adminSessionChecked || adminUser) {
      return (
        <div className="app" style={{ minHeight: '100vh', display: 'grid', placeItems: 'center' }}>
          <p className="empty">Checking admin session...</p>
        </div>
      );
    }

    return (
      <AdminLogin
        onClose={() => navigate('/', { replace: true })}
        onLogin={handleLogin}
      />
    );
  }

  if (location.pathname === '/admin/dashboard' && (!adminSessionChecked || !adminUser)) {
    return (
      <div className="app" style={{ minHeight: '100vh', display: 'grid', placeItems: 'center' }}>
        <p className="empty">{adminSessionChecked ? 'Redirecting to admin login...' : 'Verifying admin session...'}</p>
      </div>
    );
  }

  // CUSTOMER AUTH PAGES
  // Re-check storage at render time as a second guard against stale state.
  const activeCustomer = customerUser || getCurrentUser();

  // Additional photographs for the lower part of the founder-story side gallery.
  // Prefer real product images from the current store catalogue; use the site's
  // existing henna photographs until products have loaded or if none are present.
  const founderGalleryPhotos = products.filter((product) => product.image).slice(0, 4);
  const founderGalleryFallback = [
    { image: '/images/henna1.jpeg', name: 'Henna artistry' },
    { image: '/images/henna2.jpeg', name: 'Made with care' },
    { image: '/images/henna3.jpeg', name: 'The beauty of tradition' },
    { image: '/images/tea-tree-essential-oil.jpeg', name: 'Inspired by nature' },
  ];

  if (location.pathname === '/login') {
    if (activeCustomer) {
      return null; // The session effect redirects to the homepage.
    }
    return <UserLogin />;
  }

  if (location.pathname === '/signup') {
    if (activeCustomer) {
      return null; // The session effect redirects to the homepage.
    }
    return <UserSignup />;
  }

  if (location.pathname === '/verify-email') {
    return <VerifyEmail />;
  }

  return (
    <div className="app">
      <style>{`
        /* MEHNDI ARTISTRY SERVICE PROMO */
        .mehndi-service-promo{display:grid;grid-template-columns:minmax(0,1fr) minmax(280px,.82fr);align-items:center;gap:clamp(24px,5vw,72px);margin:clamp(38px,6vw,82px) auto;padding:clamp(24px,5vw,64px);background:#F2E8DA;color:#294b38;border:1px solid rgba(125,95,43,.18)}
        .mehndi-service-copy .eyebrow{color:#8c6c32}
        .mehndi-service-copy h2{font-family:inherit;font-size:clamp(34px,4.2vw,58px);font-weight:400;line-height:1.08;margin:14px 0}
        .mehndi-service-copy h2 em{font-style:italic;color:#9a7a3c}
        .mehndi-service-copy p{max-width:490px;line-height:1.8;color:#59695b}
        .mehndi-service-list{list-style:none;padding:0;margin:20px 0 28px;display:grid;gap:10px}
        .mehndi-service-list li{display:flex;align-items:flex-start;gap:10px;color:#405545;font-size:14px}
        .mehndi-service-list li:before{content:'✦';color:#a78a4c}
        .mehndi-service-art{display:flex;justify-content:center;align-items:center;min-width:0}
        .mehndi-service-art img{display:block;width:100%;max-width:430px;max-height:690px;object-fit:contain;box-shadow:0 18px 42px rgba(33,48,37,.18)}
        @media(max-width:760px){.mehndi-service-promo{grid-template-columns:1fr;padding:22px;gap:28px}.mehndi-service-copy h2{font-size:38px}.mehndi-service-art img{max-height:620px;max-width:360px}}
        .brand-emblem{width:42px;height:42px;flex:0 0 42px;object-fit:contain;display:block}
        .header .brand-emblem{filter:brightness(0) invert(1)}
        .brand{display:inline-flex;align-items:center;gap:11px}
        .brand small{display:block}
        /* HOME PAGE CATEGORY COLLECTION */
        .home-category-grid{display:grid;grid-template-columns:minmax(0,1.05fr) minmax(0,1.55fr);grid-template-rows:clamp(190px,21vw,315px) clamp(190px,21vw,315px);gap:16px;margin-top:34px}
        .home-category-card{position:relative;display:flex;flex-direction:column;justify-content:flex-end;align-items:flex-start;min-width:0;overflow:hidden;padding:clamp(22px,3vw,42px);border:0;border-radius:0;background-color:#b8aa8d;background-size:cover;background-position:center;color:#fffdf7;text-align:left;cursor:pointer;transition:background-size .45s ease,filter .3s ease}
        .home-category-card:after{content:'';position:absolute;inset:0;border:1px solid rgba(255,255,255,.14);pointer-events:none}
        .home-category-card:hover{filter:saturate(1.08)}
        .home-category-card-1{grid-row:1 / span 2;min-height:100%}
        .home-category-card-2{grid-column:2;grid-row:1}
        .home-category-card-3{grid-column:2;grid-row:2;width:58%}
        .home-category-kicker,.home-category-title{position:relative;z-index:1}
        .home-category-kicker{font-size:10px;font-weight:600;letter-spacing:.14em;text-transform:uppercase;color:rgba(255,253,247,.9);margin-bottom:10px}
        .home-category-title{font-family:Georgia,'Times New Roman',serif;font-size:clamp(25px,3vw,40px);font-weight:400;line-height:1.05;letter-spacing:-.035em}
        .home-category-title span{font-family:Arial,sans-serif;font-size:.55em;vertical-align:middle;margin-left:7px}
        .home-category-more{display:flex;justify-content:center;margin-top:25px}
        .home-category-more button{display:inline-flex;align-items:center;gap:10px;padding:10px 4px;border:0;border-bottom:1px solid #a99b7d;background:transparent;color:#294b38;font-size:11px;letter-spacing:.12em;text-transform:uppercase;cursor:pointer;transition:gap .2s ease}
        .home-category-more button:hover{gap:16px}
        @media(max-width:700px){.home-category-grid{grid-template-columns:1fr 1fr;grid-template-rows:clamp(210px,55vw,310px) clamp(170px,43vw,240px);gap:10px;margin-top:25px}.home-category-card{padding:18px}.home-category-card-1{grid-row:1 / span 2}.home-category-card-2{grid-column:2;grid-row:1}.home-category-card-3{grid-column:2;grid-row:2;width:100%}.home-category-kicker{font-size:8px;letter-spacing:.1em}.home-category-title{font-size:clamp(20px,5vw,29px)}}
        @media(max-width:420px){.home-category-grid{grid-template-columns:1fr;grid-template-rows:260px 190px 190px}.home-category-card-1,.home-category-card-2,.home-category-card-3{grid-column:1;grid-row:auto;width:100%}.home-category-card{padding:20px}}

        .brand-story{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:clamp(42px,7vw,100px);align-items:center;padding:clamp(70px,9vw,130px) max(6vw,24px);background:#f5f1e8;overflow:hidden}
        .brand-story-image-wrap{position:relative;max-width:590px;width:100%;justify-self:center;padding:0 34px 34px 0}
        .brand-story-image{display:block;width:100%;height:clamp(390px,48vw,610px);object-fit:cover;object-position:center;border-radius:48% 48% 5px 5px;box-shadow:0 24px 60px rgba(41,75,56,.13)}
        .brand-story-image-wrap:after{content:'';position:absolute;right:0;bottom:0;width:72%;height:76%;border:1px solid #b8a98a;border-radius:48% 48% 5px 5px;z-index:0;pointer-events:none}
        .brand-story-image{position:relative;z-index:1}
        .story-image-note{position:absolute;z-index:2;left:-15px;bottom:72px;display:flex;align-items:center;gap:9px;background:#fffdf7;color:#294b38;padding:13px 18px;border-radius:30px;box-shadow:0 10px 28px rgba(31,57,43,.12);font-size:12px;letter-spacing:.04em}
        .story-image-number{position:absolute;right:0;top:22px;writing-mode:vertical-rl;color:#71816b;font-size:9px;letter-spacing:.2em;z-index:2}
        .brand-story-copy{max-width:600px;color:#294b38}
        .brand-story-copy .eyebrow,.contact-heading .eyebrow{display:flex;align-items:center;gap:10px;color:#78866d;letter-spacing:.19em;font-size:10px;font-weight:700}
        .story-eyebrow-dot{width:7px;height:7px;background:#b8a98a;border-radius:50%;display:inline-block}
        .brand-story-copy h2,.contact-heading h2{font-family:Georgia,'Times New Roman',serif;font-size:clamp(38px,5vw,66px);font-weight:400;line-height:1.08;letter-spacing:-.04em;margin:22px 0 25px;color:#294b38}
        .brand-story-copy h2 em,.contact-heading h2 em{font-weight:400;color:#9b8968}
        .brand-story-copy>p{font-size:14px;line-height:1.95;color:#697468;max-width:520px;margin:0 0 15px}
        .brand-story-copy .story-secondary{color:#8b8d7d;font-size:13px}
        .story-shop-button{margin-top:16px}
        .story-values{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px;border-top:1px solid #ddd6c7;margin-top:42px;padding-top:23px}
        .story-values div{display:flex;flex-direction:column;gap:5px}
        .story-values span{font-size:20px;color:#a28f6c;margin-bottom:3px}
        .story-values b{font-size:11px;color:#294b38}
        .story-values small{font-size:10px;color:#929184;line-height:1.5}
        .brand-contact{padding:clamp(70px,9vw,120px) max(6vw,24px);background:#fffdf7;color:#294b38}
        .contact-heading{text-align:center;max-width:700px;margin:0 auto 52px}
        .contact-heading .eyebrow{justify-content:center}
        .contact-heading h2{margin:18px 0}
        .contact-heading>p{max-width:520px;margin:0 auto;color:#7c8073;font-size:14px;line-height:1.85}
        .contact-layout{max-width:1120px;margin:0 auto;display:grid;grid-template-columns:.82fr 1.18fr;gap:clamp(25px,5vw,65px);align-items:stretch}
        .contact-details{display:flex;flex-direction:column;gap:15px}
        .contact-card{display:flex;align-items:center;gap:16px;padding:23px 20px;background:#f5f1e8;border:1px solid #eee7d9;text-decoration:none;color:#294b38;transition:transform .25s ease,box-shadow .25s ease}
        .contact-card:hover{transform:translateY(-4px);box-shadow:0 14px 30px rgba(41,75,56,.09)}
        .contact-icon{width:46px;height:46px;flex:0 0 46px;border-radius:50%;display:grid;place-items:center;background:#e6e9dc;color:#294b38}
        .contact-card>span:nth-child(2){display:flex;flex-direction:column;gap:5px;min-width:0}
        .contact-card small{font-size:9px;letter-spacing:.13em;color:#9a8c6d}
        .contact-card b{font-family:Georgia,serif;font-size:18px;font-weight:400}
        .contact-card em{font-style:normal;color:#858779;font-size:11px}
        .contact-arrow{margin-left:auto;flex:0 0 auto;color:#9a8c6d}
        .contact-note{display:flex;gap:14px;align-items:flex-start;padding:22px 20px;background:#294b38;color:#fffdf7;margin-top:5px}
        .contact-note svg{flex:0 0 auto;color:#d4c6a8;margin-top:3px}
        .contact-note p{margin:0;font-size:12px;line-height:1.8;color:#e4e7dc}
        .contact-note b{color:#fffdf7;font-family:Georgia,serif;font-size:17px;font-weight:400}
        .contact-form{padding:clamp(24px,4vw,42px);background:#f5f1e8;border:1px solid #eee7d9;display:flex;flex-direction:column;gap:17px}
        .contact-form-top{display:flex;justify-content:space-between;align-items:center;gap:10px;border-bottom:1px solid #ddd6c7;padding-bottom:18px;margin-bottom:3px}
        .contact-form-top span{font-size:10px;letter-spacing:.17em;font-weight:700;color:#294b38}
        .contact-form-top small{font-family:Georgia,serif;font-style:italic;color:#9a8c6d}
        .contact-form label{display:flex;flex-direction:column;gap:8px;font-size:10px;letter-spacing:.06em;color:#596b58}
        .contact-form input,.contact-form textarea{width:100%;box-sizing:border-box;border:1px solid #e1dacb;background:#fffdf7;padding:13px 14px;color:#294b38;font:inherit;font-size:12px;outline:none;resize:vertical;transition:border-color .2s ease,box-shadow .2s ease}
        .contact-form input:focus,.contact-form textarea:focus{border-color:#829078;box-shadow:0 0 0 3px rgba(130,144,120,.12)}
        .contact-form input::placeholder,.contact-form textarea::placeholder{color:#aaa99d}
        .contact-form-row{display:grid;grid-template-columns:1fr 1fr;gap:14px}
        .contact-form .button{align-self:flex-start;display:inline-flex;align-items:center;gap:10px}
        .contact-form-foot{font-size:10px;line-height:1.6;color:#929184}
        @media(max-width:800px){.brand-story{grid-template-columns:1fr;gap:38px}.brand-story-image-wrap{max-width:520px}.brand-story-copy{max-width:650px;margin:0 auto}.contact-layout{grid-template-columns:1fr;max-width:650px}.contact-heading{margin-bottom:35px}}
        @media(max-width:520px){.brand-story{padding:65px 20px}.brand-story-image-wrap{padding:0 20px 22px 0}.brand-story-image{height:390px}.story-image-note{left:-4px;bottom:48px;padding:10px 14px}.story-values{gap:9px}.story-values b{font-size:10px}.story-values small{font-size:9px}.brand-contact{padding:65px 20px}.contact-form-row{grid-template-columns:1fr}.contact-card{padding:17px 14px;gap:12px}.contact-card b{font-size:16px}.contact-form-top{align-items:flex-start;flex-direction:column}}

        /* Botanical hero inspired by the supplied reference */
        .announcement{background:#062d23!important;color:#f4f0df!important;border:0!important}
        .header{background:#062d23!important;color:#fffdf7!important;border-bottom:1px solid rgba(255,255,255,.12)!important}
        .header .brand,.header .nav-link,.header .icon-btn,.header .bag-btn{color:#fffdf7!important}
        .header .nav-link.active:after{background:#c9ad70!important}
       .hero {
  position: relative !important;
  isolation: isolate;
  display: flex !important;
  align-items: center !important;
  min-height: min(760px, calc(100vh - 95px)) !important;
  padding: clamp(70px, 9vw, 125px) clamp(28px, 9vw, 165px) !important;
  overflow: hidden !important;
  background-color: #031d17 !important;
  background-image: url('/images/bg4.jpeg') !important;
  background-position: center !important;
  background-size: cover !important;
}
}!important}
        .hero:before{content:'✦';position:absolute;z-index:-1;right:13%;top:35%;color:#c9ad70;font-size:27px;opacity:.9}
        .hero:after{content:'✦';position:absolute;z-index:-1;left:5%;top:12%;color:#c9ad70;font-size:21px;opacity:.9}
        .hero-copy{position:relative!important;z-index:2!important;width:min(680px,100%)!important;max-width:680px!important;color:#fffdf7!important}
        .hero-copy .eyebrow{color:#e3d9bd!important;letter-spacing:.19em!important;font-size:11px!important}
        .hero-copy .eyebrow span{background:#c9ad70!important}
        .hero-copy h1{font-family:Georgia,'Times New Roman',serif!important;font-size:clamp(64px,9.3vw,150px)!important;font-weight:400!important;line-height:.88!important;letter-spacing:-.055em!important;color:#fffdf7!important;margin:28px 0 34px!important;max-width:760px!important}
        .hero-copy h1 em{font-weight:400!important;color:#fffdf7!important;font-style:italic!important}
        .hero-copy>p{max-width:390px!important;color:rgba(255,253,247,.86)!important;font-size:15px!important;line-height:1.8!important}
        .hero-actions{margin-top:32px!important}
        .hero-actions .button.dark{background:#fffdf7!important;color:#102e24!important;border:1px solid #fffdf7!important;border-radius:0!important;padding:18px 25px!important;letter-spacing:.12em!important;text-transform:uppercase!important;font-size:11px!important}
        .hero-actions .text-link{color:#fffdf7!important}
        .hero-proof{color:rgba(255,253,247,.8)!important;margin-top:45px!important}
        .hero-proof b{color:#fffdf7!important}
        .hero-visual{display:none!important}
        @media(max-width:700px){.hero{min-height:680px!important;padding:75px 25px!important;background-position:58% center!important}.hero-copy h1{font-size:clamp(58px,15vw,96px)!important}.hero-copy>p{font-size:14px!important}.header{flex-wrap:wrap}}

        .story-page{background:#fffdf7;min-height:70vh;color:#294b38}
        .story-page-hero{text-align:center;padding:clamp(65px,9vw,115px) 24px 25px;background:#f5f1e8}
        .story-page-hero .eyebrow{justify-content:center;display:flex;align-items:center;gap:10px;color:#78866d;letter-spacing:.19em;font-size:10px;font-weight:700}
        .story-page-hero h1{font-family:Georgia,'Times New Roman',serif;font-size:clamp(42px,7vw,82px);font-weight:400;line-height:1.05;letter-spacing:-.045em;margin:22px 0 16px;color:#294b38}
        .story-page-hero h1 em,.story-page-values h2 em{color:#9b8968;font-weight:400}
        .story-page-hero p{max-width:560px;margin:0 auto;color:#78816f;font-size:14px;line-height:1.8}
        .story-page-content{padding-top:65px;padding-bottom:75px}
        .story-page-values{padding:75px 8%;background:#f5f1e8;text-align:center}
        .story-page-values>.eyebrow{display:flex;justify-content:center;align-items:center;gap:10px;color:#78866d;letter-spacing:.19em;font-size:10px;font-weight:700}
        .story-page-values h2{font-family:Georgia,'Times New Roman',serif;font-size:clamp(30px,4vw,48px);font-weight:400;color:#294b38;margin:18px 0 35px}
        .story-page-values .story-values{max-width:850px;margin:0 auto;text-align:left}
        @media(max-width:520px){.story-page-hero{padding:60px 20px 25px}.story-page-content{padding-top:45px;padding-bottom:55px}.story-page-values{padding:55px 22px}.story-page-values .story-values{grid-template-columns:1fr;gap:22px}}

        /* PREMIUM OUR STORY PAGE */
        .story-page{background:#f8f5ed!important;color:#203c2d!important;overflow:hidden}
        .story-page-hero{position:relative;min-height:590px;display:grid;grid-template-columns:1.02fr .98fr;align-items:stretch;text-align:left!important;padding:0!important;background:#203c2d!important;color:#fffdf7;overflow:hidden}
        .story-page-hero:before{content:'THE HENNA SHOPE';position:absolute;left:-22px;bottom:18px;font-family:Georgia,serif;font-size:clamp(70px,13vw,190px);white-space:nowrap;color:rgba(255,255,255,.035);letter-spacing:-.07em;pointer-events:none}
        .story-hero-copy{position:relative;z-index:2;display:flex;flex-direction:column;justify-content:center;padding:clamp(55px,8vw,120px) clamp(28px,7vw,105px)}
        .story-page-hero .eyebrow{justify-content:flex-start!important;color:#c6b58e!important;font-size:10px;letter-spacing:.24em;gap:12px}
        .story-page-hero h1{font-size:clamp(52px,7.5vw,104px)!important;line-height:.98!important;letter-spacing:-.055em!important;color:#fffdf7!important;margin:30px 0 25px!important;max-width:650px}
        .story-page-hero h1 em{color:#c6b58e!important}
        .story-page-hero p{margin:0!important;max-width:420px!important;color:rgba(255,253,247,.72)!important;font-size:14px!important;line-height:1.95!important}
        .story-hero-meta{display:flex;align-items:center;gap:16px;margin-top:42px;color:#d4c6a7;font-size:10px;letter-spacing:.18em;text-transform:uppercase}
        .story-hero-meta:before{content:'';width:42px;height:1px;background:#b8a477}
        .story-hero-image{position:relative;min-height:590px;overflow:hidden}
        .story-hero-image img{width:100%;height:100%;position:absolute;inset:0;object-fit:cover;filter:saturate(.72);}
        .story-hero-image:after{content:'';position:absolute;inset:0;background:linear-gradient(90deg,rgba(32,60,45,.28),transparent 48%),linear-gradient(0deg,rgba(22,39,29,.2),transparent 50%)}
        .story-hero-image span{position:absolute;z-index:1;right:28px;bottom:28px;color:#fffdf7;font-size:9px;letter-spacing:.22em;text-transform:uppercase;writing-mode:vertical-rl}
        .story-page-content{padding:clamp(75px,10vw,145px) max(7vw,24px)!important;gap:clamp(45px,8vw,120px)!important;background:#f8f5ed!important}
        .story-page-content .brand-story-image-wrap{max-width:560px}
        .story-page-content .brand-story-image{height:clamp(420px,52vw,650px);border-radius:2px!important;box-shadow:18px 18px 0 #e8e0d0!important}
        .story-page-content .brand-story-image-wrap:after{display:none}
        .story-page-content .story-image-note{border-radius:0!important;box-shadow:0 12px 32px rgba(32,60,45,.12);letter-spacing:.08em;text-transform:uppercase;font-size:9px;padding:15px 19px}
        .story-page-content .story-image-number{color:#9b8968;letter-spacing:.25em}
        .story-page-content .brand-story-copy{max-width:610px}
        .story-page-content .brand-story-copy .eyebrow{color:#9b8968!important;font-size:9px;letter-spacing:.23em}
        .story-page-content .brand-story-copy h2{font-size:clamp(42px,5.4vw,72px)!important;line-height:1.02!important;letter-spacing:-.05em!important;margin:25px 0 30px!important}
        .story-page-content .brand-story-copy>p{font-size:14px;line-height:2.05;color:#6f786b;max-width:530px}
        .story-page-content .brand-story-copy .story-secondary{color:#969486;font-size:13px}
        .story-page-content .story-shop-button{margin-top:24px;border-radius:0!important;padding:17px 24px!important;letter-spacing:.12em;text-transform:uppercase;font-size:10px}
        .story-interlude{padding:clamp(75px,10vw,130px) 24px;text-align:center;background:#e9e3d6;color:#294b38}
        .story-interlude .eyebrow{justify-content:center;display:flex;align-items:center;gap:10px;color:#9b8968;font-size:9px;letter-spacing:.23em;font-weight:700}
        .story-interlude h2{font:400 clamp(34px,5.2vw,66px)/1.12 Georgia,serif;letter-spacing:-.04em;max-width:850px;margin:25px auto 20px}
        .story-interlude h2 em{color:#9b8968;font-weight:400}
        .story-interlude p{max-width:570px;margin:0 auto;color:#78816f;font-size:13px;line-height:1.9}
        .story-page-values{padding:clamp(75px,9vw,120px) max(7vw,24px)!important;background:#203c2d!important;color:#fffdf7!important;text-align:left!important}
        .story-page-values>.eyebrow{justify-content:flex-start!important;color:#c6b58e!important;font-size:9px;letter-spacing:.23em}
        .story-page-values h2{font-size:clamp(36px,5vw,62px)!important;color:#fffdf7!important;text-align:left;margin:22px 0 50px!important;letter-spacing:-.04em}
        .story-page-values h2 em{color:#c6b58e!important}
        .story-page-values .story-values{max-width:none!important;grid-template-columns:repeat(3,minmax(0,1fr));gap:0!important;border-top:1px solid rgba(255,255,255,.2)!important;margin-top:0!important;padding-top:0!important}
        .story-page-values .story-values div{padding:30px 28px 10px 0;border-right:1px solid rgba(255,255,255,.16);margin-right:28px}
        .story-page-values .story-values div:last-child{border:0;margin:0}
        .story-page-values .story-values span{color:#c6b58e;font-size:24px}
        .story-page-values .story-values b{color:#fffdf7;font-size:12px;letter-spacing:.04em}
        .story-page-values .story-values small{color:rgba(255,253,247,.58);font-size:11px;line-height:1.7}
        .story-closing{display:flex;justify-content:space-between;align-items:center;gap:24px;padding:35px max(7vw,24px);background:#f8f5ed;color:#7a806f;font-size:9px;letter-spacing:.18em;text-transform:uppercase}
        .story-closing span:last-child{color:#9b8968}
        @media(max-width:800px){.story-page-hero{grid-template-columns:1fr}.story-hero-copy{padding:80px 8vw 65px}.story-hero-image{min-height:420px}.story-page-values .story-values{grid-template-columns:1fr!important}.story-page-values .story-values div{border-right:0;border-bottom:1px solid rgba(255,255,255,.16);margin:0;padding:24px 0}.story-page-values .story-values div:last-child{border:0}.story-closing{flex-direction:column;align-items:flex-start}}
        @media(max-width:520px){.story-page-hero h1{font-size:clamp(48px,14vw,72px)!important}.story-hero-image{min-height:340px}.story-page-content{padding:65px 22px!important}.story-page-content .brand-story-image{height:390px}.story-interlude{padding:70px 24px}.story-page-values{padding:65px 24px!important}.story-page-values h2{margin-bottom:28px!important}}

        /* FOUNDER STORY PAGE */
        .founder-story-hero{min-height:560px!important;grid-template-columns:1.08fr .92fr!important;background:#203c2d!important}
        .founder-story-hero .story-hero-copy{padding-top:clamp(55px,7vw,95px);padding-bottom:clamp(55px,7vw,95px)}
        .founder-story-hero .story-page-hero h1{max-width:760px}
        .founder-story-hero .story-hero-image{min-height:560px}
        .founder-story-hero .story-hero-image img{object-position:center 35%;filter:saturate(.82)}
        .founder-story-section{padding:clamp(65px,9vw,120px) 24px;background:#f8f5ed;color:#294b38}
        .founder-story-intro{max-width:850px;margin:0 auto;text-align:center}
        .founder-story-kicker{color:#9b8968;font-size:9px;font-weight:700;letter-spacing:.23em}
        .founder-story-intro h2{font:400 clamp(38px,5.5vw,68px)/1.06 Georgia,serif;letter-spacing:-.045em;margin:22px 0;color:#294b38}
        .founder-story-intro h2 em{color:#9b8968;font-weight:400}
        .founder-story-lead{font:italic clamp(17px,2vw,21px)/1.7 Georgia,serif;color:#78816f;margin:0 auto;max-width:650px}
        .founder-story-facts{max-width:960px;margin:54px auto 64px;display:grid;grid-template-columns:repeat(3,minmax(0,1fr));border-top:1px solid #ded7c9;border-bottom:1px solid #ded7c9}
        .founder-story-facts div{display:flex;flex-direction:column;gap:8px;padding:24px 18px;text-align:center;border-right:1px solid #ded7c9}
        .founder-story-facts div:last-child{border-right:0}
        .founder-story-facts strong{font:400 clamp(25px,3vw,34px) Georgia,serif;color:#9b8968}
        .founder-story-facts span{font-size:10px;letter-spacing:.08em;color:#78816f;text-transform:uppercase}
        .founder-story-article{max-width:760px;margin:0 auto;color:#687467}
        .founder-story-article p{font-size:15px;line-height:2.05;margin:0 0 22px}
        .founder-memory-gallery{max-width:1050px;margin:46px auto 58px;display:grid;grid-template-columns:1.15fr .85fr;grid-template-rows:230px 230px;gap:14px}
        .founder-memory-photo{position:relative;min-width:0;min-height:0;margin:0;overflow:hidden;background:#e9e3d6;box-shadow:0 14px 35px rgba(32,60,45,.10)}
        .founder-memory-photo img{display:block;width:100%;height:100%;object-fit:cover;transition:transform .65s ease}
        .founder-memory-photo:hover img{transform:scale(1.045)}
        .founder-memory-photo:after{content:'';position:absolute;inset:35% 0 0;background:linear-gradient(180deg,transparent,rgba(21,37,28,.72));pointer-events:none}
        .founder-memory-photo figcaption{position:absolute;z-index:1;left:20px;right:16px;bottom:17px;color:#fffdf7;font:italic 18px Georgia,serif;letter-spacing:.01em}
        .founder-memory-photo-main{grid-row:1 / span 2}
        .founder-memory-photo-main img{object-position:center}
        .founder-memory-photo-side figcaption{font-size:15px}
        .founder-story-article h3{font:400 clamp(27px,3vw,35px) Georgia,serif;color:#294b38;margin:48px 0 20px}
        .founder-story-signoff{margin-top:48px;padding:34px 38px;background:#eee8dc;border-left:3px solid #b8a477;color:#294b38}
        .founder-story-signoff p{font:italic 20px/1.6 Georgia,serif;margin:0 0 7px;color:#294b38}
        .founder-story-signoff span{display:block;margin-top:25px;font-size:13px;color:#7a806f}
        .founder-story-signoff strong{display:block;margin-top:6px;font:400 27px Georgia,serif;color:#294b38}
        .founder-story-signoff small{display:block;margin-top:9px;font-size:11px;line-height:1.8;color:#7a806f}
        .founder-story-continue{padding:clamp(65px,8vw,100px) 24px;text-align:center;background:#203c2d;color:#fffdf7}
        .founder-story-continue>span{font-size:9px;letter-spacing:.24em;color:#c6b58e;font-weight:700}
        .founder-story-continue h2{font:400 clamp(38px,5.3vw,64px)/1.08 Georgia,serif;margin:22px 0 28px;color:#fffdf7}
        .founder-story-continue h2 em{color:#c6b58e}
        .founder-story-continue .button{display:inline-flex;align-items:center;gap:10px}
        @media(max-width:800px){.founder-story-hero{grid-template-columns:1fr!important}.founder-story-hero .story-hero-image{min-height:390px}.founder-story-facts{margin:40px auto 48px}}
        @media(max-width:800px){.founder-memory-gallery{grid-template-rows:190px 190px;gap:10px;margin:38px auto 48px}}
        @media(max-width:520px){.founder-story-section{padding:60px 22px}.founder-story-facts{grid-template-columns:1fr;margin:34px auto 42px}.founder-story-facts div{border-right:0;border-bottom:1px solid #ded7c9;padding:17px}.founder-story-facts div:last-child{border-bottom:0}.founder-story-article p{font-size:14px;line-height:1.95}.founder-story-signoff{padding:25px 22px}.founder-story-hero .story-hero-image{min-height:330px}.founder-memory-gallery{grid-template-columns:1fr 1fr;grid-template-rows:260px 145px;margin:32px auto 42px;gap:9px}.founder-memory-photo-main{grid-column:1 / -1;grid-row:1}.founder-memory-photo-side{grid-row:2}.founder-memory-photo figcaption{left:12px;right:10px;bottom:11px;font-size:14px}.founder-memory-photo-side figcaption{font-size:12px}}

        /* FOUNDER STORY: EDITORIAL TWO-COLUMN LAYOUT WITH PHOTOGRAPHS ON THE RIGHT */
        .founder-story-intro{max-width:900px;margin-bottom:20px}
        .founder-story-intro h2{font-size:clamp(40px,5.4vw,70px)}
        .founder-story-facts{max-width:1180px;margin:46px auto 62px}
        .founder-story-layout{max-width:1240px;margin:0 auto;display:grid;grid-template-columns:minmax(0,1.08fr) minmax(340px,.92fr);gap:clamp(38px,6vw,88px);align-items:start}
        .founder-story-layout .founder-story-article{max-width:none;margin:0;min-width:0}
        .founder-story-layout .founder-story-article p{font-size:15px;line-height:2.05;margin-bottom:24px}
        .founder-story-layout .founder-story-article h3{margin:42px 0 17px;font-size:clamp(28px,3vw,36px)}
        .founder-story-visuals{position:sticky;top:34px;min-width:0;padding:12px 12px 0 0}
        .founder-story-photo-main{position:relative;height:clamp(400px,48vw,610px);overflow:hidden;background:#e9e3d6;box-shadow:18px 18px 0 #e8e0d0}
        .founder-story-photo-main:before{content:'';position:absolute;inset:12px;border:1px solid rgba(255,253,247,.55);z-index:1;pointer-events:none}
        .founder-story-photo-main img{display:block;width:100%;height:100%;object-fit:cover;object-position:center;transition:transform .8s ease}
        .founder-story-photo-main:hover img,.founder-story-photo-pair figure:hover img{transform:scale(1.045)}
        .founder-photo-label{position:absolute;left:28px;bottom:30px;z-index:2;color:#fffdf7;font:italic clamp(21px,2.5vw,30px) Georgia,serif;text-shadow:0 2px 15px rgba(0,0,0,.25)}
        .founder-photo-index{position:absolute;right:27px;top:28px;z-index:2;color:#fffdf7;font-size:9px;letter-spacing:.2em;writing-mode:vertical-rl}
        .founder-story-photo-pair{display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-top:28px}
        .founder-story-photo-pair figure{position:relative;height:190px;margin:0;overflow:hidden;background:#e9e3d6}
        .founder-story-photo-pair img{display:block;width:100%;height:100%;object-fit:cover;transition:transform .7s ease}
        .founder-story-photo-pair figure:after{content:'';position:absolute;inset:45% 0 0;background:linear-gradient(transparent,rgba(21,37,28,.68));pointer-events:none}
        .founder-story-photo-pair figcaption{position:absolute;z-index:1;left:14px;right:10px;bottom:13px;color:#fffdf7;font:italic 15px Georgia,serif}
        .founder-story-visual-note{display:flex;align-items:center;gap:11px;margin:27px 0 0;padding:15px 18px;background:#eee8dc;color:#596b58;font-size:10px;letter-spacing:.1em;text-transform:uppercase}
        .founder-story-visual-note span{color:#9b8968;font-size:18px}
        /* Additional image panel fills the lower portion of the story's right column. */
        .founder-story-more{margin-top:28px;padding:23px;background:#203c2d;color:#fffdf7;box-shadow:0 16px 38px rgba(32,60,45,.12)}
        .founder-story-more-head{display:flex;align-items:flex-end;justify-content:space-between;gap:12px;margin-bottom:17px}
        .founder-story-more-head span{display:block;color:#c6b58e;font-size:9px;font-weight:700;letter-spacing:.2em;text-transform:uppercase}
        .founder-story-more-head h3{margin:7px 0 0;color:#fffdf7;font:400 clamp(23px,2.6vw,31px)/1.1 Georgia,serif}
        .founder-story-more-head small{color:rgba(255,253,247,.55);font-size:9px;letter-spacing:.12em;text-transform:uppercase;white-space:nowrap}
        .founder-story-more-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:11px}
        .founder-story-more-grid figure{position:relative;height:clamp(132px,14vw,178px);min-width:0;margin:0;overflow:hidden;background:#536653}
        .founder-story-more-grid img{display:block;width:100%;height:100%;object-fit:cover;transition:transform .7s ease}
        .founder-story-more-grid figure:hover img{transform:scale(1.06)}
        .founder-story-more-grid figure:after{content:'';position:absolute;inset:35% 0 0;background:linear-gradient(180deg,transparent,rgba(13,28,20,.72));pointer-events:none}
        .founder-story-more-grid figcaption{position:absolute;z-index:1;left:12px;right:9px;bottom:11px;color:#fffdf7;font:italic 14px Georgia,serif;line-height:1.25}
        .founder-story-more-foot{display:flex;align-items:center;gap:9px;margin-top:16px;padding-top:14px;border-top:1px solid rgba(255,255,255,.18);color:rgba(255,253,247,.67);font-size:9px;letter-spacing:.14em;text-transform:uppercase}
        .founder-story-more-foot:before{content:'';width:24px;height:1px;background:#c6b58e}
        .founder-story-layout .founder-story-signoff{margin-top:42px}
        /* Center the founder's closing signature across the full story section. */
        .founder-story-signoff-centered{max-width:680px;margin:64px auto 8px!important;padding:6px 30px;text-align:center;border-left:0!important;border-top:2px solid #b8a477;box-shadow:0 14px 36px rgba(32,60,45,.07)}
        .founder-story-signoff-centered p{font-size:clamp(22px,3vw,30px);margin-bottom:8px}
        .founder-story-signoff-centered span{margin-top:24px!important;letter-spacing:.12em;text-transform:uppercase;font-size:10px!important}
        .founder-story-signoff-centered strong{font-size:clamp(29px,3.3vw,38px)!important}
        @media(max-width:520px){.founder-story-signoff-centered{margin:42px auto 4px!important;padding:30px 20px}}
        @media(max-width:900px){.founder-story-layout{grid-template-columns:1fr;max-width:760px}.founder-story-visuals{position:relative;top:auto;order:-1;width:100%;padding:0 12px 0 0}.founder-story-photo-main{height:clamp(360px,70vw,560px)}.founder-story-photo-pair figure{height:clamp(150px,30vw,210px)}}
        @media(max-width:900px){.founder-story-more{padding:20px}.founder-story-more-grid figure{height:clamp(150px,28vw,220px)}}
        @media(max-width:520px){.founder-story-more{margin-top:20px;padding:16px}.founder-story-more-grid{gap:9px}.founder-story-more-grid figure{height:145px}.founder-story-more-head{align-items:flex-start}}
        @media(max-width:520px){.founder-story-facts{margin:34px auto 42px}.founder-story-layout{gap:36px}.founder-story-visuals{padding-right:8px}.founder-story-photo-main{height:390px;box-shadow:10px 10px 0 #e8e0d0}.founder-story-photo-pair{gap:9px;margin-top:17px}.founder-story-photo-pair figure{height:145px}.founder-story-photo-pair figcaption{font-size:12px;left:10px;bottom:10px}.founder-story-visual-note{margin-top:19px;padding:13px;font-size:9px}.founder-story-layout .founder-story-article p{font-size:14px;line-height:1.95}}


        /* MOBILE HAMBURGER MENU (sign in / sign up / profile live inside it) */
        @media(min-width:701px){.mobile-menu{display:none!important}}
        @media(max-width:700px){
          .header .mobile-toggle{display:grid!important}
          .header-actions .customer-auth-actions,.header-actions .profile-menu-wrapper{display:none!important}
          .mobile-menu{position:absolute;top:100%;left:0;right:0;z-index:999;display:flex;flex-direction:column;gap:2px;padding:10px 6% 18px;background:#fffdf7;border-bottom:1px solid #e7e1d3;box-shadow:0 14px 30px rgba(31,57,43,.14)}
          .mobile-menu-link{border:0;background:none;text-align:left;padding:14px 4px;font-size:14px;color:#294b38;border-bottom:1px solid #eee9dc}
          .mobile-menu-account{display:grid;gap:10px;margin-top:14px}
          .mobile-menu-account .button{width:100%;padding:13px}
          .mobile-menu-user{display:flex;align-items:center;gap:12px;padding:4px 0 6px}
          .mobile-menu-user strong{display:block;font-size:13px;color:#1f392b}
          .mobile-menu-user small{display:block;font-size:11px;color:#827f70;overflow-wrap:anywhere}
          .mobile-menu-avatar{width:38px;height:38px;flex:0 0 38px;border-radius:50%;display:grid;place-items:center;background:#294b38;color:#fffdf7;font:600 17px 'Playfair Display',serif;text-transform:uppercase}
        }
      `}</style>

      {/* ANNOUNCEMENT */}



      {/* HEADER */}

      <header className="header">

        <a
          className="brand"
          href="#"
          onClick={(e) => {
            e.preventDefault();
            setPage('home');
          }}
        >
          <img className="brand-emblem" src="/images/henna-shope-logo2.png" alt="The Henna Shope logo" />

          <span>
            The Henna
            <span className="brand-amp"> </span>
            Shope
            <small>THE ART OF NATURAL HENNA</small>
          </span>
        </a>

        <nav className={mobileOpen ? 'nav nav-open' : 'nav'}>

          <button
            className={page === 'home' ? 'nav-link active' : 'nav-link'}
            onClick={() => {
              setPage('home');
              setMobileOpen(false);
            }}
          >
            Home
          </button>

          <button
            className={page === 'shop' ? 'nav-link active' : 'nav-link'}
            onClick={() => {
              goShop();
              setMobileOpen(false);
            }}
          >
            Shop all
          </button>

          <button
            className={page === 'story' ? 'nav-link active' : 'nav-link'}
            onClick={() => {
              setPage('story');
              setMobileOpen(false);
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
          >
            Our story
          </button>

          <button
            className="nav-link"
            type="button"
            onClick={goContact}
          >
            Contact
          </button>

        </nav>

        <div className="header-actions">

          <button
            className="icon-btn search-trigger"
            onClick={goShop}
            aria-label="Search"
          >
            <Search />
          </button>

          <button
            className="bag-btn"
            onClick={handleCartClick}
          >
            <ShoppingBag size={19} />
            <span>Bag</span>
            <b>{count}</b>
          </button>

          {customerUser ? (
            <div
              className="profile-menu-wrapper"
              style={{ position: 'relative' }}
            >
              <button
                type="button"
                className="profile-avatar"
                title={customerUser.name || 'My profile'}
                aria-label={`Profile of ${customerUser.name || 'customer'}`}
                aria-expanded={profileMenuOpen}
                onClick={() => setProfileMenuOpen((open) => !open)}
                style={{
                  width: '38px',
                  height: '38px',
                  borderRadius: '50%',
                  border: '1px solid #294b38',
                  background: '#294b38',
                  color: '#fffdf7',
                  fontFamily: 'Playfair Display, serif',
                  fontSize: '17px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'grid',
                  placeItems: 'center',
                  textTransform: 'uppercase',
                }}
              >
                {customerUser.name?.trim()?.charAt(0) || 'U'}
              </button>

              {profileMenuOpen && (
                <div
                  className="profile-dropdown"
                  style={{
                    position: 'absolute',
                    top: 'calc(100% + 12px)',
                    right: 0,
                    width: '190px',
                    padding: '14px',
                    background: '#fffdf7',
                    border: '1px solid #e7e1d3',
                    boxShadow: '0 12px 30px rgba(31, 57, 43, 0.14)',
                    zIndex: 1000,
                  }}
                >
                  <div style={{ padding: '4px 6px 12px', borderBottom: '1px solid #e7e1d3', marginBottom: '10px' }}>
                    <strong style={{ display: 'block', color: '#1f392b', fontSize: '13px' }}>
                      {customerUser.name}
                    </strong>
                    <span style={{ display: 'block', color: '#827f70', fontSize: '11px', marginTop: '4px', overflowWrap: 'anywhere' }}>
                      {customerUser.email}
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={handleCustomerLogout}
                    style={{
                      width: '100%',
                      border: 0,
                      background: 'transparent',
                      color: '#294b38',
                      padding: '9px 6px',
                      textAlign: 'left',
                      font: 'inherit',
                      fontSize: '12px',
                      cursor: 'pointer',
                    }}
                  >
                    Log out
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="customer-auth-actions" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <button
                type="button"
                className="button outline"
                onClick={() => navigate('/login')}
              >
                Sign in
              </button>
              <button
                type="button"
                className="button dark"
                onClick={() => navigate('/signup')}
              >
                Sign up
              </button>
            </div>
          )}

          {/* HAMBURGER (visible on mobile only) */}
          <button
            className="icon-btn mobile-toggle"
            onClick={() => setMobileOpen(!mobileOpen)}
            aria-label="Menu"
            aria-expanded={mobileOpen}
          >
            {mobileOpen ? <X /> : <Menu />}
          </button>

        </div>

        {/* MOBILE MENU: page links + sign in / sign up / profile */}
        {mobileOpen && (
          <div className="mobile-menu">
            <button
              className="mobile-menu-link"
              onClick={() => {
                setPage('home');
                setMobileOpen(false);
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
            >
              Home
            </button>
            <button
              className="mobile-menu-link"
              onClick={() => {
                goShop();
                setMobileOpen(false);
              }}
            >
              Shop all
            </button>
            <button
              className="mobile-menu-link"
              onClick={() => {
                setPage('story');
                setMobileOpen(false);
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
            >
              Our story
            </button>
            <button className="mobile-menu-link" onClick={goContact}>
              Contact
            </button>

            <div className="mobile-menu-account">
              {customerUser ? (
                <>
                  <div className="mobile-menu-user">
                    <span className="mobile-menu-avatar">
                      {customerUser.name?.trim()?.charAt(0) || 'U'}
                    </span>
                    <div>
                      <strong>{customerUser.name}</strong>
                      <small>{customerUser.email}</small>
                    </div>
                  </div>
                  <button
                    className="button outline"
                    type="button"
                    onClick={handleCustomerLogout}
                  >
                    Log out
                  </button>
                </>
              ) : (
                <>
                  <button
                    className="button outline"
                    type="button"
                    onClick={() => {
                      setMobileOpen(false);
                      navigate('/login');
                    }}
                  >
                    Sign in
                  </button>
                  <button
                    className="button dark"
                    type="button"
                    onClick={() => {
                      setMobileOpen(false);
                      navigate('/signup');
                    }}
                  >
                    Sign up
                  </button>
                </>
              )}
            </div>
          </div>
        )}

      </header>

      {/* MAIN CONTENT */}

      {page === 'home' ? (

        <main>

          {/* HERO */}

          <section className="hero">

            <div className="hero-copy">

              <div className="eyebrow">
                <span></span>
                ROOTED IN NATURE, MADE WITH LOVE
              </div>

              <h1>
                A space
                <br />
                <em>for </em> everything 
                <br />
                beautiful.
              </h1>

              <p>
                Celebrate your moments with the timeless art of henna.
                Thoughtfully crafted, naturally beautiful, and made
                for your hands.
              </p>

              <div className="hero-actions">

                <button className="button dark" onClick={goShop}>
                  Explore the collection
                  <ArrowRight size={17} />
                </button>

                <button
                  type="button"
                  className="text-link"
                  onClick={() => {
                    setPage('story');
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  }}
                >
                  Discover our story <span>↗</span>
                </button>

              </div>

              <div className="hero-proof">

                <div className="proof-avatars">
                  <i>✿</i>
                  <i>❋</i>
                  <i>✾</i>
                </div>

                <span>
                  Loved by <b>25,000+</b> henna enthusiasts
                </span>

              </div>

            </div>

            <div className="hero-visual">

              <div className="hero-image">

                <img
                  src="https://images.unsplash.com/photo-1602874801007-bd458bb1b8b6?auto=format&fit=crop&w=1200&q=90"
                  alt="Natural henna and botanical ingredients"
                />

                <div className="image-stamp">
                  100%
                  <br />
                  <small>NATURAL</small>
                </div>

              </div>

              <div className="floating-note">
                <span>✳</span>

                <div>
                  <b>Made with intention</b>
                  <small>Pure ingredients. Beautiful results.</small>
                </div>
              </div>

              <div className="vertical-label">
                THE NATURAL HENNA EDITION · EST. 2024
              </div>

            </div>

          </section>

          {/* TRUST STRIP */}

          <section className="trust-strip">

            <div>
              <Leaf />
              <span>Plant-powered ingredients</span>
            </div>

            <div>
              <Sparkles />
              <span>Freshly made with care</span>
            </div>

            <div>
              <ShieldCheck />
              <span>Quality you can trust</span>
            </div>

            <div>
              <Package />
              <span>Packed with love</span>
            </div>

          </section>



          {/* COLLECTION */}

          <section
            className="section collection"
            id="collection"
          >

            <div className="section-heading">

              <div>
                <div className="eyebrow">
                  A LITTLE SOMETHING FOR YOU
                </div>

                <h2>
                  Made for your <em>moments.</em>
                </h2>
              </div>

              <button
                className="text-link"
                onClick={goShop}
              >
                Shop the collection
                <ArrowRight size={16} />
              </button>

            </div>

            {loading ? (
              <ProductLoading />
            ) : error ? (
              <ProductError />
            ) : customCategories.length === 0 ? (
              <p className="empty">No categories available yet.</p>
            ) : (
              <>
                <div className="home-category-grid">
                  {customCategories.slice(0, 3).map((item, index) => {
                    // These are fixed homepage category images. They must not
                    // be taken from product records, so adding/editing products
                    // will never change the homepage category artwork.
                    const categoryImages = [
                      '/images/cat1.jpeg',
                      'https://images.unsplash.com/photo-1608571423902-eed4a5ad8108?auto=format&fit=crop&w=1400&q=85',
                      '/images/cat2.jpeg'
                    ];

                    return (
                      <button
                        type="button"
                        className={`home-category-card home-category-card-${index + 1}`}
                        key={item}
                        onClick={() => {
                          setCategory(item);
                          setQuery('');
                          goShop();
                        }}
                        style={{ backgroundImage: `linear-gradient(0deg, rgba(16, 34, 25, .72), rgba(16, 34, 25, .02) 72%), url("${categoryImages[index]}")` }}
                      >
                        <span className="home-category-kicker">{item}</span>
                        <span className="home-category-title">Explore <span aria-hidden="true">↗</span></span>
                      </button>
                    );
                  })}
                </div>

                <div className="home-category-more">
                  <button type="button" onClick={() => { setCategory('All'); setQuery(''); goShop(); }}>
                    Explore all categories <ArrowRight size={15} />
                  </button>
                </div>
              </>
            )}

          </section>


          {/* MEHNDI ARTISTRY SERVICE PROMO */}
          <section className="mehndi-service-promo" id="mehndi-artistry">
            <div className="mehndi-service-copy">
              <div className="eyebrow">BEAUTY FOR YOUR SPECIAL MOMENTS</div>
              <h2>More than henna.<br /><em>It's artistry.</em></h2>
              <p>
                Make your celebrations unforgettable with custom mehndi designs,
                natural henna, and experienced artistry for every occasion.
              </p>
              <ul className="mehndi-service-list">
                <li>Bridal & wedding mehndi</li>
                <li>Engagements and celebrations</li>
                <li>Festivals, baby showers & special occasions</li>
                <li>We travel across Kannur & Calicut</li>
              </ul>
              <button className="button dark" type="button" onClick={bookMehndiArtist}>
                Book your mehndi artist <ArrowRight size={17} />
              </button>
            </div>
            <div className="mehndi-gallery">
              <div className="mehndi-gallery-main">
                <img src="/images/henna1.jpeg" alt="Mehndi design 1" />
              </div>

              <div className="mehndi-gallery-side">
                <img src="/images/henna2.jpeg" alt="Mehndi design 2" />
                <img src="/images/henna3.jpeg" alt="Mehndi design 3" />
              </div>
            </div>
          </section>

          {/* QUOTE */}

          <section className="quote">
            <span>“</span>

            <p>
              Every little swirl tells a story.
              <br />
              <em>Make yours beautiful.</em>
            </p>

            <small>THE HENNA SHOPE PROMISE</small>
          </section>

          {/* CONTACT */}
          <section className="brand-contact" id="contact">
            <div className="contact-heading">
              <div className="eyebrow"><span className="story-eyebrow-dot" /> WE'RE HERE FOR YOU</div>
              <h2>Let's make something<br /><em>beautiful together.</em></h2>
              <p>Questions about an order, a product, or simply want to say hello? Send us a message. We'd love to hear from you.</p>
            </div>

            <div className="contact-layout">
              <div className="contact-details">
                <a className="contact-card" href={`https://wa.me/${(import.meta.env.VITE_WHATSAPP_NUMBER || '').replace(/\D/g, '')}`} target="_blank" rel="noreferrer">
                  <span className="contact-icon"><MessageCircle size={21} /></span>
                  <span><small>QUICKEST WAY TO REACH US</small><b>Chat on WhatsApp</b><em>Let's talk about what you need</em></span>
                  <ArrowRight size={18} className="contact-arrow" />
                </a>
                <a className="contact-card" href="https://www.instagram.com/" target="_blank" rel="noreferrer">
                  <span className="contact-icon"><Instagram size={21} /></span>
                  <span><small>FOLLOW OUR JOURNEY</small><b>Find us on Instagram</b><em>Henna inspiration and little updates</em></span>
                  <ArrowRight size={18} className="contact-arrow" />
                </a>
                <div className="contact-note"><Leaf size={19} /><p><b>A little note</b><br />We aim to make every interaction as thoughtful as the products we share. Thank you for supporting our little store.</p></div>
              </div>

              <form className="contact-form" onSubmit={(e) => {
                e.preventDefault();
                const form = new FormData(e.currentTarget);
                const phone = (import.meta.env.VITE_WHATSAPP_NUMBER || '').replace(/\D/g, '');
                if (!phone || phone.includes('XXXXXXXXXX')) {
                  Swal.fire({ title: 'WhatsApp number not configured', text: 'Please contact the store owner to configure VITE_WHATSAPP_NUMBER.', icon: 'info', confirmButtonColor: '#294b38', background: '#fffdf7', color: '#294b38' });
                  return;
                }
                const message = `Hello! I have an enquiry from The Henna Shope website.\nName: ${form.get('contactName')}\nEmail: ${form.get('contactEmail')}\nSubject: ${form.get('contactSubject')}\nMessage: ${form.get('contactMessage')}`;
                window.open(`https://wa.me/${phone}?text=${encodeURIComponent(message)}`, '_blank', 'noopener,noreferrer');
                e.currentTarget.reset();
              }}>
                <div className="contact-form-top"><span>DROP US A LINE</span><small>We'd love to hear from you ✿</small></div>
                <div className="contact-form-row">
                  <label>Your name<input name="contactName" placeholder="Your name" required /></label>
                  <label>Email address<input name="contactEmail" type="email" placeholder="you@example.com" required /></label>
                </div>
                <label>What's this about?<input name="contactSubject" placeholder="Order enquiry, product question..." required /></label>
                <label>Your message<textarea name="contactMessage" rows="4" placeholder="Tell us a little more..." required /></label>
                <button className="button dark" type="submit">Send us a message <ArrowRight size={17} /></button>
                <small className="contact-form-foot">Your message will open in WhatsApp so you can send it directly to our team.</small>
              </form>
            </div>
          </section>

        </main>

      ) : page === 'story' ? (

        <main className="story-page" id="our-story-page">
          <section className="story-page-hero founder-story-hero">
            <div className="story-hero-copy">
              <div className="eyebrow"><span className="story-eyebrow-dot" /> MY JOURNEY</div>
              <h1>The Story Behind<br /><em>Naila’s Henna Studio</em></h1>
              <p>By Sajila Anees <span aria-hidden="true">|</span> Founder</p>
              <div className="story-hero-meta">A journey of passion, patience &amp; dreams</div>
            </div>
            <div className="story-hero-image">
              <img src="/images/henna1.jpeg" alt="Traditional henna artistry created with care" />
              <span>01 — MY BEGINNING</span>
            </div>
          </section>

          <section className="founder-story-section">
            <div className="founder-story-intro">
              <span className="founder-story-kicker">MY JOURNEY · BY SAJILA ANEES</span>
              <h2>A passion<br /><em>that became a journey.</em></h2>
              <p className="founder-story-lead">Every big dream has a small beginning. Mine began with a simple love for henna.</p>
            </div>

            <div className="founder-story-facts" aria-label="Naila’s Henna Studio at a glance">
              <div><strong>2019</strong><span>Where the journey began</span></div>
              <div><strong>20,000+</strong><span>Customers in our community</span></div>
              <div><strong>India · USA · UK</strong><span>A growing global community</span></div>
            </div>

            <div className="founder-story-layout">
              <article className="founder-story-article">
                <p>I’m Sajila Anees, the founder of Naila’s Henna Studio, based in Kannur, Kerala.</p>

                <p>Long before I thought of turning henna into a business, it was something I genuinely loved doing. I used to apply mehndi to my cousins and friends. What started as a hobby slowly became a passion. I loved creating designs, and seeing the happiness a little henna could bring to someone.</p>

                <p>Meanwhile, my educational journey took a different direction. I completed my degree and pursued other medical-related courses. But even while studying, my love for henna never faded. It was something I always found myself coming back to.</p>

                <h3>Taking my first step</h3>
                <p>In 2019, I decided to take my passion one step further. I started selling henna cones, which marked the beginning of my journey as an entrepreneur.</p>

                <p>I started small, with a lot of enthusiasm and plenty of things to learn. From understanding henna quality and preparation to improving products and connecting with customers, every step became a learning experience.</p>

                <p>What began with selling cones gradually grew into something much bigger. I expanded into different henna products and essentials, began serving fellow artists and customers, and worked towards building a brand that people could trust.</p>

                <p>Of course, the journey wasn’t always easy. There were challenges, uncertainties and countless lessons along the way. But every order, every returning customer and every appreciation gave me the motivation to keep moving forward.</p>

                <p>Years of dedication and consistency slowly turned my little beginning into Naila’s Henna Studio.</p>

                <h3>Growing together</h3>
                <p>Today, we serve customers across India and reach henna lovers internationally, including the USA and UK. With a growing community of more than 20,000 customers, our journey has taken us further than I ever imagined.</p>

                <p>One of my most special milestones was opening my own henna studio in Irinavu, Kannur. I have also had opportunities to conduct learning sessions, connect with fellow henna artists and participate in wonderful henna events.</p>

                <p>When I look back, I feel grateful for every stage of this journey — from applying mehndi to my cousins and friends to building a brand of my own.</p>

                <p>I didn’t have everything figured out when I started. I just had a passion, a dream and the courage to take the first step.</p>

                <p>And today, I’m proud of how far that little beginning has brought me.</p>

              </article>

              <aside className="founder-story-visuals" aria-label="A glimpse into Naila’s Henna Studio">
                <div className="founder-story-photo-main">
                  <img src="/images/henna1.jpeg" alt="Beautiful detailed henna artwork" loading="lazy" />
                  <span className="founder-photo-label">A passion turned into art</span>
                  <span className="founder-photo-index">01 / THE ART</span>
                </div>
                <div className="founder-story-photo-pair">
                  <figure>
                    <img src="/images/henna2.jpeg" alt="Intricate mehndi design detail" loading="lazy" />
                    <figcaption>Made with patience</figcaption>
                  </figure>
                  <figure>
                    <img src="/images/henna3.jpeg" alt="Henna artistry from the studio" loading="lazy" />
                    <figcaption>Shared with love</figcaption>
                  </figure>
                </div>
                <div className="founder-story-visual-note"><span>✳</span> Rooted in Kannur. Loved everywhere.</div>

                <section className="founder-story-more" aria-label="More from Naila’s Henna Studio">
                  <div className="founder-story-more-head">
                    <div>
                      <span>A little more to explore</span>
                      <h3>From our studio</h3>
                    </div>
                    <small>02 — 05</small>
                  </div>
                  <div className="founder-story-more-grid">
  {[
    {
      image: '/images/story2.jpeg',
      caption: 'The art of henna'
    },
    {
      image: '/images/story1.jpeg',
      caption: 'Beautiful details'
    },
  ].map((photo, index) => (
    <figure key={index}>
      <img
        src={photo.image}
        alt={photo.caption}
        loading="lazy"
      />
      <figcaption>{photo.caption}</figcaption>
    </figure>
  ))}
</div>
                  <div className="founder-story-more-foot">Crafted with care · Shared with love</div>
                </section>
              </aside>
            </div>

            <div className="founder-story-signoff founder-story-signoff-centered">
              <p>And our journey continues…</p>
              <span>With love,</span>
              <strong>Sajila Anees</strong>
            </div>
          </section>

          <section className="founder-story-continue">
            <span>NAILA’S HENNA STUDIO</span>
            <h2>Join Our<br /><em>Journey</em></h2>
            <button className="button dark story-shop-button" type="button" onClick={goShop}>Explore our collection <ArrowRight size={17} /></button>
          </section>
        </main>
      ) : (

        /* SHOP PAGE */

        <main className="shop-page">

          <div className="shop-top">

            <div className="eyebrow">
              THE COLLECTION
            </div>

            <h1>
              Find your <em>kind of beautiful.</em>
            </h1>

            <p>
              Natural henna essentials for every celebration and everyday ritual.
            </p>

          </div>

          <div className="shop-toolbar">

            <div className="filters">

              {categories.map((c) => (
                <button
                  key={c}
                  onClick={() => setCategory(c)}
                  className={
                    category === c
                      ? 'filter active'
                      : 'filter'
                  }
                >
                  {c}
                </button>
              ))}

            </div>

            <label className="search-box">

              <Search size={17} />

              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search products"
              />

            </label>

          </div>

          {loading ? (
            <ProductLoading />
          ) : error ? (
            <ProductError />
          ) : (

            <div className="product-grid shop-grid">

              {shown.map((p) => (
                <ProductCard
                  key={p.id}
                  p={p}
                  add={add}
                />
              ))}

            </div>

          )}

          {!loading && !error && shown.length === 0 && (
            <div className="empty">
              No products found. Try another search.
            </div>
          )}

        </main>

      )}

      {/* FOOTER */}

      <footer className="footer">

        <div className="footer-brand">

          <a
            className="brand"
            href="#"
            onClick={(e) => {
              e.preventDefault();
              setPage('home');
            }}
          >
            <img className="brand-emblem" src="/images/henna-shope-logo2.png" alt="The Henna Shope logo" />

            <span>
              The Henna Shope
              <small>THE ART OF NATURAL HENNA</small>
            </span>
          </a>

          <p>
            Rooted in nature. Made for your moments.
          </p>

        </div>

        <div>
          <b>Explore</b>
          <a onClick={goShop}>Shop all</a>
          <a
            href="#our-story-page"
            onClick={(e) => {
              e.preventDefault();
              setPage('story');
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
          >Our story</a>
          <a href="#contact" onClick={(e) => { e.preventDefault(); goContact(); }}>Contact us</a>
        </div>

        <div>
          <b>Need help?</b>
          <a href="#contact" onClick={(e) => { e.preventDefault(); goContact(); }}>FAQs</a>
          <a href="#contact" onClick={(e) => { e.preventDefault(); goContact(); }}>Shipping &amp; returns</a>
          <a href="#contact" onClick={(e) => { e.preventDefault(); goContact(); }}>Care guide</a>
        </div>

        <div>
          <b>Follow along</b>
          <a href="#contact" onClick={(e) => { e.preventDefault(); goContact(); }}>
            <Instagram size={15} /> Instagram
          </a>
          <a href="#contact" onClick={(e) => { e.preventDefault(); goContact(); }}>
            <MessageCircle size={15} /> WhatsApp
          </a>
        </div>

        <div className="copyright">
          © 2026 The Henna Shope. All rights reserved.
          <span>Made with ♥</span>
        </div>

      </footer>

      {/* CART DRAWER */}

      {cartOpen && (

        <div
          className="overlay"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) {
              setCartOpen(false);
            }
          }}
        >

          <aside className="cart-drawer">

            <div className="drawer-head">

              <div>
                <div className="eyebrow">
                  YOUR LITTLE TREASURES
                </div>

                <h2>
                  Your bag <span>({count})</span>
                </h2>
              </div>

              <button
                className="icon-btn"
                onClick={() => setCartOpen(false)}
              >
                <X />
              </button>

            </div>

            {cart.length ? (

              <>

                <div className="cart-items">

                  {cart.map((i) => (

                    <div
                      className={`cart-item ${i.inStock === false || i.isAvailable === false ? 'cart-item-out-of-stock' : ''}`}
                      key={i.cartKey || i.id}
                      aria-disabled={i.inStock === false || i.isAvailable === false}
                      style={i.inStock === false || i.isAvailable === false ? {
                        opacity: 0.48,
                        filter: 'grayscale(1)',
                        cursor: 'not-allowed',
                      } : undefined}
                    >

                      <img src={i.image} alt={i.name} />

                      <div className="cart-info">

                        <b>{i.name}</b>
                        {i.selectedSize && <small style={{ display: 'block', color: '#77796e', marginTop: '3px' }}>Size: {i.selectedSize}</small>}
                        <span>{money(i.price)}</span>
                        {i.bulkDiscountEnabled && Number(i.bulkMinimumQuantity) > 0 && Number(i.bulkDiscountAmount) > 0 && (
                          <small style={{
                            display: 'block',
                            marginTop: '6px',
                            color: '#39734a',
                            fontSize: '11px',
                            fontWeight: 700,
                          }}>
                            Buy {i.bulkMinimumQuantity}+ and save {money(i.bulkDiscountAmount)}
                          </small>
                        )}
                        <small
                          style={{
                            display: 'block',
                            marginTop: '5px',
                            color: i.isAvailable === false || i.inStock === false ? '#b42318' : '#39734a',
                            fontWeight: 700,
                          }}
                        >
                          {i.isAvailable === false
                            ? 'This product is no longer available'
                            : i.inStock === false
                              ? 'Out of stock'
                              : 'In stock'}
                        </small>

                        {i.isAvailable === false ? (
                          <button
                            type="button"
                            onClick={() => removeCartItem(i.cartKey || `${i.id}::${i.selectedSize || ''}`)}
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '6px',
                              marginTop: '10px',
                              padding: '7px 11px',
                              border: '1px solid #b42318',
                              borderRadius: '4px',
                              background: '#fffdf7',
                              color: '#b42318',
                              fontSize: '12px',
                              fontWeight: 700,
                              cursor: 'pointer',
                            }}
                          >
                            <Trash2 size={13} />
                            Remove
                          </button>
                        ) : (
                          <div className="qty">

                            <button
                              onClick={() => changeQty(i.cartKey || `${i.id}::${i.selectedSize || ''}`, -1)}
                              disabled={i.inStock === false}
                              aria-label={`Decrease quantity of ${i.name}`}
                              title={i.inStock === false ? 'This product is out of stock' : 'Decrease quantity'}
                              style={i.inStock === false ? { cursor: 'not-allowed', opacity: 0.45 } : undefined}
                            >
                              <Minus size={13} />
                            </button>

                            {i.qty}

                            <button
                              onClick={() => changeQty(i.cartKey || `${i.id}::${i.selectedSize || ''}`, 1)}
                              disabled={i.inStock === false}
                              aria-label={`Increase quantity of ${i.name}`}
                              title={i.inStock === false ? 'This product is out of stock' : 'Increase quantity'}
                              style={i.inStock === false ? { cursor: 'not-allowed', opacity: 0.45 } : undefined}
                            >
                              <Plus size={13} />
                            </button>

                          </div>
                        )}

                      </div>

                      <div style={{ display: 'grid', justifyItems: 'end', gap: '5px' }}>
                        {getBulkDiscount(i) > 0 && (
                          <del style={{ color: '#92958b', fontSize: '12px' }}>
                            {money(i.price * i.qty)}
                          </del>
                        )}
                        <b style={{ color: '#294b38' }}>
                          {money(i.price * i.qty - getBulkDiscount(i))}
                        </b>
                        {getBulkDiscount(i) > 0 && (
                          <small style={{ color: '#39734a', fontWeight: 700 }}>
                            Saved {money(getBulkDiscount(i))}
                          </small>
                        )}
                      </div>

                    </div>

                  ))}

                </div>

                <div className="cart-bottom">

                  <div style={{
                    display: 'grid',
                    gap: '10px',
                    padding: '14px 0',
                    borderTop: '1px solid #e8e4da',
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', color: '#77796e' }}>
                      <span>Original total</span>
                      <span>{money(originalTotal)}</span>
                    </div>

                    {discountTotal > 0 && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', color: '#39734a', fontWeight: 700 }}>
                        <span>Bulk discount</span>
                        <span>- {money(discountTotal)}</span>
                      </div>
                    )}

                    <div style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      color: '#294b38',
                      fontSize: '18px',
                      fontWeight: 700,
                      paddingTop: '10px',
                      borderTop: '1px solid #e8e4da',
                    }}>
                      <span>Total</span>
                      <span>{money(total)}</span>
                    </div>

                    {discountTotal > 0 && (
                      <small style={{ color: '#39734a', fontWeight: 600 }}>
                        🎉 You're saving {money(discountTotal)} on this order!
                      </small>
                    )}
                  </div>

                  <p>
                    Delivery charges, if any, will be confirmed on WhatsApp.
                  </p>

                  <form
                    className="checkout-form"
                    onSubmit={whatsappOrder}
                  >

                    <h3>Delivery details</h3>

                    <input
                      required
                      type="text"
                      placeholder="Name"
                      autoComplete="name"
                      minLength={2}
                      maxLength={80}
                      value={order.name}
                      onChange={(e) => setOrder({ ...order, name: e.target.value })}
                    />

                    <input
                      required
                      type="text"
                      placeholder="House name/No"
                      autoComplete="address-line1"
                      minLength={2}
                      maxLength={120}
                      value={order.house}
                      onChange={(e) => setOrder({ ...order, house: e.target.value })}
                    />

                    <input
                      required
                      type="text"
                      placeholder="Locality"
                      autoComplete="address-level3"
                      minLength={2}
                      maxLength={100}
                      value={order.locality}
                      onChange={(e) => setOrder({ ...order, locality: e.target.value })}
                    />

                    <input
                      required
                      type="text"
                      placeholder="Post office"
                      minLength={2}
                      maxLength={100}
                      value={order.postOffice}
                      onChange={(e) => setOrder({ ...order, postOffice: e.target.value })}
                    />

                    <input
                      required
                      type="text"
                      placeholder="District"
                      autoComplete="address-level2"
                      minLength={2}
                      maxLength={100}
                      value={order.district}
                      onChange={(e) => setOrder({ ...order, district: e.target.value })}
                    />

                    <input
                      required
                      type="text"
                      placeholder="State"
                      autoComplete="address-level1"
                      minLength={2}
                      maxLength={100}
                      value={order.state}
                      onChange={(e) => setOrder({ ...order, state: e.target.value })}
                    />

                    <input
                      required
                      type="text"
                      inputMode="numeric"
                      placeholder="Pincode (6 digits)"
                      autoComplete="postal-code"
                      maxLength={6}
                      pattern="[0-9]{6}"
                      title="Enter a valid 6-digit pincode"
                      value={order.pincode}
                      onChange={(e) => setOrder({ ...order, pincode: e.target.value.replace(/\D/g, '').slice(0, 6) })}
                    />

                    <input
                      required
                      type="tel"
                      inputMode="numeric"
                      placeholder="Phone number 1 (10 digits)"
                      autoComplete="tel-national"
                      maxLength={10}
                      pattern="[6-9][0-9]{9}"
                      title="Enter a valid 10-digit Indian mobile number"
                      value={order.phone1}
                      onChange={(e) => setOrder({ ...order, phone1: e.target.value.replace(/\D/g, '').slice(0, 10) })}
                    />

                    <input
                      type="tel"
                      inputMode="numeric"
                      placeholder="Phone number 2 (optional)"
                      maxLength={10}
                      pattern="[6-9][0-9]{9}"
                      title="If provided, enter a valid 10-digit Indian mobile number"
                      value={order.phone2}
                      onChange={(e) => setOrder({ ...order, phone2: e.target.value.replace(/\D/g, '').slice(0, 10) })}
                    />

                    <button
                      className="button whatsapp"
                      type="submit"
                      disabled={isPlacingOrder || hasOutOfStockItems}
                      title={hasOutOfStockItems ? 'An out-of-stock product is in your bag' : ''}
                    >
                      <MessageCircle size={18} />
                      {isPlacingOrder ? 'Saving your order...' : hasOutOfStockItems ? 'Item currently out of stock' : 'Order via WhatsApp'}
                      {!isPlacingOrder && <ArrowRight size={17} />}
                    </button>

                  </form>

                  <small className="fine-print">
                    Your order will be shared with our team on WhatsApp
                    for confirmation.
                  </small>

                </div>

              </>

            ) : (

              <div className="empty-cart">

                <ShoppingBag size={36} />

                <h3>Your bag is waiting</h3>

                <p>Find something lovely to add.</p>

                <button
                  className="button dark"
                  onClick={() => {
                    setCartOpen(false);
                    goShop();
                  }}
                >
                  Explore products
                </button>

              </div>

            )}

          </aside>

        </div>

      )}

      {/* ADMIN DASHBOARD */}

      {location.pathname === '/admin/dashboard' && adminOpen && adminUser && (

        <div
          className="overlay admin-overlay"
          style={{
            position: 'fixed',
            inset: 0,
            // Keep the dashboard above the storefront but BELOW SweetAlert2's
            // modal layer (normally z-index: 1060), so Edit/Delete dialogs show.
            zIndex: 1000,
            pointerEvents: 'auto',
            isolation: 'isolate',
          }}
        >

          <section
            className="admin-panel"
            style={{
              position: 'relative',
              zIndex: 100000,
              pointerEvents: 'auto',
              isolation: 'isolate',
            }}
          >

            <div className="drawer-head">

              <div>
                <div className="eyebrow">
                  STORE MANAGEMENT
                </div>

                <h2>
                  <LayoutDashboard size={22} />
                  Admin dashboard
                </h2>

                <small>
                  Welcome, {adminUser.name}
                </small>
              </div>

              <div style={{ display: 'flex', gap: '10px' }}>

                <button
                  className="button outline"
                  onClick={handleLogout}
                >
                  Logout
                </button>

                {/* Closing the dashboard keeps the saved admin session. */}
                <button
                  className="icon-btn"
                  onClick={() => {
                    setAdminOpen(false);
                    navigate('/', { replace: true });
                  }}
                >
                  <X />
                </button>

              </div>

            </div>

            <div className="admin-stats">

              <div>
                <span>Products</span>
                <b>{products.length}</b>
              </div>

              <div>
                <span>Items in bag</span>
                <b>{count}</b>
              </div>

              <div>
                <span>Catalog value</span>
                <b>
                  {money(
                    products.reduce(
                      (sum, p) => sum + p.price,
                      0
                    )
                  )}
                </b>
              </div>

            </div>

            <div className="admin-content">

              <div
                className="admin-page-tabs"
                style={{
                  display: 'flex',
                  gap: '10px',
                  flexWrap: 'wrap',
                  marginBottom: '22px',
                  borderBottom: '1px solid #e8e4da',
                  paddingBottom: '14px',
                  position: 'relative',
                  zIndex: 1000,
                  isolation: 'isolate',
                  pointerEvents: 'auto',
                }}
              >
                <button
                  type="button"
                  className={`button ${adminView === 'list' ? 'dark' : 'outline'}`}
                  style={{ position: 'relative', zIndex: 1001, pointerEvents: 'auto', cursor: 'pointer' }}
                  onClick={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    setEditing(null);
                    setProductSizes([]);
                    setSizeQuantity('');
                    setSizeUnit('ml');
                    setImageFile(null);
                    setImagePreview('');
                    setAdminView('list');
                  }}
                >
                  <Package size={16} /> Products
                </button>

                <button
                  type="button"
                  className={`button ${adminView === 'add' ? 'dark' : 'outline'}`}
                  style={{ position: 'relative', zIndex: 1001, pointerEvents: 'auto', cursor: 'pointer' }}
                  onClick={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    setEditing(null);
                    setProductSizes([]);
                    setSizeQuantity('');
                    setSizeUnit('ml');
                    setImageFile(null);
                    setImagePreview('');
                    setAdminView('add');
                  }}
                >
                  <Plus size={16} /> Add product
                </button>

                <button
                  type="button"
                  className={`button ${adminView === 'categories' ? 'dark' : 'outline'}`}
                  style={{ position: 'relative', zIndex: 1001, pointerEvents: 'auto', cursor: 'pointer' }}
                  aria-pressed={adminView === 'categories'}
                  onClick={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    setAdminView('categories');
                  }}
                >
                  <LayoutDashboard size={16} /> Categories
                </button>
              </div>

              {adminView === 'list' && (
                <section className="admin-products-page">
                  <div className="admin-title">
                    <div>
                      <h3>Products</h3>
                      <p style={{ margin: '5px 0 0', color: '#7b8176', fontSize: '13px' }}>View and manage products currently displayed in your shop.</p>
                    </div>
                    <button className="button dark" type="button" onClick={() => { setEditing(null); setProductSizes([]); setSizeQuantity(''); setSizeUnit('ml'); setImageFile(null); setImagePreview(''); setAdminView('add'); }}>
                      <Plus size={16} /> Add product
                    </button>
                  </div>

                  {products.length === 0 ? (
                    <div className="empty" style={{ padding: '40px 15px' }}>
                      No products added yet. Use Add product to create your first listing.
                    </div>
                  ) : (
                    <div className="admin-list">
                      {productActionMessage && (
                        <p role="status" style={{ padding: '10px 13px', borderRadius: '8px', background: productActionMessage.toLowerCase().includes('could not') || productActionMessage.toLowerCase().includes('expired') || productActionMessage.toLowerCase().includes('http') ? '#fff0ed' : '#edf4e9', color: productActionMessage.toLowerCase().includes('could not') || productActionMessage.toLowerCase().includes('expired') || productActionMessage.toLowerCase().includes('http') ? '#9b3d32' : '#294b38', fontSize: '13px' }}>
                          {productActionMessage}
                        </p>
                      )}
                      {products.map((p) => {
                        const productId = String(p._id || p.id || '');
                        return (
                          <div className="admin-product" key={productId}>
                            <img src={p.image} alt={p.name} />
                            <div style={{ minWidth: 0 }}>
                              <b>{p.name}</b>
                              <small>{p.category} · {money(p.price)} · {p.inStock === false ? 'Out of stock' : 'In stock'}</small>
                            </div>
                            {productDeleteId === productId ? (
                              <div style={{ gridColumn: '1 / -1', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', flexWrap: 'wrap', gap: '8px', paddingTop: '8px' }}>
                                <span style={{ marginRight: 'auto', color: '#9b3d32', fontSize: '12px' }}>Delete this product permanently?</span>
                                <button type="button" className="button dark" disabled={productDeleting} onClick={() => confirmRemoveProduct(productId)} style={{ minHeight: 'auto', padding: '8px 12px', background: '#a33b32', borderColor: '#a33b32' }}>{productDeleting ? 'Deleting...' : 'Yes, delete'}</button>
                                <button type="button" className="button outline" disabled={productDeleting} onClick={() => setProductDeleteId(null)} style={{ minHeight: 'auto', padding: '8px 12px' }}>Cancel</button>
                              </div>
                            ) : (
                              <>
                                <button type="button" title="Edit product" onClick={() => { setEditing(p); setProductSizes(Array.isArray(p.sizes) ? p.sizes : []); setSizeUnit(p.sizes?.[0]?.unit || 'ml'); setSizeQuantity(''); setImageFile(null); setImagePreview(p.image || ''); setAdminView('add'); }}>
                                  <Pencil size={16} />
                                </button>
                                <button type="button" title="Delete product" onClick={() => removeProduct(productId)}>
                                  <Trash2 size={16} />
                                </button>
                              </>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </section>
              )}

              {adminView === 'add' && (
                <section className="admin-add-product-page">
                  <div className="admin-title">
                    <div>
                      <h3>{editing ? 'Edit product' : 'Add a new product'}</h3>
                      <p style={{ margin: '5px 0 0', color: '#7b8176', fontSize: '13px' }}>{editing ? 'Update the product details below.' : 'Fill in the details to display a new product in your shop.'}</p>
                    </div>
                  </div>

                  <form className="product-form" onSubmit={saveProduct}>
                    <input name="name" placeholder="Product name" defaultValue={editing?.name || ''} required />

                    <div className="form-row">
                      <select name="category" defaultValue={editing?.category || customCategories[0]} required>
                        {customCategories.map((c) => <option key={c} value={c}>{c}</option>)}
                      </select>
                      <input name="price" type="number" min="0" placeholder="Price (₹)" defaultValue={editing?.price ?? ''} required />
                    </div>

                    <div className="form-row">
                      <input name="oldPrice" type="number" min="0" placeholder="Old price (optional)" defaultValue={editing?.oldPrice ?? ''} />
                      <input name="tag" placeholder="Badge e.g. Bestseller" defaultValue={editing?.tag || ''} />
                    </div>

                    <div style={{ padding: '16px', border: '1px solid #dfe5da', borderRadius: '12px', background: '#fbfcf8', display: 'grid', gap: '12px' }}>
                      <div>
                        <strong style={{ color: '#294b38' }}>Product sizes (optional)</strong>
                        <small style={{ display: 'block', color: '#788273', marginTop: '3px' }}>Add multiple quantities using one unit for this product.</small>
                      </div>
                      <div className="form-row">
                        <input type="number" min="0.01" step="any" placeholder="Enter quantity" value={sizeQuantity} onChange={(event) => setSizeQuantity(event.target.value)} />
                        <select value={sizeUnit} onChange={(event) => setSizeUnit(event.target.value)} disabled={productSizes.length > 0}>
                          {sizeUnits.map((unit) => <option key={unit} value={unit}>{unit}</option>)}
                        </select>
                      </div>
                      {productSizes.length > 0 && <small style={{ color: '#788273' }}>Unit locked to {sizeUnit}. Remove all sizes to choose another unit.</small>}
                      <button type="button" className="button outline" onClick={() => {
                        const quantity = sizeQuantity.trim();
                        if (!quantity || !Number.isFinite(Number(quantity)) || Number(quantity) <= 0) {
                          Swal.fire({ title: 'Enter a valid quantity', text: 'Please enter a quantity greater than zero.', icon: 'warning', confirmButtonColor: '#294b38' });
                          return;
                        }
                        const label = `${quantity} ${sizeUnit}`;
                        if (productSizes.some((size) => (size.label || `${size.quantity} ${size.unit}`) === label)) {
                          Swal.fire({ title: 'Size already added', text: 'This size is already in the list.', icon: 'info', confirmButtonColor: '#294b38' });
                          return;
                        }
                        setProductSizes((current) => [...current, { quantity: Number(quantity), unit: sizeUnit, label }]);
                        setSizeQuantity('');
                      }}><Plus size={15} /> Add size</button>
                      {productSizes.length > 0 && <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                        {productSizes.map((size, index) => <span key={`${size.label}-${index}`} style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '7px 10px', borderRadius: '20px', background: '#eaf1e6', color: '#294b38', fontSize: '13px', fontWeight: 700 }}>
                          {size.label || `${size.quantity} ${size.unit}`}
                          <button type="button" aria-label={`Remove ${size.label}`} onClick={() => setProductSizes((current) => current.filter((_, itemIndex) => itemIndex !== index))} style={{ border: 0, background: 'transparent', color: '#8b453b', cursor: 'pointer', padding: 0, display: 'inline-flex' }}><X size={14} /></button>
                        </span>)}
                      </div>}
                    </div>

                    <div className="admin-image-upload" style={{ border: '1px dashed #b9c7b5', borderRadius: '14px', padding: '18px', background: '#fbfcf8', display: 'grid', gap: '12px' }}>
                      <div>
                        <strong style={{ display: 'block', color: '#294b38', marginBottom: '4px' }}>Product image</strong>
                        <small style={{ color: '#788273' }}>{editing ? 'Choose a new image only if you want to replace the current one.' : 'Choose an image from your device to display on the product card.'}</small>
                      </div>
                      {(imagePreview || editing?.image) && (
                        <img src={imagePreview || editing.image} alt="Product preview" style={{ width: '150px', height: '150px', objectFit: 'cover', borderRadius: '12px', border: '1px solid #e5e1d7' }} />
                      )}
                      <input
                        type="file"
                        name="productImage"
                        accept="image/png,image/jpeg,image/webp,image/gif"
                        required={!editing && !imagePreview}
                        onChange={(event) => {
                          const file = event.target.files?.[0];
                          if (!file) return;
                          if (!file.type.startsWith('image/')) {
                            event.target.value = '';
                            Swal.fire({ title: 'Invalid file', text: 'Please choose an image file.', icon: 'warning', confirmButtonColor: '#294b38' });
                            return;
                          }
                          if (file.size > 5 * 1024 * 1024) {
                            event.target.value = '';
                            Swal.fire({ title: 'Image is too large', text: 'Please choose an image smaller than 5 MB.', icon: 'warning', confirmButtonColor: '#294b38' });
                            return;
                          }
                          setImageFile(file);
                          setImagePreview(URL.createObjectURL(file));
                        }}
                        style={{ width: '100%', padding: '10px', border: '1px solid #e2e7df', borderRadius: '9px', background: '#fff' }}
                      />
                      <small style={{ color: '#788273' }}>PNG, JPG, WEBP or GIF · Maximum 5 MB</small>
                    </div>

                    <label className="admin-stock-toggle" style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '12px 14px', border: '1px solid #dfe5da', borderRadius: '10px', color: '#294b38', background: '#fbfcf8', cursor: 'pointer' }}>
                      <input type="checkbox" name="inStock" defaultChecked={editing ? editing.inStock !== false : true} style={{ width: '17px', height: '17px', accentColor: '#294b38' }} />
                      <span><strong>In stock</strong><small style={{ display: 'block', color: '#788273', marginTop: '2px' }}>Untick this when the product is unavailable.</small></span>
                    </label>

                    <div style={{
                      padding: '16px',
                      border: '1px solid #dfe5da',
                      borderRadius: '12px',
                      background: '#fbfcf8',
                      display: 'grid',
                      gap: '13px',
                    }}>
                      <label style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '10px',
                        color: '#294b38',
                        cursor: 'pointer',
                      }}>
                        <input
                          type="checkbox"
                          name="bulkDiscountEnabled"
                          defaultChecked={editing?.bulkDiscountEnabled || false}
                          style={{ width: '17px', height: '17px', accentColor: '#294b38' }}
                        />
                        <span>
                          <strong>Enable bulk order discount</strong>
                          <small style={{ display: 'block', color: '#788273', marginTop: '3px' }}>
                            Optional offer for customers buying multiple quantities.
                          </small>
                        </span>
                      </label>

                      <div className="form-row">
                        <input
                          name="bulkMinimumQuantity"
                          type="number"
                          min="1"
                          placeholder="Minimum quantity"
                          defaultValue={editing?.bulkMinimumQuantity ?? 5}
                        />
                        <input
                          name="bulkDiscountAmount"
                          type="number"
                          min="0"
                          placeholder="Discount amount (₹)"
                          defaultValue={editing?.bulkDiscountAmount ?? 0}
                        />
                      </div>
                      <small style={{ color: '#788273' }}>
                        Set the minimum quantity and the fixed discount amount for this product.
                      </small>
                    </div>

                    <textarea name="desc" placeholder="Short product description" defaultValue={editing?.desc || ''} />

                    <div className="form-actions">
                      <button className="button dark" type="submit">{editing ? 'Update product' : 'Save product'} <Plus size={16} /></button>
                      <button type="button" className="button outline" onClick={() => { setEditing(null); setProductSizes([]); setSizeQuantity(''); setSizeUnit('ml'); setImageFile(null); setImagePreview(''); setAdminView('list'); }}>Cancel</button>
                    </div>
                  </form>
                </section>
              )}

              {adminView === 'categories' && (
                <section
                  className="admin-categories-page"
                  style={{
                    position: 'relative',
                    zIndex: 100001,
                    display: 'block',
                    pointerEvents: 'auto',
                    isolation: 'isolate',
                  }}
                >
                  <div className="admin-title">
                    <div>
                      <h3>Manage categories</h3>
                      <p style={{ margin: '5px 0 0', color: '#7b8176', fontSize: '13px' }}>Categories added here become available in the product form and shop filters.</p>
                    </div>
                    <button className="button dark" type="button" onClick={addCategory}><Plus size={16} /> Add category</button>
                  </div>
                  {categoryMessage && (
                    <p
                      role="status"
                      style={{
                        margin: '14px 0 0',
                        padding: '10px 13px',
                        borderRadius: '8px',
                        background: categoryMessage.toLowerCase().includes('could not') || categoryMessage.toLowerCase().includes('please') || categoryMessage.toLowerCase().includes('already exists') || categoryMessage.toLowerCase().includes('under 30') ? '#fff0ed' : '#edf4e9',
                        color: categoryMessage.toLowerCase().includes('could not') || categoryMessage.toLowerCase().includes('please') || categoryMessage.toLowerCase().includes('already exists') || categoryMessage.toLowerCase().includes('under 30') ? '#9b3d32' : '#294b38',
                        fontSize: '13px',
                      }}
                    >
                      {categoryMessage}
                    </p>
                  )}
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
                      gap: '12px',
                      marginTop: '20px',
                      position: 'relative',
                      zIndex: 100002,
                      pointerEvents: 'auto',
                    }}
                  >
                    {customCategories.map((item) => (
                      <div
                        key={item}
                        style={{
                          position: 'relative',
                          zIndex: 100003,
                          padding: '14px',
                          border: '1px solid #e5e1d7',
                          borderRadius: '13px',
                          background: '#fbfaf6',
                          color: '#294b38',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: '12px',
                          flexWrap: 'wrap',
                          pointerEvents: 'auto',
                        }}
                      >
                        {deletingCategory === item ? (
                          <div style={{ width: '100%', display: 'grid', gap: '10px' }}>
                            <strong style={{ color: '#9b3d32', fontSize: '13px' }}>Delete “{item}”?</strong>
                            {products.some((product) => product.category === item) ? (
                              <>
                                <small style={{ color: '#6f786b' }}>
                                  {products.filter((product) => product.category === item).length} product(s) use this category. Choose where to move them:
                                </small>
                                <select
                                  value={categoryDeleteReplacement}
                                  onChange={(event) => setCategoryDeleteReplacement(event.target.value)}
                                  disabled={categorySaving}
                                  style={{ width: '100%', padding: '10px', border: '1px solid #cbd5c5', borderRadius: '8px', background: '#fffdf7', color: '#294b38' }}
                                >
                                  <option value="">Select replacement category</option>
                                  {customCategories.filter((choice) => choice !== item).map((choice) => (
                                    <option key={choice} value={choice}>{choice}</option>
                                  ))}
                                </select>
                              </>
                            ) : (
                              <small style={{ color: '#6f786b' }}>This category has no products assigned to it.</small>
                            )}
                            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                              <button
                                type="button"
                                className="button dark"
                                disabled={categorySaving}
                                onClick={() => confirmDeleteCategory(item, categoryDeleteReplacement)}
                                style={{ minHeight: 'auto', padding: '8px 12px', background: '#a33b32', borderColor: '#a33b32' }}
                              >
                                {categorySaving ? 'Please wait...' : 'Confirm delete'}
                              </button>
                              <button
                                type="button"
                                className="button outline"
                                disabled={categorySaving}
                                onClick={() => { setDeletingCategory(null); setCategoryDeleteReplacement(''); setCategoryMessage(''); }}
                                style={{ minHeight: 'auto', padding: '8px 12px' }}
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        ) : editingCategory === item ? (
                          <div
                            style={{ width: '100%', display: 'grid', gap: '10px', position: 'relative', zIndex: 100006, pointerEvents: 'auto' }}
                          >
                            <label style={{ fontSize: '12px', fontWeight: 700, color: '#294b38' }}>
                              Edit category name
                              <input
                                type="text"
                                value={categoryEditValue}
                                onChange={(event) => setCategoryEditValue(event.target.value)}
                                maxLength={30}
                                autoFocus
                                disabled={categorySaving}
                                style={{ display: 'block', width: '100%', boxSizing: 'border-box', marginTop: '6px', padding: '11px 12px', border: '1px solid #cbd5c5', borderRadius: '8px', background: '#fffdf7', color: '#294b38', font: 'inherit', pointerEvents: 'auto' }}
                              />
                            </label>
                            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                              <button
                                type="button"
                                className="button dark"
                                disabled={categorySaving}
                                onClick={(event) => {
                                  event.preventDefault();
                                  event.stopPropagation();
                                  saveCategoryEdit(item, categoryEditValue);
                                }}
                                style={{ padding: '8px 12px', minHeight: 'auto', position: 'relative', zIndex: 100007, pointerEvents: 'auto', cursor: categorySaving ? 'wait' : 'pointer', touchAction: 'manipulation' }}
                              >
                                <Check size={15} /> {categorySaving ? 'Saving...' : 'Save changes'}
                              </button>
                              <button type="button" className="button outline" disabled={categorySaving} onClick={() => { setEditingCategory(null); setCategoryEditValue(''); setDeletingCategory(null); setCategoryDeleteReplacement(''); setCategoryMessage(''); }} style={{ padding: '8px 12px', minHeight: 'auto' }}>
                                Cancel
                              </button>
                            </div>
                          </div>
                        ) : (
                          <>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
                              <Leaf size={17} /><strong>{item}</strong>
                            </div>
                            <div
                              style={{
                                position: 'relative',
                                zIndex: 100004,
                                display: 'flex',
                                alignItems: 'center',
                                gap: '7px',
                                pointerEvents: 'auto',
                              }}
                            >
                              <button
                                type="button"
                                className="button outline"
                                style={{ position: 'relative', zIndex: 100005, padding: '8px 10px', minHeight: 'auto', pointerEvents: 'auto', cursor: 'pointer', touchAction: 'manipulation' }}
                                onClick={(event) => {
                                  event.preventDefault();
                                  event.stopPropagation();
                                  editCategory(item);
                                }}
                                aria-label={`Edit ${item}`}
                              >
                                <Pencil size={15} /> Edit
                              </button>
                              <button
                                type="button"
                                className="button outline"
                                style={{ position: 'relative', zIndex: 100005, padding: '8px 10px', minHeight: 'auto', color: '#a33b32', borderColor: '#e7c9c5', pointerEvents: 'auto', cursor: 'pointer', touchAction: 'manipulation' }}
                                onClick={(event) => {
                                  event.preventDefault();
                                  event.stopPropagation();
                                  deleteCategory(item);
                                }}
                                aria-label={`Delete ${item}`}
                              >
                                <Trash2 size={15} /> Delete
                              </button>
                            </div>
                          </>
                        )}
                      </div>
                    ))}
                  </div>
                </section>
              )}

            </div>

            <p className="demo-warning">
              Products are saved in the database. Categories are stored in this browser.
              Older products are migrated when you open them for editing and save them.
            </p>

          </section>

        </div>

      )}

      {/* NOTIFICATION */}

      {notice && (
        <div className="toast">
          {notice}
        </div>
      )}

      {/* FLOATING WHATSAPP */}

      <a
        className="floating-wa"
        href={`https://wa.me/${import.meta.env.VITE_WHATSAPP_NUMBER || '91XXXXXXXXXX'}`}
        target="_blank"
        rel="noreferrer"
        aria-label="Chat on WhatsApp"
      >
        <MessageCircle />
      </a>

    </div>
  );
}

// PRODUCT CARD

function ProductCard({ p, add }) {
  return (
    <article className="product-card">

      {/* Product Image */}
      <div className="product-image">

        <img src={p.image} alt={p.name} />

        {p.tag && (
          <span className="product-tag">
            {p.tag}
          </span>
        )}

        <span
          style={{
            position: 'absolute',
            left: '12px',
            bottom: '12px',
            zIndex: 2,
            padding: '6px 10px',
            borderRadius: '20px',
            fontSize: '11px',
            fontWeight: 600,
            letterSpacing: '.02em',
            color: p.inStock === false ? '#8a3434' : '#294b38',
            background: p.inStock === false ? '#f8e8e5' : '#edf3e9',
          }}
        >
          {p.inStock === false ? 'Out of stock' : 'In stock'}
        </span>

      </div>

      {/* Add to Bag Button - Below Image */}
      <button
        className="quick-add"
        onClick={() => add(p)}
        disabled={p.inStock === false}
      >
        {p.inStock === false ? (
          'Unavailable'
        ) : (
          <>
            <ShoppingBag size={16} />
            <span>Add to Bag</span>
            <Check size={17} className="quick-add-check" />
          </>
        )}
      </button>

      {/* Product Details */}
      <div className="product-meta">

        <div>
     

          <h3>{p.name}</h3>
          {Array.isArray(p.sizes) && p.sizes.length > 0 && (
            <small style={{ display: 'block', marginTop: '6px', color: '#77796e' }}></small>
          )}

          {p.bulkDiscountEnabled && Number(p.bulkMinimumQuantity) > 0 && Number(p.bulkDiscountAmount) > 0 && (
            <div style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              marginTop: '9px',
              padding: '7px 11px',
              borderRadius: '7px',
              background: '#edf4e9',
              color: '#294b38',
              fontSize: '11px',
              fontWeight: 700,
              lineHeight: 1.4,
            }}>
              <Sparkles size={14} />
              Buy {p.bulkMinimumQuantity}+ &amp; save {money(p.bulkDiscountAmount)}
            </div>
          )}
        </div>

        <div className="price">
          {money(p.price)}

          {p.oldPrice && (
            <del>{money(p.oldPrice)}</del>
          )}
        </div>

      </div>

      <p className="product-desc">
        {p.desc}
      </p>

    </article>
  );
}
