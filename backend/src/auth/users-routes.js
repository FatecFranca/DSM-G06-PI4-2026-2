import { Router } from 'express';
import mongoose from 'mongoose';
import {
  ALL_USER_ROLES,
  USER_ROLES,
  USER_STATUSES,
} from './constants.js';
import { requireAuth, requireRole } from './middleware.js';
import { hashPassword, comparePassword } from './password.js';
import { AuditLog } from '../models/AuditLog.js';
import { User } from '../models/User.js';
import { getPasswordPolicyErrors } from './password-policy.js';

const router = Router();
const adminOnly = [requireAuth, requireRole(USER_ROLES.ADMIN)];

function isMongoReady() {
  return mongoose.connection.readyState === 1;
}

function normalizeEmail(value) {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

function parseDate(value) {
  if (typeof value !== 'string' || !value.trim()) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) || date > new Date() ? null : date;
}

function publicUser(user) {
  return user.toPublicJSON();
}

async function audit(request, action, targetUserId, metadata = {}) {
  await AuditLog.create({
    actorUserId: request.user._id,
    action,
    targetUserId,
    metadata,
  });
}

async function countActiveAdmins() {
  return User.countDocuments({
    status: USER_STATUSES.ACTIVE,
    roles: USER_ROLES.ADMIN,
  });
}

function databaseUnavailable(response) {
  if (isMongoReady()) return false;
  response.status(503).json({ error: 'Serviço de usuários indisponível.' });
  return true;
}

router.get('/', adminOnly, async (_request, response, next) => {
  if (databaseUnavailable(response)) return;
  try {
    const { status, role } = _request.query;
    const filter = {};
    if (Object.values(USER_STATUSES).includes(status)) filter.status = status;
    if (ALL_USER_ROLES.includes(role)) filter.roles = role;
    const users = await User.find(filter).sort({ createdAt: -1 });
    response.json({ users: users.map(publicUser) });
  } catch (error) {
    next(error);
  }
});

router.patch('/:id/status', adminOnly, async (request, response, next) => {
  if (databaseUnavailable(response)) return;
  const { status } = request.body;
  if (![USER_STATUSES.ACTIVE, USER_STATUSES.REJECTED, USER_STATUSES.SUSPENDED].includes(status)) {
    response.status(422).json({ error: 'Status de destino inválido.' });
    return;
  }
  try {
    const user = await User.findById(request.params.id);
    if (!user) {
      response.status(404).json({ error: 'Usuário não encontrado.' });
      return;
    }
    if (
      user._id.equals(request.user._id) &&
      status !== USER_STATUSES.ACTIVE
    ) {
      response.status(409).json({ error: 'O administrador não pode bloquear a própria conta.' });
      return;
    }
    if (
      user.roles.includes(USER_ROLES.ADMIN) &&
      user.status === USER_STATUSES.ACTIVE &&
      status !== USER_STATUSES.ACTIVE &&
      (await countActiveAdmins()) <= 1
    ) {
      response.status(409).json({ error: 'Não é possível remover o último administrador ativo.' });
      return;
    }
    const previousStatus = user.status;
    user.status = status;
    if (status === USER_STATUSES.ACTIVE) {
      user.approvedAt = new Date();
      user.approvedBy = request.user._id;
      user.rejectedAt = undefined;
      user.suspendedAt = undefined;
      user.suspendedBy = undefined;
    } else if (status === USER_STATUSES.REJECTED) {
      user.rejectedAt = new Date();
      user.rejectedBy = request.user._id;
    } else {
      user.suspendedAt = new Date();
      user.suspendedBy = request.user._id;
    }
    await user.save();
    await audit(request, `user.${status}`, user._id, { previousStatus });
    response.json({ user: publicUser(user) });
  } catch (error) {
    next(error);
  }
});

router.patch('/:id/roles', adminOnly, async (request, response, next) => {
  if (databaseUnavailable(response)) return;
  const roles = request.body.roles;
  if (
    !Array.isArray(roles) ||
    roles.length === 0 ||
    roles.some((role) => !ALL_USER_ROLES.includes(role)) ||
    new Set(roles).size !== roles.length
  ) {
    response.status(422).json({ error: 'Papéis inválidos.' });
    return;
  }
  try {
    const user = await User.findById(request.params.id);
    if (!user) {
      response.status(404).json({ error: 'Usuário não encontrado.' });
      return;
    }
    const wasActiveAdmin =
      user.status === USER_STATUSES.ACTIVE &&
      user.roles.includes(USER_ROLES.ADMIN);
    if (
      wasActiveAdmin &&
      !roles.includes(USER_ROLES.ADMIN) &&
      (await countActiveAdmins()) <= 1
    ) {
      response.status(409).json({ error: 'Não é possível remover o último administrador ativo.' });
      return;
    }
    if (user._id.equals(request.user._id) && !roles.includes(USER_ROLES.ADMIN)) {
      response.status(409).json({ error: 'O administrador não pode remover o próprio papel.' });
      return;
    }
    const previousRoles = user.roles;
    user.roles = roles;
    await user.save();
    await audit(request, 'user.roles_updated', user._id, { previousRoles, roles });
    response.json({ user: publicUser(user) });
  } catch (error) {
    next(error);
  }
});

router.patch('/:id/profile', adminOnly, async (request, response, next) => {
  if (databaseUnavailable(response)) return;
  try {
    const user = await User.findById(request.params.id);
    if (!user) {
      response.status(404).json({ error: 'Usuário não encontrado.' });
      return;
    }
    const { fullName, email, phone, birthDate, address, emergencyContact } =
      request.body;
    if (typeof fullName === 'string' && fullName.trim().length >= 2) user.fullName = fullName.trim();
    if (typeof email === 'string' && email.trim()) user.email = normalizeEmail(email);
    if (typeof phone === 'string' && phone.trim()) user.phone = phone.trim();
    if (typeof address === 'string' && address.trim()) user.address = address.trim();
    if (typeof emergencyContact === 'string' && emergencyContact.trim()) {
      user.emergencyContact = emergencyContact.trim();
    }
    if (birthDate !== undefined) {
      const parsedBirthDate = parseDate(birthDate);
      if (!parsedBirthDate) {
        response.status(422).json({ error: 'Data de nascimento inválida.' });
        return;
      }
      user.birthDate = parsedBirthDate;
    }
    if (request.body.collaboratorProfile) {
      user.collaboratorProfile = request.body.collaboratorProfile;
    }
    await user.save();
    await audit(request, 'user.profile_updated', user._id);
    response.json({ user: publicUser(user) });
  } catch (error) {
    if (error?.code === 11000) {
      response.status(409).json({ error: 'E-mail já cadastrado.' });
      return;
    }
    next(error);
  }
});

router.patch('/:id/password', adminOnly, async (request, response, next) => {
  if (databaseUnavailable(response)) return;
  const password = request.body.password;
  const passwordErrors = getPasswordPolicyErrors(password);
  if (passwordErrors.length > 0) {
    response.status(422).json({
      error: passwordErrors.join(' '),
      passwordRules: ['Mínimo de 12 caracteres.'],
    });
    return;
  }
  try {
    const user = await User.findById(request.params.id).select('+passwordHash');
    if (!user) {
      response.status(404).json({ error: 'Usuário não encontrado.' });
      return;
    }
    user.passwordHash = await hashPassword(password);
    await user.save();
    await audit(request, 'user.password_updated', user._id);
    response.json({ message: 'Senha atualizada.' });
  } catch (error) {
    next(error);
  }
});

export { router as usersRouter };
