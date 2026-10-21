import { Router } from 'express';
import mongoose from 'mongoose';
import { USER_ROLES, USER_STATUSES } from './constants.js';
import { requireAuth } from './middleware.js';
import { comparePassword, hashPassword } from './password.js';
import { createAuthToken } from './token.js';
import { getPasswordPolicyErrors } from './password-policy.js';
import { User } from '../models/User.js';

const router = Router();

function isMongoReady() {
  return mongoose.connection.readyState === 1;
}

function normalizeEmail(value) {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

function parseBirthDate(value) {
  if (typeof value !== 'string' || !value.trim()) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime()) || date > new Date()) return null;
  return date;
}

function validateRegistration(body) {
  const requiredFields = [
    'fullName',
    'email',
    'password',
    'phone',
    'birthDate',
    'address',
    'emergencyContact',
  ];
  const missingFields = requiredFields.filter(
    (field) => typeof body[field] !== 'string' || !body[field].trim(),
  );
  if (missingFields.length > 0) {
    return `Campos obrigatórios ausentes: ${missingFields.join(', ')}.`;
  }
  const passwordErrors = getPasswordPolicyErrors(body.password);
  if (passwordErrors.length > 0) {
    return passwordErrors.join(' ');
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizeEmail(body.email))) {
    return 'E-mail inválido.';
  }
  if (!parseBirthDate(body.birthDate)) {
    return 'Data de nascimento inválida.';
  }
  const householdSize = Number(body.residentProfile?.householdSize);
  if (
    body.residentProfile?.householdSize !== undefined &&
    (!Number.isInteger(householdSize) || householdSize < 1)
  ) {
    return 'Número de pessoas no domicílio inválido.';
  }
  return null;
}

function requireDatabase(response) {
  if (isMongoReady()) return true;
  response.status(503).json({ error: 'Serviço de usuários indisponível.' });
  return false;
}

router.post('/register', async (request, response, next) => {
  if (!requireDatabase(response)) return;
  const validationError = validateRegistration(request.body);
  if (validationError) {
    response.status(422).json({ error: validationError });
    return;
  }

  const email = normalizeEmail(request.body.email);
  try {
    const user = await User.create({
      fullName: request.body.fullName.trim(),
      email,
      passwordHash: await hashPassword(request.body.password),
      phone: request.body.phone.trim(),
      birthDate: parseBirthDate(request.body.birthDate),
      address: request.body.address.trim(),
      emergencyContact: request.body.emergencyContact.trim(),
      roles: [USER_ROLES.RESIDENT],
      status: USER_STATUSES.PENDING,
      residentProfile: {
        householdSize: request.body.residentProfile?.householdSize,
        neighborhood: request.body.residentProfile?.neighborhood?.trim(),
        foodPreferences: request.body.residentProfile?.foodPreferences?.trim(),
        communityNeeds: request.body.residentProfile?.communityNeeds?.trim(),
      },
    });
    response.status(201).json({
      message: 'Cadastro enviado para aprovação.',
      user: user.toPublicJSON(),
    });
  } catch (error) {
    if (error?.code === 11000) {
      response.status(409).json({ error: 'E-mail já cadastrado.' });
      return;
    }
    next(error);
  }
});

router.post('/login', async (request, response, next) => {
  if (!requireDatabase(response)) return;
  const email = normalizeEmail(request.body.email);
  const password = request.body.password;
  if (!email || typeof password !== 'string' || !password) {
    response.status(422).json({ error: 'E-mail e senha são obrigatórios.' });
    return;
  }

  try {
    const user = await User.findOne({ email }).select('+passwordHash');
    if (!user || !(await comparePassword(password, user.passwordHash))) {
      response.status(401).json({ error: 'E-mail ou senha inválidos.' });
      return;
    }
    if (user.status !== USER_STATUSES.ACTIVE) {
      response.status(403).json({
        error:
          user.status === USER_STATUSES.PENDING
            ? 'Cadastro ainda aguarda aprovação.'
            : 'Usuário sem acesso ao sistema.',
      });
      return;
    }
    user.lastLoginAt = new Date();
    await user.save();
    response.json({
      token: createAuthToken(user),
      user: user.toPublicJSON(),
    });
  } catch (error) {
    next(error);
  }
});

router.get('/me', requireAuth, (request, response) =>
  response.json({
    user: request.user.toPublicJSON(),
    permissions: request.auth.permissions,
  }),
);

router.patch('/me/profile', requireAuth, async (request, response, next) => {
  const { fullName, email, phone, birthDate, address, emergencyContact } =
    request.body;
  if (fullName !== undefined && (typeof fullName !== 'string' || fullName.trim().length < 2)) {
    response.status(422).json({ error: 'Nome completo inválido.' });
    return;
  }
  if (email !== undefined && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizeEmail(email))) {
    response.status(422).json({ error: 'E-mail inválido.' });
    return;
  }
  if (birthDate !== undefined && !parseBirthDate(birthDate)) {
    response.status(422).json({ error: 'Data de nascimento inválida.' });
    return;
  }
  try {
    if (fullName !== undefined) request.user.fullName = fullName.trim();
    if (email !== undefined) request.user.email = normalizeEmail(email);
    if (phone !== undefined) request.user.phone = phone.trim();
    if (address !== undefined) request.user.address = address.trim();
    if (emergencyContact !== undefined) {
      request.user.emergencyContact = emergencyContact.trim();
    }
    if (birthDate !== undefined) {
      request.user.birthDate = parseBirthDate(birthDate);
    }
    await request.user.save();
    response.json({
      user: request.user.toPublicJSON(),
      permissions: request.auth.permissions,
    });
  } catch (error) {
    if (error?.code === 11000) {
      response.status(409).json({ error: 'E-mail já cadastrado.' });
      return;
    }
    next(error);
  }
});

router.patch('/me/password', requireAuth, async (request, response, next) => {
  const { currentPassword, password } = request.body;
  const passwordErrors = getPasswordPolicyErrors(password);
  if (passwordErrors.length > 0) {
    response.status(422).json({
      error: passwordErrors.join(' '),
      passwordRules: ['Mínimo de 12 caracteres.'],
    });
    return;
  }
  try {
    if (!(await comparePassword(currentPassword || '', request.user.passwordHash))) {
      response.status(401).json({
        error: 'Senha atual inválida. Digite a senha que está sendo usada atualmente para entrar no sistema.',
        code: 'CURRENT_PASSWORD_INVALID',
      });
      return;
    }
    request.user.passwordHash = await hashPassword(password);
    await request.user.save();
    response.json({ message: 'Senha atualizada.' });
  } catch (error) {
    next(error);
  }
});

export { router as authRouter };
