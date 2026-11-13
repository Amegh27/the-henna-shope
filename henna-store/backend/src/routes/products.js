import {Router} from 'express';
import * as c from '../controllers/products.js';
import {requireAdmin} from '../middleware/auth.js';
const r=Router();
r.get('/',(req,res,next)=>{
 const h=req.headers.authorization;
 if(h?.startsWith('Bearer '))return requireAdmin(req,res,()=>c.list(req,res).catch(next));
 c.list(req,res).catch(next);
});
r.get('/:id',(req,res,next)=>c.getOne(req,res).catch(next));
r.post('/',requireAdmin,(req,res,next)=>c.create(req,res).catch(next));
r.patch('/:id',requireAdmin,(req,res,next)=>c.update(req,res).catch(next));
r.delete('/:id',requireAdmin,(req,res,next)=>c.remove(req,res).catch(next));
export default r;
