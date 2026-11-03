import nodemailer from 'nodemailer';

let transporter;

function getTransporter() {
  if (transporter) return transporter;
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD, SMTP_SECURE } = process.env;
  if (!SMTP_HOST || !SMTP_PORT || !SMTP_USER || !SMTP_PASSWORD) return null;
  transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: Number(SMTP_PORT),
    secure: SMTP_SECURE === 'true',
    auth: { user: SMTP_USER, pass: SMTP_PASSWORD },
  });
  return transporter;
}

export async function sendPasswordResetEmail({ email, resetUrl }) {
  const mailTransporter = getTransporter();
  if (!mailTransporter) {
    if (process.env.NODE_ENV !== 'production') {
      console.info(`Link de recuperação para ${email}: ${resetUrl}`);
    } else {
      console.warn('SMTP não configurado; link de recuperação não foi enviado.');
    }
    return { delivered: false, mode: 'log' };
  }
  const from = process.env.SMTP_FROM || process.env.SMTP_USER;
  await mailTransporter.sendMail({
    from,
    to: email,
    subject: 'Recuperação de senha - Horta Comunitária',
    text: `Use este link para redefinir sua senha: ${resetUrl}`,
    html: `<p>Use este link para redefinir sua senha:</p><p><a href="${resetUrl}">${resetUrl}</a></p>`,
  });
  return { delivered: true, mode: 'smtp' };
}
