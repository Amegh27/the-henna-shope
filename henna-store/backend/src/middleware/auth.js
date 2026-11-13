import jwt from 'jsonwebtoken';
import User from '../models/User.js';
export async function requireAdmin(req,res,next){
 try{
  const h=req.headers.authorization||'',token=h.startsWith('Bearer ')?h.slice(7):null;
  if(!token)return res.status(401).json({message:'Authentication required.'});
  const data=jwt.verify(token,process.env.JWT_SECRET);
  const admin=await User.findById(data.sub).select('name email role');
  if(!admin||admin.role!=='admin')return res.status(401).json({message:'Invalid admin session.'});
  req.admin=admin;next();
 }catch{return res.status(401).json({message:'Invalid or expired token.'});}
}
