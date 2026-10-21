import jwt from 'jsonwebtoken';
import { getPermissionsForRoles } from './constants.js';

function getJwtSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error('JWT_SECRET deve ter pelo menos 32 caracteres.');
  }
  return secret;
}

export function createAuthToken(user) {
  return jwt.sign(
    {
      sub: user._id.toString(),
      roles: user.roles,
      permissions: getPermissionsForRoles(user.roles),
    },
    getJwtSecret(),
    { expiresIn: process.env.JWT_EXPIRES_IN || '8h' },
  );
}

export function verifyAuthToken(token) {
  return jwt.verify(token, getJwtSecret());
}
