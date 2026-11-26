import { Router } from 'express';
import * as c from '../controllers/categories.js';
import { requireAdmin } from '../middleware/auth.js';

const r = Router();

r.get('/', (req, res, next) => {
  c.list(req, res).catch(next);
});

r.post('/', requireAdmin, (req, res, next) => {
  c.create(req, res).catch(next);
});

r.post('/sync', requireAdmin, (req, res, next) => {
  c.sync(req, res).catch(next);
});

r.patch('/rename', requireAdmin, (req, res, next) => {
  c.rename(req, res).catch(next);
});

r.delete('/', requireAdmin, (req, res, next) => {
  c.remove(req, res).catch(next);
});

export default r;