import { Router } from 'express';

import {
  signup,
  userLogin,
  verifyEmail,
  resendOTP
} from '../controllers/userAuth.js';

const router = Router();

router.post('/signup', signup);
router.post('/login', userLogin);
router.post('/verify-email', verifyEmail);
router.post('/resend-otp', resendOTP);

export default router;