import 'dotenv/config';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import User from '../src/models/User.js';
try{
 await mongoose.connect(process.env.MONGODB_URI);
 const {ADMIN_NAME,ADMIN_EMAIL,ADMIN_PASSWORD}=process.env;
 if(!ADMIN_NAME||!ADMIN_EMAIL||!ADMIN_PASSWORD)throw new Error('Set ADMIN_NAME, ADMIN_EMAIL and ADMIN_PASSWORD in .env');
 if(ADMIN_PASSWORD.length<12)throw new Error('ADMIN_PASSWORD must be at least 12 characters.');
 const email=ADMIN_EMAIL.toLowerCase().trim(),password=await bcrypt.hash(ADMIN_PASSWORD,12);
 const admin=await User.findOneAndUpdate({email},{name:ADMIN_NAME,email,password,role:'admin'},{upsert:true,new:true,setDefaultsOnInsert:true});
 console.log(`Admin ready: ${admin.email}`);
}catch(e){console.error(e.message);process.exitCode=1;}finally{await mongoose.disconnect();}
