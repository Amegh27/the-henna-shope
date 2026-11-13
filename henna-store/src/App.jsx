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
  Pencil,
} from 'lucide-react';

import { getProducts } from './services/productService';
import API from './api';
import {
  getAdminProfile,
  adminLogout,
} from './services/authService';

import AdminLogin from './components/AdminLogin';
import UserLogin from './components/UserLogin';
import UserSignup from './components/UserSignup';
import VerifyEmail from './components/VerifyEmail';
import { getCurrentUser, userLogout } from './services/userAuthService';
import Swal from 'sweetalert2';

const money = (n) => `₹${Number(n).toLocaleString('en-IN')}`;

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
  const [loginOpen, setLoginOpen] = useState(false);
  const [adminOpen, setAdminOpen] = useState(false);

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
    phone: '',
    address: '',
  });

  const [notice, setNotice] = useState('');
  const [editing, setEditing] = useState(null);
  const [adminView, setAdminView] = useState('list');
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState('');

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
        ? [...new Set([...defaultCategories, ...saved].filter(Boolean))]
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
        const latestProduct = products.find((product) => product.id === item.id);
        if (!latestProduct) return item;

        const updatedItem = {
          ...item,
          ...latestProduct,
          qty: item.qty,
        };

        if (
          updatedItem.inStock !== item.inStock ||
          updatedItem.name !== item.name ||
          updatedItem.price !== item.price ||
          updatedItem.image !== item.image
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

        const data = await getProducts();

        // Keep a consistent availability flag and restore admin-side local changes.
        const apiProducts = data.map((product) => ({
          ...product,
          inStock: product.inStock ?? (typeof product.stock === 'number' ? product.stock > 0 : true),
        }));
        const savedProducts = JSON.parse(localStorage.getItem('henna-products') || '[]');
        const savedById = new Map(savedProducts.map((product) => [product.id, product]));
        const apiIds = new Set(apiProducts.map((product) => product.id));
        setProducts([
          ...apiProducts.map((product) => ({ ...product, ...(savedById.get(product.id) || {}) })),
          ...savedProducts.filter((product) => !apiIds.has(product.id)),
        ]);
      } catch (err) {
        console.error(err);
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

  // VALIDATE ADMIN SESSION
  useEffect(() => {
    const token = localStorage.getItem('adminToken');

    if (!token) return;

    getAdminProfile()
      .then((admin) => {
        setAdminUser(admin);
      })
      .catch((err) => {
        console.error('Admin session validation failed:', err);

        adminLogout();
        setAdminUser(null);
      });
  }, []);

  // FILTER PRODUCTS
  const shown = useMemo(() => {
    return products.filter(
      (p) =>
        (category === 'All' || p.category === category) &&
        p.name.toLowerCase().includes(query.toLowerCase())
    );
  }, [products, category, query]);

  const total = cart.reduce(
    (sum, item) => sum + item.price * item.qty,
    0
  );

  const count = cart.reduce(
    (sum, item) => sum + item.qty,
    0
  );

  const hasOutOfStockItems = cart.some((item) => item.inStock === false);

  // SHOW NOTIFICATION
  function showNotice(message) {
    setNotice(message);
    setTimeout(() => setNotice(''), 2500);
  }

  // ADD TO CART
  function add(product) {
    if (product.inStock === false) {
      showNotice('This product is currently out of stock');
      return;
    }

    setCart((old) => {
      const found = old.find((item) => item.id === product.id);

      return found
        ? old.map((item) =>
            item.id === product.id
              ? { ...item, qty: item.qty + 1 }
              : item
          )
        : [...old, { ...product, qty: 1 }];
    });

    showNotice(`${product.name} added to your bag`);
  }

  // CHANGE QUANTITY
  function changeQty(id, difference) {
    setCart((old) =>
      old
        .map((item) =>
          item.id === id
            ? { ...item, qty: item.qty + difference }
            : item
        )
        .filter((item) => item.qty > 0)
    );
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

  // Upload a newly selected product image to Cloudinary, then save product details.
  async function saveProduct(e) {
    e.preventDefault();
    const formElement = e.currentTarget;
    const form = new FormData(formElement);

    try {
      let imageUrl = editing?.image || '';

      if (imageFile) {
        const cloudName = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;
        const uploadPreset = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET;

        if (!cloudName || !uploadPreset) {
          await Swal.fire({
            title: 'Image upload is not configured',
            text: 'Add VITE_CLOUDINARY_CLOUD_NAME and VITE_CLOUDINARY_UPLOAD_PRESET to your frontend .env file, then restart Vite.',
            icon: 'warning',
            confirmButtonColor: '#294b38',
          });
          return;
        }

        const uploadData = new FormData();
        uploadData.append('file', imageFile);
        uploadData.append('upload_preset', uploadPreset);
        const uploadResponse = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
          method: 'POST',
          body: uploadData,
        });
        const uploadResult = await uploadResponse.json();

        if (!uploadResponse.ok || !uploadResult.secure_url) {
          throw new Error(uploadResult.error?.message || 'Image upload failed. Please try again.');
        }
        imageUrl = uploadResult.secure_url;
      }

      if (!imageUrl) {
        await Swal.fire({
          title: 'Product image required',
          text: 'Please choose an image before saving the product.',
          icon: 'warning',
          confirmButtonColor: '#294b38',
        });
        return;
      }

      const product = {
        id: editing?.id || Date.now(),
        name: form.get('name'),
        category: form.get('category'),
        price: Number(form.get('price')),
        oldPrice: Number(form.get('oldPrice')) || null,
        tag: form.get('tag') || 'New',
        desc: form.get('desc'),
        image: imageUrl,
        inStock: form.get('inStock') === 'on',
      };

      const updated = editing
        ? products.map((p) => p.id === editing.id ? product : p)
        : [product, ...products];

      setProducts(updated);
      localStorage.setItem('henna-products', JSON.stringify(updated));
      setEditing(null);
      setImageFile(null);
      setImagePreview('');
      formElement.reset();
      setAdminView('list');
      showNotice(editing ? 'Product updated successfully' : 'Product added successfully');
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

  // DEMO PRODUCT DELETE
  function removeProduct(id) {
    const updated = products.filter((p) => p.id !== id);

    setProducts(updated);

    localStorage.setItem(
      'henna-products',
      JSON.stringify(updated)
    );

    showNotice('Demo product deleted');
  }

  // SAVE ORDER IN MONGODB, THEN OPEN WHATSAPP
  async function whatsappOrder(e) {
    e.preventDefault();

    if (!cart.length || isPlacingOrder) return;

    if (cart.some((item) => item.inStock === false)) {
      Swal.fire({
        icon: 'warning',
        title: 'Item out of stock',
        text: 'Your bag contains an out-of-stock product. You cannot place the order until it is back in stock.',
        confirmButtonColor: '#294b38',
      });
      return;
    }

   const cleanPhone = order.phone.replace(/\D/g, '');

if (!/^[6-9]\d{9}$/.test(cleanPhone)) {
  Swal.fire({
    icon: 'warning',
    title: 'Invalid phone number',
    text: 'Please enter a valid 10-digit mobile number.',
  });
  return;
}

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
            phone: cleanPhone,
            address: order.address.trim()
          },
          items: cart.map((item) => ({
            productId: item.id,
            quantity: Number(item.qty)
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
      setOrder({ name: '', phone: '', address: '' });
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

  // ADMIN BUTTON
  function handleAdminClick() {
    if (adminUser) {
      setAdminOpen(true);
    } else {
      setLoginOpen(true);
    }
  }

  // SUCCESSFUL LOGIN
  function handleLogin(admin) {
    setAdminUser(admin);
    setLoginOpen(false);
    setAdminOpen(true);

    showNotice('Welcome to your admin dashboard!');
  }

  // LOGOUT
  function handleLogout() {
    adminLogout();

    setAdminUser(null);
    setAdminOpen(false);
    setEditing(null);

    showNotice('Logged out successfully');
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

  // CUSTOMER AUTH PAGES
  // Re-check storage at render time as a second guard against stale state.
  const activeCustomer = customerUser || getCurrentUser();

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
        .hero{position:relative!important;isolation:isolate;display:flex!important;align-items:center!important;min-height:min(760px,calc(100vh - 95px))!important;padding:clamp(70px,9vw,125px) clamp(28px,9vw,165px)!important;overflow:hidden!important;background-color:#031d17!important;background-image:linear-gradient(90deg,rgba(2,24,18,.88) 0%,rgba(2,31,23,.67) 44%,rgba(2,25,19,.38) 100%),url('https://images.unsplash.com/photo-1518531933037-91b2f5f229cc?auto=format&fit=crop&w=2400&q=90')!important;background-position:center!important;background-size:cover!important}
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
      `}</style>

      {/* ANNOUNCEMENT */}

    

      {/* HEADER */}

      <header className="header">

        <button
          className="icon-btn mobile-toggle"
          onClick={() => setMobileOpen(!mobileOpen)}
          aria-label="Menu"
        >
          {mobileOpen ? <X /> : <Menu />}
        </button>

        <a
          className="brand"
          href="#"
          onClick={(e) => {
            e.preventDefault();
            setPage('home');
          }}
        >
          <span className="brand-mark">✺</span>

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
            onClick={() => setCartOpen(true)}
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
                    onClick={async () => {
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
                        userLogout();
                        setCustomerUser(null);
                        setProfileMenuOpen(false);
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
                    }}
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

          <button
            className="admin-trigger"
            onClick={handleAdminClick}
          >
            {adminUser ? 'Dashboard' : 'Admin'}
          </button>

        </div>

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
                Beauty that
                <br />
                <em>blooms</em> from
                <br />
                the earth.
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
                  Loved by <b>2,000+</b> henna enthusiasts
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
            ) : products.length === 0 ? (
              <p className="empty">
                No products available yet.
              </p>
            ) : (

              <div className="product-grid">

                {products.slice(0, 4).map((p) => (
                  <ProductCard
                    key={p.id}
                    p={p}
                    add={add}
                  />
                ))}

              </div>

            )}

          </section>

          {/* QUOTE */}

          <section className="quote">
            <span>“</span>

            <p>
              Every little swirl tells a story.
              <br />
              <em>Make yours beautiful.</em>
            </p>

            <small>THE MEHNDI & CO. PROMISE</small>
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
          <section className="story-page-hero">
            <div className="eyebrow"><span className="story-eyebrow-dot" /> THE HEART BEHIND THE HENNA SHOPE</div>
            <h1>Our story, <em>our roots.</em></h1>
            <p>A little tradition, a little nature, and a whole lot of love in every detail.</p>
          </section>

          <section className="brand-story story-page-content">
            <div className="brand-story-image-wrap">
              <img
                className="brand-story-image"
                src="https://images.unsplash.com/photo-1519741497674-611481863552?auto=format&fit=crop&w=1200&q=90"
                alt="A celebration inspired by the art of henna"
                loading="lazy"
              />
              <div className="story-image-note"><Leaf size={17} /> Rooted in nature</div>
              <span className="story-image-number">01 / OUR STORY</span>
            </div>

            <div className="brand-story-copy">
              <div className="eyebrow"><span className="story-eyebrow-dot" /> A LITTLE ABOUT US</div>
              <h2>Rooted in tradition,<br /><em>made with love.</em></h2>
              <p>Henna is more than colour on your skin. It is a ritual, a memory, and a little moment of joy. At The Henna Shope, we celebrate this beautiful tradition with thoughtfully chosen henna essentials that help you create meaningful moments of your own.</p>
              <p className="story-secondary">From the first delicate line to the final deep stain, every detail deserves care. That is the feeling we want every order to bring to your home.</p>
              <button className="button dark story-shop-button" onClick={goShop}>Explore our collection <ArrowRight size={17} /></button>
            </div>
          </section>

          <section className="story-page-values">
            <div className="eyebrow"><span className="story-eyebrow-dot" /> WHAT MATTERS TO US</div>
            <h2>Little details. <em>Meaningful moments.</em></h2>
            <div className="story-values">
              <div><span>✳</span><b>Thoughtfully chosen</b><small>Products picked with care</small></div>
              <div><span>✿</span><b>Made for moments</b><small>Celebrate your own rituals</small></div>
              <div><span>❋</span><b>Inspired by nature</b><small>Beauty in the little details</small></div>
            </div>
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
            <span className="brand-mark">✺</span>

            <span>
              mehndi<span className="brand-amp"> & </span>co.
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
          © 2026 Mehndi & Co. All rights reserved.
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
                      className={`cart-item ${i.inStock === false ? 'cart-item-out-of-stock' : ''}`}
                      key={i.id}
                      aria-disabled={i.inStock === false}
                      style={i.inStock === false ? {
                        opacity: 0.48,
                        filter: 'grayscale(1)',
                        cursor: 'not-allowed',
                      } : undefined}
                    >

                      <img src={i.image} alt={i.name} />

                      <div className="cart-info">

                        <b>{i.name}</b>
                        <span>{money(i.price)}</span>
                        <small
                          style={{
                            display: 'inline-block',
                            marginTop: '5px',
                            color: i.inStock === false ? '#b42318' : '#39734a',
                            fontWeight: 700,
                          }}
                        >
                          {i.inStock === false ? 'Out of stock' : 'In stock'}
                        </small>

                        <div className="qty">

                          <button
                            onClick={() => changeQty(i.id, -1)}
                            disabled={i.inStock === false}
                            aria-label={`Decrease quantity of ${i.name}`}
                            title={i.inStock === false ? 'This product is out of stock' : 'Decrease quantity'}
                            style={i.inStock === false ? { cursor: 'not-allowed', opacity: 0.45 } : undefined}
                          >
                            <Minus size={13} />
                          </button>

                          {i.qty}

                          <button
                            onClick={() => changeQty(i.id, 1)}
                            disabled={i.inStock === false}
                            aria-label={`Increase quantity of ${i.name}`}
                            title={i.inStock === false ? 'This product is out of stock' : 'Increase quantity'}
                            style={i.inStock === false ? { cursor: 'not-allowed', opacity: 0.45 } : undefined}
                          >
                            <Plus size={13} />
                          </button>

                        </div>

                      </div>

                      <b>{money(i.price * i.qty)}</b>

                    </div>

                  ))}

                </div>

                <div className="cart-bottom">

                  <div className="subtotal">
                    <span>Subtotal</span>
                    <b>{money(total)}</b>
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
                      placeholder="Your full name"
                      value={order.name}
                      onChange={(e) =>
                        setOrder({
                          ...order,
                          name: e.target.value,
                        })
                      }
                    />

                    <input
                      required
                      placeholder="Mobile number"
                      value={order.phone}
                      onChange={(e) =>
                        setOrder({
                          ...order,
                          phone: e.target.value,
                        })
                      }
                    />

                    <textarea
                      required
                      placeholder="Full delivery address"
                      value={order.address}
                      onChange={(e) =>
                        setOrder({
                          ...order,
                          address: e.target.value,
                        })
                      }
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

      {/* ADMIN LOGIN */}

      {loginOpen && (

        <AdminLogin
          onClose={() => setLoginOpen(false)}
          onLogin={handleLogin}
        />

      )}

      {/* ADMIN DASHBOARD */}

      {adminOpen && adminUser && (

        <div className="overlay admin-overlay">

          <section className="admin-panel">

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

                <button
                  className="icon-btn"
                  onClick={() => setAdminOpen(false)}
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

              <div className="admin-page-tabs" style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '22px', borderBottom: '1px solid #e8e4da', paddingBottom: '14px' }}>
                <button type="button" className={`button ${adminView === 'list' ? 'dark' : 'outline'}`} onClick={() => { setEditing(null); setImageFile(null); setImagePreview(''); setAdminView('list'); }}>
                  <Package size={16} /> Products
                </button>
                <button type="button" className={`button ${adminView === 'add' ? 'dark' : 'outline'}`} onClick={() => { setEditing(null); setImageFile(null); setImagePreview(''); setAdminView('add'); }}>
                  <Plus size={16} /> Add product
                </button>
                <button type="button" className={`button ${adminView === 'categories' ? 'dark' : 'outline'}`} onClick={() => setAdminView('categories')}>
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
                    <button className="button dark" type="button" onClick={() => { setEditing(null); setImageFile(null); setImagePreview(''); setAdminView('add'); }}>
                      <Plus size={16} /> Add product
                    </button>
                  </div>

                  {products.length === 0 ? (
                    <div className="empty" style={{ padding: '40px 15px' }}>
                      No products added yet. Use Add product to create your first listing.
                    </div>
                  ) : (
                    <div className="admin-list">
                      {products.map((p) => (
                        <div className="admin-product" key={p.id}>
                          <img src={p.image} alt={p.name} />
                          <div style={{ minWidth: 0 }}>
                            <b>{p.name}</b>
                            <small>{p.category} · {money(p.price)} · {p.inStock === false ? 'Out of stock' : 'In stock'}</small>
                          </div>
                          <button title="Edit product" onClick={() => { setEditing(p); setImageFile(null); setImagePreview(p.image || ''); setAdminView('add'); }}>
                            <Pencil size={16} />
                          </button>
                          <button title="Delete product" onClick={() => removeProduct(p.id)}>
                            <Trash2 size={16} />
                          </button>
                        </div>
                      ))}
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

                    <textarea name="desc" placeholder="Short product description" defaultValue={editing?.desc || ''} />

                    <div className="form-actions">
                      <button className="button dark" type="submit">{editing ? 'Update product' : 'Save product'} <Plus size={16} /></button>
                      <button type="button" className="button outline" onClick={() => { setEditing(null); setImageFile(null); setImagePreview(''); setAdminView('list'); }}>Cancel</button>
                    </div>
                  </form>
                </section>
              )}

              {adminView === 'categories' && (
                <section className="admin-categories-page">
                  <div className="admin-title">
                    <div>
                      <h3>Manage categories</h3>
                      <p style={{ margin: '5px 0 0', color: '#7b8176', fontSize: '13px' }}>Categories added here become available in the product form and shop filters.</p>
                    </div>
                    <button className="button dark" type="button" onClick={addCategory}><Plus size={16} /> Add category</button>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: '12px', marginTop: '20px' }}>
                    {customCategories.map((item) => (
                      <div key={item} style={{ padding: '17px', border: '1px solid #e5e1d7', borderRadius: '13px', background: '#fbfaf6', color: '#294b38', display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <Leaf size={17} /><strong>{item}</strong>
                      </div>
                    ))}
                  </div>
                </section>
              )}

            </div>

            <p className="demo-warning">
              Product and category management currently uses this browser's local storage.
              Database integration for these admin actions is our next step.
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

        <button
          className="quick-add"
          onClick={() => add(p)}
          disabled={p.inStock === false}
          style={{
            opacity: p.inStock === false ? 0.55 : 1,
            cursor: p.inStock === false ? 'not-allowed' : 'pointer',
          }}
        >
          {p.inStock === false ? 'Unavailable' : <><Plus size={18} /> Add to bag</>}
        </button>

      </div>

      <div className="product-meta">

        <div>
          <span className="product-category">
            {p.category}
          </span>

          <h3>{p.name}</h3>
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