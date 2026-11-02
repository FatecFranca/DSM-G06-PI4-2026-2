import { Router } from 'express';
import crypto from 'node:crypto';
import mongoose from 'mongoose';
import { USER_ROLES, USER_STATUSES } from './constants.js';
import { requireAuth } from './middleware.js';
import { comparePassword, hashPassword } from './password.js';
import { createAuthToken } from './token.js';
import { getPasswordPolicyErrors } from './password-policy.js';
import { User } from '../models/User.js';
import { AuditLog } from '../models/AuditLog.js';
import { sendPasswordResetEmail } from './mailer.js';

const router = Router();

function isMongoReady() {
  return mongoose.connection.readyState === 1;
}

function normalizeEmail(value) {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

function normalizeCpf(value) {
  return typeof value === 'string' ? value.replace(/\D/g, '') : '';
}

function isValidCpf(value) {
  const cpf = normalizeCpf(value);
  if (cpf.length !== 11 || /^(\d)\1+$/.test(cpf)) return false;
  let sum = 0;
  for (let index = 0; index < 9; index += 1) sum += Number(cpf[index]) * (10 - index);
  let digit = (sum * 10) % 11;
  if (digit === 10) digit = 0;
  if (digit !== Number(cpf[9])) return false;
  sum = 0;
  for (let index = 0; index < 10; index += 1) sum += Number(cpf[index]) * (11 - index);
  digit = (sum * 10) % 11;
  if (digit === 10) digit = 0;
  return digit === Number(cpf[10]);
}

function isValidPhone(value) {
  return typeof value === 'string' && value.replace(/\D/g, '').length >= 10;
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
    'cpf',
    'password',
    'confirmPassword',
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
  if (body.password !== body.confirmPassword) return 'As senhas não conferem.';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizeEmail(body.email))) {
    return 'E-mail inválido.';
  }
  if (!parseBirthDate(body.birthDate)) {
    return 'Data de nascimento inválida.';
  }
  if (!isValidCpf(body.cpf)) return 'CPF inválido.';
  if (!isValidPhone(body.phone)) return 'Telefone inválido.';
  if (![USER_ROLES.RESIDENT, USER_ROLES.VOLUNTEER, USER_ROLES.COLLABORATOR].includes(body.requestedRole)) {
    return 'Tipo de usuário inválido.';
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
      cpf: normalizeCpf(request.body.cpf),
      passwordHash: await hashPassword(request.body.password),
      phone: request.body.phone.trim(),
      birthDate: parseBirthDate(request.body.birthDate),
      address: request.body.address.trim(),
      emergencyContact: request.body.emergencyContact.trim(),
      roles: [request.body.requestedRole],
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
      response.status(409).json({
        error: error.keyPattern?.cpf ? 'CPF já cadastrado.' : 'E-mail já cadastrado.',
      });
      return;
    }
    if (error?.name === 'ValidationError') {
      response.status(422).json({
        error: Object.values(error.errors).map((item) => item.message).join(' '),
      });
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
  const { fullName, email, cpf, phone, birthDate, address, emergencyContact } =
    request.body;
  if (fullName !== undefined && (typeof fullName !== 'string' || fullName.trim().length < 2)) {
    response.status(422).json({ error: 'Nome completo inválido.' });
    return;
  }
  if (email !== undefined && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizeEmail(email))) {
    response.status(422).json({ error: 'E-mail inválido.' });
    return;
  }
  if (cpf !== undefined && !isValidCpf(cpf)) {
    response.status(422).json({ error: 'CPF inválido.' });
    return;
  }
  if (phone !== undefined && !isValidPhone(phone)) {
    response.status(422).json({ error: 'Telefone inválido.' });
    return;
  }
  if (birthDate !== undefined && !parseBirthDate(birthDate)) {
    response.status(422).json({ error: 'Data de nascimento inválida.' });
    return;
  }
  try {
    if (fullName !== undefined) request.user.fullName = fullName.trim();
    if (email !== undefined) request.user.email = normalizeEmail(email);
    if (cpf !== undefined) request.user.cpf = normalizeCpf(cpf);
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

router.post('/forgot-password', async (request, response, next) => {
  if (!requireDatabase(response)) return;
  const email = normalizeEmail(request.body.email);
  if (!email) {
    response.status(422).json({ error: 'E-mail é obrigatório.' });
    return;
  }
  try {
    const user = await User.findOne({ email }).select('+passwordResetTokenHash +passwordResetExpiresAt');
    if (user) {
      const token = crypto.randomBytes(32).toString('hex');
      user.passwordResetTokenHash = crypto.createHash('sha256').update(token).digest('hex');
      user.passwordResetExpiresAt = new Date(Date.now() + 60 * 60 * 1000);
      await user.save();
      const resetUrl = `${process.env.WEB_APP_URL || 'http://localhost:5173'}/reset-password?token=${token}`;
      await sendPasswordResetEmail({ email, resetUrl });
    }
    response.json({ message: 'Se o e-mail estiver cadastrado, enviaremos um link de recuperação.' });
  } catch (error) {
    next(error);
  }
});

router.post('/reset-password', async (request, response, next) => {
  if (!requireDatabase(response)) return;
  const { token, password, confirmPassword } = request.body;
  const passwordErrors = getPasswordPolicyErrors(password);
  if (passwordErrors.length > 0 || password !== confirmPassword) {
    response.status(422).json({ error: passwordErrors.join(' ') || 'As senhas não conferem.' });
    return;
  }
  try {
    const tokenHash = crypto.createHash('sha256').update(String(token || '')).digest('hex');
    const user = await User.findOne({
      passwordResetTokenHash: tokenHash,
      passwordResetExpiresAt: { $gt: new Date() },
    }).select('+passwordResetTokenHash +passwordResetExpiresAt');
    if (!user) {
      response.status(400).json({ error: 'Link de recuperação inválido ou expirado.' });
      return;
    }
    user.passwordHash = await hashPassword(password);
    user.authVersion = (user.authVersion || 0) + 1;
    user.passwordResetTokenHash = undefined;
    user.passwordResetExpiresAt = undefined;
    await user.save();
    await AuditLog.create({
      actorUserId: user._id,
      action: 'user.password_reset',
      targetUserId: user._id,
      ip: request.ip,
    });
    response.json({ message: 'Senha redefinida com sucesso.' });
  } catch (error) {
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
    request.user.authVersion = (request.user.authVersion || 0) + 1;
    await request.user.save();
    await AuditLog.create({
      actorUserId: request.user._id,
      action: 'user.password_updated',
      targetUserId: request.user._id,
      ip: request.ip,
    });
    response.json({ message: 'Senha atualizada.', sessionInvalidated: true });
  } catch (error) {
    next(error);
  }
});

export { router as authRouter };
