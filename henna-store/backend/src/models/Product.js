import mongoose from 'mongoose';
const schema=new mongoose.Schema({
 name:{type:String,required:true,trim:true},category:{type:String,required:true,trim:true},
 price:{type:Number,required:true,min:0},oldPrice:{type:Number,min:0,default:null},
 tag:{type:String,trim:true,default:''},description:{type:String,trim:true,default:''},
 image:{type:String,trim:true,default:''},isActive:{type:Boolean,default:true},stock:{type:Number,min:0,default:0}
},{timestamps:true});
export default mongoose.model('Product',schema);
