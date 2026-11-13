import 'dotenv/config';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import User from '../src/models/User.js';

try {
  await mongoose.connect(process.env.MONGODB_URI);

  const email = process.env.ADMIN_EMAIL.toLowerCase().trim();

  const user = await User.findOne({ email }).select('+password');

  if (!user) {
    console.log('Admin not found!');
  } else {
    console.log('Admin found:', user.email);
    console.log('Role:', user.role);

    const result = await bcrypt.compare(
      process.env.ADMIN_PASSWORD,
      user.password
    );

    console.log('Password matches:', result);
  }
} catch (error) {
  console.error(error);
} finally {
  await mongoose.disconnect();
}