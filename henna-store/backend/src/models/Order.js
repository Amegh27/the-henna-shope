import mongoose from 'mongoose';
const schema=new mongoose.Schema({
 orderNumber:{type:String,required:true,unique:true},
 customer:{name:{type:String,required:true,trim:true},phone:{type:String,required:true,trim:true},address:{type:String,required:true,trim:true}},
 items:[{product:{type:mongoose.Schema.Types.ObjectId,ref:'Product',default:null},name:{type:String,required:true},price:{type:Number,required:true,min:0},quantity:{type:Number,required:true,min:1},image:{type:String,default:''}}],
 subtotal:{type:Number,required:true,min:0},
 status:{type:String,enum:['pending','confirmed','processing','shipped','delivered','cancelled'],default:'pending'}
},{timestamps:true});
export default mongoose.model('Order',schema);
