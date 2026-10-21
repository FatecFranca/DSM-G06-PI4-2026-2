import { User } from '../models/User.js';
import { getPermissionsForRoles, USER_STATUSES } from './constants.js';
import { verifyAuthToken } from './token.js';

function getBearerToken(request) {
  const authorization = request.headers.authorization;
  if (!authorization?.startsWith('Bearer ')) return null;
  return authorization.slice('Bearer '.length).trim() || null;
}

export async function requireAuth(request, response, next) {
  const token = getBearerToken(request);
  if (!token) {
    return response.status(401).json({ error: 'Autenticação necessária.' });
  }

  try {
    const payload = verifyAuthToken(token);
    const user = await User.findById(payload.sub).select('+passwordHash');
    if (!user || user.status !== USER_STATUSES.ACTIVE) {
      return response.status(401).json({ error: 'Sessão inválida.' });
    }
    request.user = user;
    request.auth = {
      userId: user._id.toString(),
      roles: user.roles,
      permissions: getPermissionsForRoles(user.roles),
    };
    return next();
  } catch (error) {
    if (error instanceof Error && error.message.includes('JWT_SECRET')) {
      return next(error);
    }
    return response.status(401).json({ error: 'Sessão inválida.' });
  }
}

export function requirePermission(permission) {
  return (request, response, next) => {
    if (!request.auth?.permissions.includes(permission)) {
      return response.status(403).json({ error: 'Permissão insuficiente.' });
    }
    return next();
  };
}

export function requireRole(...roles) {
  return (request, response, next) => {
    if (!roles.some((role) => request.auth?.roles.includes(role))) {
      return response.status(403).json({ error: 'Papel insuficiente.' });
    }
    return next();
  };
}
