import {Router} from 'express';
import * as c from '../controllers/orders.js';
import {requireAdmin} from '../middleware/auth.js';
const r=Router();
r.post('/',(req,res,next)=>c.create(req,res).catch(next));
r.get('/',requireAdmin,(req,res,next)=>c.list(req,res).catch(next));
r.patch('/:id/status',requireAdmin,(req,res,next)=>c.setStatus(req,res).catch(next));
export default r;
