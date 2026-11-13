# Henna Store API

## Setup in PowerShell
1. Install Node.js 18+ and run MongoDB locally, or create an Atlas database.
2. Open terminal in this `backend` folder.
3. Run `npm install`.
4. Copy `.env.example` to `.env` with `Copy-Item .env.example .env`.
5. Edit `.env`: set MongoDB URI, a long unique JWT secret, admin credentials and WhatsApp number.
6. Run `npm run seed:admin` once.
7. Run `npm run dev`.

Health check: http://localhost:5000/api/health

## Routes
Public: `GET /api/products`, `GET /api/products/:id`, `POST /api/orders`.
Admin (Authorization: Bearer token): `POST /api/auth/login`, `GET /api/auth/me`, `POST /api/products`, `PATCH /api/products/:id`, `DELETE /api/products/:id`, `GET /api/orders?page=1&limit=20`, `PATCH /api/orders/:id/status`.

Login body: `{ "email": "...", "password": "..." }`.
Order body: `{ "customer": { "name": "...", "phone": "...", "address": "..." }, "items": [{ "productId": "MongoDB product id", "quantity": 2 }] }`.
Product fields: name, category, price, oldPrice, tag, description, image, isActive, stock.
Order statuses: pending, confirmed, processing, shipped, delivered, cancelled.

Order creation re-reads product prices from MongoDB, saves the order, then returns a WhatsApp URL. Product images currently use image URLs; Cloudinary upload is a later integration.

Important: the current React UI is still a frontend prototype using browser-local state. The API is ready, but React screens must be connected to these endpoints before MongoDB products/orders and admin login are active. Never commit `.env`.
