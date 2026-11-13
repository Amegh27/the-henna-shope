import mongoose from 'mongoose';
import Product from '../models/Product.js';
import Order from '../models/Order.js';
export async function create(req,res){
 const {customer,items}=req.body;
 if(!customer?.name||!customer?.phone||!customer?.address)return res.status(400).json({message:'Name, phone and delivery address are required.'});
 if(!Array.isArray(items)||!items.length)return res.status(400).json({message:'Your cart is empty.'});
 const normalized=[];
 for(const item of items){
  if(!mongoose.isValidObjectId(item.productId)||!Number.isInteger(Number(item.quantity))||Number(item.quantity)<1)return res.status(400).json({message:'Invalid cart item.'});
  const p=await Product.findOne({_id:item.productId,isActive:true});
  if(!p)return res.status(400).json({message:'A product is unavailable. Refresh your cart.'});
  normalized.push({product:p._id,name:p.name,price:p.price,quantity:Number(item.quantity),image:p.image});
 }
 const subtotal=normalized.reduce((s,i)=>s+i.price*i.quantity,0);
 const orderNumber=`HN${Date.now().toString().slice(-8)}`;
 const order=await Order.create({orderNumber,customer:{name:String(customer.name).trim(),phone:String(customer.phone).trim(),address:String(customer.address).trim()},items:normalized,subtotal});
 const phone=process.env.WHATSAPP_NUMBER||'';
 const itemText=normalized.map(i=>`- ${i.name} x ${i.quantity}: Rs. ${i.price*i.quantity}`).join('\n');
 const message=[`Hello! I would like to place order ${orderNumber}.`,`Customer: ${order.customer.name}`,`Phone: ${order.customer.phone}`,`Address: ${order.customer.address}`,'Items:',itemText,`Total: Rs. ${subtotal}`,'Please confirm availability and delivery.'].join('\n');
 const whatsappUrl=phone?`https://wa.me/${phone}?text=${encodeURIComponent(message)}`:null;
 res.status(201).json({message:'Order saved. Continue to WhatsApp.',order,whatsappUrl});
}
export async function list(req,res){
 const page=Math.max(1,Number(req.query.page)||1),limit=Math.min(100,Math.max(1,Number(req.query.limit)||20));
 const [orders,total]=await Promise.all([Order.find().sort({createdAt:-1}).skip((page-1)*limit).limit(limit),Order.countDocuments()]);
 res.json({orders,pagination:{page,limit,total,pages:Math.ceil(total/limit)}});
}
export async function setStatus(req,res){
 const statuses=['pending','confirmed','processing','shipped','delivered','cancelled'];
 if(!statuses.includes(req.body.status))return res.status(400).json({message:'Invalid order status.'});
 const order=await Order.findByIdAndUpdate(req.params.id,{status:req.body.status},{new:true,runValidators:true});
 if(!order)return res.status(404).json({message:'Order not found.'});res.json({order});
}
