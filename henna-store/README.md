# Mehndi & Co. — Henna Storefront

A responsive React + Vite storefront starter with:
- Home page and product collection
- Category filtering and search
- Cart with quantity controls
- Checkout details and WhatsApp Click-to-Chat handoff
- Demo product admin panel (browser localStorage)

## Run locally
1. Install Node.js (18+ recommended).
2. In this folder run `npm install`.
3. Copy `.env.example` to `.env` and set `VITE_WHATSAPP_NUMBER` to your business WhatsApp number (country code + number, digits only).
4. Run `npm run dev`.
5. Open the local URL printed by Vite.

## Important before launch
This is a frontend prototype, not a production-ready full-stack store. The admin panel is intentionally a demo and has no authentication. Product changes are stored only in the current browser. Orders are handed off to WhatsApp and are not saved in a database. Before taking real orders, add:
- Express API + MongoDB for products, users and order records
- Secure admin login (server-side password hashing + JWT/session)
- Cloudinary or equivalent image storage
- Server-side validation and authorization
- Real business WhatsApp number in `.env`
- Privacy, shipping, returns and contact details

## Deploy frontend to Vercel
Push this project to GitHub, import the repository in Vercel, and set the `VITE_WHATSAPP_NUMBER` environment variable in Project Settings → Environment Variables. Redeploy after changing environment variables.

Connect your GoDaddy domain from Vercel Project → Settings → Domains. Copy the exact DNS records Vercel displays into GoDaddy DNS Management. Do not delete existing MX/TXT records used for email.
