import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';

// ADMIN LOGIN
export async function login(req, res) {
  try {
    console.log('\n========== ADMIN LOGIN ==========');

    const { email, password } = req.body;

    console.log('Email received:', email);
    console.log('Password received:', Boolean(password));

    // Validate input
    if (!email || !password) {
      return res.status(400).json({
        message: 'Email and password are required.'
      });
    }

    // Find admin by email
    const user = await User.findOne({
      email: String(email).toLowerCase().trim()
    }).select('+password');

    console.log('User found:', Boolean(user));

    if (!user) {
      return res.status(401).json({
        message: 'Admin account not found.'
      });
    }

    // Verify password
    const isMatch = await bcrypt.compare(
      password,
      user.password
    );

    console.log('Password matches:', isMatch);

    if (!isMatch) {
      return res.status(401).json({
        message: 'Incorrect password.'
      });
    }

    // Verify admin role
    if (user.role !== 'admin') {
      return res.status(403).json({
        message: 'Admin access denied.'
      });
    }

    // Generate JWT
    if (!process.env.JWT_SECRET) {
      throw new Error('JWT_SECRET is missing from .env');
    }

    const token = jwt.sign(
      {
        sub: user._id,
        role: user.role
      },
      process.env.JWT_SECRET,
      {
        expiresIn: process.env.JWT_EXPIRES_IN || '1d'
      }
    );

    console.log('LOGIN SUCCESSFUL');
    console.log('================================\n');

    return res.status(200).json({
      token,
      admin: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role
      }
    });

  } catch (error) {
    console.error('LOGIN ERROR:', error);

    return res.status(500).json({
      message: 'Internal server error.'
    });
  }
}


// GET LOGGED-IN ADMIN PROFILE
export async function me(req, res) {
  try {
    return res.status(200).json({
      admin: req.admin
    });
  } catch (error) {
    console.error('PROFILE ERROR:', error);

    return res.status(500).json({
      message: 'Unable to fetch admin profile.'
    });
  }
}
