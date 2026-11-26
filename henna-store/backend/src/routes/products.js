import { Router } from 'express';
import * as c from '../controllers/products.js';
import { requireAdmin } from '../middleware/auth.js';

const r = Router();

// GET all products
r.get('/', (req, res, next) => {
  c.list(req, res).catch(next);
});

// GET one product by ID
r.get('/:id', (req, res, next) => {
  c.getOne(req, res).catch(next);
});

// CREATE a new product
r.post('/', requireAdmin, (req, res, next) => {
  c.create(req, res).catch(next);
});

// UPDATE an existing product
r.put('/:id', requireAdmin, (req, res, next) => {
  c.update(req, res).catch(next);
});

// DELETE a product
r.delete('/:id', requireAdmin, (req, res, next) => {
  c.remove(req, res).catch(next);
});

export default r;