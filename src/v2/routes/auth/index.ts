import bcrypt from 'bcryptjs';
import db from '../../utils/database-gateway';
import dbw from '../../utils/database-gateway-wrapper';
import * as otpManager from '../../utils/otp-manager';
import * as jwtManager from '../../utils/jwt-manager';
import { assertEmail, assertUsername, assertPassword } from './utils';
import { assertWithSchema } from '../../utils/validation';
import { ERROR_CODE, GeneralError } from '../../utils/common-errors';
import { JSONSchemaType } from 'ajv';
import { loadUser, saveUser } from '../../utils/session-utils';
import { NextFunction, Request, Response, Router } from 'express';
import { sendEmail, EMAIL_TEMPLATE_ID } from '../../utils/email-service';

//#region GET /api/v2/auth/login-status

async function loginStatus(req: Request, res: Response, next: NextFunction) {
  try {
    const user = loadUser(req);
    res.json({
      error: 0,
      error_msg: 'Login status',
      data: {
        is_logged_in: !!user,
        username: user ? user.username : null,
      },
    });
  } catch (err) {
    next(err);
  }
}

//#endregion

//#region POST /api/v2/auth/login

type LoginBody = {
  auth_key: string;
  password: string;
};

const loginBodySchema: JSONSchemaType<LoginBody> = {
  type: 'object',
  required: ['auth_key', 'password'],
  properties: {
    auth_key: {
      type: 'string',
    },
    password: {
      type: 'string',
    },
  },
};

async function login(req: Request, res: Response, next: NextFunction) {
  try {
    // 1. Get user
    const { auth_key, password } = assertWithSchema(req.body, loginBodySchema);
    const { error, error_msg, data } = await db.users.getUsers({
      offset: 0,
      limit: 1,
      username: auth_key,
    });
    if (error || !data) {
      throw new GeneralError({
        error: ERROR_CODE.DATABASE_GATEWAY_ERROR,
        error_msg: 'Received non-zero code from Database Gateway when getting users',
        data: { response: { error, error_msg, data } },
      });
    }
    if (data.items.length < 1) {
      throw new GeneralError({
        error: ERROR_CODE.USER_NOT_FOUND,
        error_msg: 'User not found',
        data: { response: { error, error_msg, data } },
      });
    }
    const user = data.items[0];

    // 2. Validate password
    const isValidPassword = await bcrypt.compare(password, user.password);
    if (isValidPassword) {
      saveUser(req, { user_id: user.id, username: user.username });
      res.json({
        error: 0,
        error_msg: 'Logged in successfully',
        data: { username: user.username },
      });
    } else {
      res.json({
        error: ERROR_CODE.UNAUTHORIZED,
        error_msg: 'Unauthorized',
        data: null,
      });
    }
  } catch (err) {
    next(err);
  }
}

//#endregion

//#region POST /api/v2/auth/logout

async function logout(req: Request, res: Response, next: NextFunction) {
  try {
    saveUser(req, null);
    res.json({
      error: 0,
      error_msg: 'Logout successfully',
      data: null,
    });
  } catch (err) {
    next(err);
  }
}

//#endregion

//#region POST /api/v2/auth/request-signup

type RequestSignupBody = {
  email: string;
  username: string;
  full_name: string;
};

const requestSignupBodySchema: JSONSchemaType<RequestSignupBody> = {
  type: 'object',
  required: ['email', 'username', 'full_name'],
  properties: {
    email: { type: 'string' },
    username: { type: 'string' },
    full_name: { type: 'string' },
  },
};

async function requestSignup(req: Request, res: Response, next: NextFunction) {
  try {
    // TODO: check if username and email are used
    const body = assertWithSchema(req.body, requestSignupBodySchema);
    const email = assertEmail(body.email);
    const username = assertUsername(body.username);
    const otp = otpManager.createOtp(email, username);
    const { error, error_msg, data } = await sendEmail({
      recipient_email: email,
      template_id: EMAIL_TEMPLATE_ID.SIGNUP_EMAIL_TEMPLATE_ID,
      params: {
        displayed_name: body.full_name,
        otp,
      },
    });
    if (error) {
      throw new GeneralError({
        error: ERROR_CODE.EMAIL_SERVICE_ERROR,
        error_msg: 'Received non-zero code from Email Service when sending OTP email',
        data: { response: { error, error_msg, data } },
      });
    }
    res.json({
      error: 0,
      error_msg: 'OTP has been sent',
      data: {
        email,
      },
    });
  } catch (error) {
    next(error);
  }
}

//#endregion

//#region POST /api/v2/auth/verify-otp

type VerifyOtpBody = {
  email: string;
  username: string | null;
  otp: string;
};

const verifyOtpBodySchema: JSONSchemaType<VerifyOtpBody> = {
  type: 'object',
  required: ['email', 'username', 'otp'],
  properties: {
    email: {
      type: 'string',
    },
    username: {
      type: 'string',
      nullable: true,
    },
    otp: {
      type: 'string',
      minLength: 6,
      maxLength: 6,
    },
  },
};

async function verifyOtp(req: Request, res: Response, next: NextFunction) {
  try {
    const body = assertWithSchema(req.body, verifyOtpBodySchema);
    const isCorrectOtp = otpManager.verifyOtp(body.email, body.username, body.otp);
    if (!isCorrectOtp) {
      return res.json({
        error: ERROR_CODE.OTP_INCORRECT,
        error_msg: 'OTP is incorrect',
      });
    }

    const token = jwtManager.createJWT(body.email, body.username);
    res.json({
      error: 0,
      error_msg: 'OTP is correct',
      data: { token },
    });
  } catch (error) {
    next(error);
  }
}

//#endregion

//#region POST /api/v2/auth/signup

type SignupBody = {
  token: string;
  username: string;
  full_name: string;
  school_name: string;
  email: string;
  password: string;
};

// TODO: add maxLength restrictions here
const signupBodySchema: JSONSchemaType<SignupBody> = {
  type: 'object',
  required: ['token', 'username', 'full_name', 'school_name', 'email', 'password'],
  properties: {
    token: {
      type: 'string',
    },
    username: {
      type: 'string',
    },
    full_name: {
      type: 'string',
    },
    school_name: {
      type: 'string',
    },
    email: {
      type: 'string',
    },
    password: {
      type: 'string',
    },
  },
};

async function signup(req: Request, res: Response, next: NextFunction) {
  try {
    const body = assertWithSchema(req.body, signupBodySchema);
    assertEmail(body.email);
    assertUsername(body.username);
    assertPassword(body.password);

    // 1. Verify JWT
    jwtManager.verifyJWTOrThrow(body.email, body.username, body.token);

    // TODO: check if user exists

    // 2. Create user
    const salt = await bcrypt.genSalt();
    const hashedPassword = await bcrypt.hash(body.password, salt);

    await dbw.users.createUserOrThrow({
      username: body.username,
      full_name: body.full_name,
      email: body.email,
      school_name: body.school_name,
      password: hashedPassword,
    });

    res.json({
      error: 0,
      error_msg: 'Signed up successfully',
      data: {
        username: body.username,
        email: body.email,
      },
    });
  } catch (error) {
    next(error);
  }
}

//#endregion

const router = Router();
router.get('/login-status', loginStatus);
router.post('/login', login);
router.post('/logout', logout);
router.post('/request-signup', requestSignup);
router.post('/verify-otp', verifyOtp);
router.post('/signup', signup);
export default router;
