import { Router } from 'express';
import { login, me } from '../controllers/auth.js';
import { requireAdmin } from '../middleware/auth.js';
const r = Router(); r.post('/login', login); r.get('/me', requireAdmin, me); export default r;
