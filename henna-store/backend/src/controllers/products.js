import Product from '../models/Product.js';
export async function list(req,res){const products=await Product.find(req.admin?{}:{isActive:true}).sort({createdAt:-1});res.json({products});}
export async function getOne(req,res){const product=await Product.findOne({_id:req.params.id,isActive:true});if(!product)return res.status(404).json({message:'Product not found.'});res.json({product});}
export async function create(req,res){const product=await Product.create(req.body);res.status(201).json({product});}
export async function update(req,res){
 const allowed=['name','category','price','oldPrice','tag','description','image','isActive','stock'];
 const data=Object.fromEntries(Object.entries(req.body).filter(([k])=>allowed.includes(k)));
 const product=await Product.findByIdAndUpdate(req.params.id,data,{new:true,runValidators:true});
 if(!product)return res.status(404).json({message:'Product not found.'});res.json({product});
}
export async function remove(req,res){const product=await Product.findByIdAndDelete(req.params.id);if(!product)return res.status(404).json({message:'Product not found.'});res.json({message:'Product deleted.'});}
