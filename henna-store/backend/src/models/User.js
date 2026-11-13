import mongoose from 'mongoose';

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true
    },

    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true
    },

    password: {
      type: String,
      required: true,
      select: false
    },

    role: {
      type: String,
      enum: ['admin', 'user'],
      default: 'user'
    },

    // EMAIL VERIFICATION
    isEmailVerified: {
      type: Boolean,
      default: false
    },

    // OTP STORAGE
    otpHash: {
      type: String,
      select: false
    },

    otpExpiresAt: {
      type: Date,
      select: false
    },

    otpAttempts: {
      type: Number,
      default: 0,
      select: false
    }
  },
  {
    timestamps: true
  }
);

export default mongoose.model('User', userSchema);