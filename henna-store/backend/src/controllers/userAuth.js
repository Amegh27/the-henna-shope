import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import nodemailer from 'nodemailer';
import User from '../models/User.js';

// EMAIL CONFIGURATION
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

// GENERATE OTP
function generateOTP() {
  return crypto.randomInt(100000, 1000000).toString();
}

// HASH OTP
function hashOTP(otp) {
  return crypto
    .createHmac('sha256', process.env.JWT_SECRET)
    .update(otp)
    .digest('hex');
}

// SEND OTP EMAIL
async function sendOTPEmail(email, otp) {
  await transporter.sendMail({
    from: `"The Henna Shope" <${process.env.EMAIL_USER}>`,
    to: email,
    subject: 'Verify your email - The Henna Shope',
    html: `
      <div style="font-family: Arial; padding: 20px;">
        <h2>Welcome to The Henna Shope!</h2>

        <p>Use the following OTP to verify your email address:</p>

        <h1 style="letter-spacing: 8px; color: #294b38;">
          ${otp}
        </h1>

        <p>This OTP expires in 5 minutes.</p>

        <p>If you did not create this account, ignore this email.</p>
      </div>
    `
  });
}

// GENERATE JWT
function generateToken(user) {
  return jwt.sign(
    {
      sub: user._id,
      role: user.role
    },
    process.env.JWT_SECRET,
    {
      expiresIn: process.env.JWT_EXPIRES_IN || '1d'
    }
  );
}


// CUSTOMER SIGNUP
export async function signup(req, res) {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({
        message: 'All fields are required.'
      });
    }

    if (password.length < 8) {
      return res.status(400).json({
        message: 'Password must contain at least 8 characters.'
      });
    }

    const normalizedEmail = String(email).toLowerCase().trim();

    const existingUser = await User.findOne({
      email: normalizedEmail
    });

    if (existingUser) {
      return res.status(409).json({
        message: 'An account with this email already exists.'
      });
    }

    const hashedPassword = await bcrypt.hash(password, 12);
    const otp = generateOTP();

    const user = await User.create({
      name: name.trim(),
      email: normalizedEmail,
      password: hashedPassword,
      role: 'user',
      isEmailVerified: false,
      otpHash: hashOTP(otp),
      otpExpiresAt: new Date(Date.now() + 5 * 60 * 1000),
      otpAttempts: 0
    });

    try {
      await sendOTPEmail(normalizedEmail, otp);
    } catch (emailError) {
      console.error('OTP email error:', emailError);

      return res.status(500).json({
        message: 'Account created, but OTP email could not be sent. Please try resending the OTP.'
      });
    }

    return res.status(201).json({
      message: 'OTP sent successfully. Please verify your email.',
      email: normalizedEmail
    });

  } catch (error) {
    console.error('Signup error:', error);

    if (error.code === 11000) {
      return res.status(409).json({
        message: 'Email already registered.'
      });
    }

    return res.status(500).json({
      message: 'Unable to create account.'
    });
  }
}


// VERIFY EMAIL OTP
export async function verifyEmail(req, res) {
  try {
    const { email, otp } = req.body;

    if (!email || !otp) {
      return res.status(400).json({
        message: 'Email and OTP are required.'
      });
    }

    const user = await User.findOne({
      email: String(email).toLowerCase().trim(),
      role: 'user',
      isEmailVerified: false
    }).select('+otpHash +otpExpiresAt +otpAttempts');

    if (!user) {
      return res.status(404).json({
        message: 'Account not found or already verified.'
      });
    }

    if (!user.otpHash || !user.otpExpiresAt) {
      return res.status(400).json({
        message: 'Please request a new OTP.'
      });
    }

    if (user.otpExpiresAt.getTime() < Date.now()) {
      return res.status(400).json({
        message: 'OTP expired. Please request a new one.'
      });
    }

    if (user.otpAttempts >= 5) {
      return res.status(429).json({
        message: 'Too many incorrect attempts. Please request a new OTP.'
      });
    }

    const submittedHash = hashOTP(String(otp).trim());

    const isMatch = crypto.timingSafeEqual(
      Buffer.from(submittedHash, 'hex'),
      Buffer.from(user.otpHash, 'hex')
    );

    if (!isMatch) {
      user.otpAttempts += 1;
      await user.save();

      return res.status(400).json({
        message: 'Incorrect OTP.'
      });
    }

    user.isEmailVerified = true;
    user.otpHash = undefined;
    user.otpExpiresAt = undefined;
    user.otpAttempts = 0;

    await user.save();

    const token = generateToken(user);

    return res.status(200).json({
      message: 'Email verified successfully.',
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role
      }
    });

  } catch (error) {
    console.error('Email verification error:', error);

    return res.status(500).json({
      message: 'Unable to verify email.'
    });
  }
}


// RESEND OTP
export async function resendOTP(req, res) {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        message: 'Email is required.'
      });
    }

    const user = await User.findOne({
      email: String(email).toLowerCase().trim(),
      role: 'user',
      isEmailVerified: false
    });

    if (!user) {
      return res.status(404).json({
        message: 'Unverified account not found.'
      });
    }

    const otp = generateOTP();

    user.otpHash = hashOTP(otp);
    user.otpExpiresAt = new Date(Date.now() + 5 * 60 * 1000);
    user.otpAttempts = 0;

    await user.save();

    await sendOTPEmail(user.email, otp);

    return res.status(200).json({
      message: 'A new OTP has been sent to your email.'
    });

  } catch (error) {
    console.error('Resend OTP error:', error);

    return res.status(500).json({
      message: 'Unable to resend OTP.'
    });
  }
}


// CUSTOMER LOGIN
export async function userLogin(req, res) {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        message: 'Email and password are required.'
      });
    }

    const normalizedEmail = String(email).toLowerCase().trim();

    const user = await User.findOne({
      email: normalizedEmail,
      role: 'user'
    }).select('+password');

    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.status(401).json({
        message: 'Incorrect email or password.'
      });
    }

    if (!user.isEmailVerified) {
      return res.status(403).json({
        message: 'Please verify your email before logging in.',
        requiresVerification: true,
        email: user.email
      });
    }

    const token = generateToken(user);

    return res.status(200).json({
      message: 'Login successful.',
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role
      }
    });

  } catch (error) {
    console.error('User login error:', error);

    return res.status(500).json({
      message: 'Unable to login.'
    });
  }
}