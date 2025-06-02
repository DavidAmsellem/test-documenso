import { prisma } from '@documenso/prisma';

export type CreateSmsVerificationTokenOptions = {
  phoneNumber: string;
  recipientId?: number;
  expiresInMinutes?: number;
};

/**
 * Generate a random 6-digit SMS verification token.
 * In development mode with 'dev' provider, return a test code.
 */
const generateSmsToken = (): string => {
  const smsProvider = process.env.SMS_PROVIDER;

  // In development mode, always return the same test code for consistency
  if (smsProvider === 'dev') {
    return '123456';
  }

  const min = 100000;
  const max = 999999;
  return Math.floor(Math.random() * (max - min + 1) + min).toString();
};

/**
 * Create an SMS verification token for the given phone number.
 */
export const createSmsVerificationToken = async ({
  phoneNumber,
  recipientId,
  expiresInMinutes = 10,
}: CreateSmsVerificationTokenOptions) => {
  const token = generateSmsToken();
  const expiresAt = new Date();
  expiresAt.setMinutes(expiresAt.getMinutes() + expiresInMinutes);

  // Clean up any existing unused tokens for this phone number
  await prisma.smsVerificationToken.deleteMany({
    where: {
      phoneNumber,
      used: false,
    },
  });

  const smsVerificationToken = await prisma.smsVerificationToken.create({
    data: {
      token,
      phoneNumber,
      recipientId,
      expiresAt,
    },
  });

  return smsVerificationToken;
};
