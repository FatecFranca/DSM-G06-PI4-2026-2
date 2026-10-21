import { User } from '../models/User.js';
import { hashPassword } from './password.js';
import { USER_ROLES, USER_STATUSES } from './constants.js';

export async function seedInitialAdmin() {
  const { ADMIN_EMAIL, ADMIN_PASSWORD, ADMIN_NAME } = process.env;
  if (!ADMIN_EMAIL && !ADMIN_PASSWORD && !ADMIN_NAME) {
    console.log('Seed do administrador inicial não configurado');
    return;
  }
  if (!ADMIN_EMAIL || !ADMIN_PASSWORD || !ADMIN_NAME) {
    throw new Error(
      'ADMIN_NAME, ADMIN_EMAIL e ADMIN_PASSWORD devem ser configurados juntos.',
    );
  }
  if (ADMIN_PASSWORD.length < 12) {
    throw new Error('ADMIN_PASSWORD deve ter pelo menos 12 caracteres.');
  }

  const email = ADMIN_EMAIL.trim().toLowerCase();
  const existingAdmin = await User.findOne({ email });
  if (existingAdmin) {
    if (!existingAdmin.roles.includes(USER_ROLES.ADMIN)) {
      throw new Error(
        `O usuário inicial ${email} já existe sem o papel admin; revisão manual necessária.`,
      );
    }
    console.log(`Administrador inicial já existe: ${email}`);
    return;
  }

  await User.create({
    fullName: ADMIN_NAME.trim(),
    email,
    passwordHash: await hashPassword(ADMIN_PASSWORD),
    phone: 'Não informado',
    birthDate: new Date('1970-01-01T00:00:00.000Z'),
    address: 'Não informado',
    emergencyContact: 'Não informado',
    roles: [USER_ROLES.ADMIN],
    status: USER_STATUSES.ACTIVE,
    approvedAt: new Date(),
  });
  console.log(`Administrador inicial criado: ${email}`);
}
