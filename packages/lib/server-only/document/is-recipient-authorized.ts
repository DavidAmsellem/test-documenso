import type { Document, Recipient } from '@prisma/client';
import { verifyAuthenticationResponse } from '@simplewebauthn/server';
import { match } from 'ts-pattern';

import { prisma } from '@documenso/prisma';

import { verifyTwoFactorAuthenticationToken } from '../2fa/verify-2fa-token';
import { AppError, AppErrorCode } from '../../errors/app-error';
import type { TDocumentAuth, TDocumentAuthMethods } from '../../types/document-auth';
import { DocumentAuth } from '../../types/document-auth';
import type { TAuthenticationResponseJSONSchema } from '../../types/webauthn';
import { getAuthenticatorOptions } from '../../utils/authenticator';
import { extractDocumentAuthMethods } from '../../utils/document-auth';

type IsRecipientAuthorizedOptions = {
  type: 'ACCESS' | 'ACTION';
  documentAuthOptions: Document['authOptions'];
  recipient: Pick<Recipient, 'authOptions' | 'email'>;

  /**
   * The ID of the user who initiated the request.
   */
  userId?: number;

  /**
   * The auth details to check.
   *
   * Optional because there are scenarios where no auth options are required such as
   * using the user ID.
   */
  authOptions?: TDocumentAuthMethods;
};

const getUserByEmail = async (email: string) => {
  return await prisma.user.findFirst({
    where: {
      email,
    },
    select: {
      id: true,
    },
  });
};

/**
 * Whether the recipient is authorized to perform the requested operation on a
 * document, given the provided auth options.
 *
 * @returns True if the recipient can perform the requested operation.
 */
export const isRecipientAuthorized = async ({
  type,
  documentAuthOptions,
  recipient,
  userId,
  authOptions,
}: IsRecipientAuthorizedOptions): Promise<boolean> => {
  const { derivedRecipientAccessAuth, derivedRecipientActionAuth } = extractDocumentAuthMethods({
    documentAuth: documentAuthOptions,
    recipientAuth: recipient.authOptions,
  });

  const authMethod: TDocumentAuth | null =
    type === 'ACCESS' ? derivedRecipientAccessAuth : derivedRecipientActionAuth;

  // Early true return when auth is not required.
  if (!authMethod || authMethod === DocumentAuth.EXPLICIT_NONE) {
    return true;
  }

  // Create auth options when none are passed for account.
  if (!authOptions && authMethod === DocumentAuth.ACCOUNT) {
    authOptions = {
      type: DocumentAuth.ACCOUNT,
    };
  }

  // ✅ REEMPLAZAR ESTAS LÍNEAS (75-77):
  // Authentication required does not match provided method.
  // if (!authOptions || authOptions.type !== authMethod || !userId) {
  //   return false;
  // }

  // ✅ NUEVA LÓGICA - Excluir SMS de requerir userId:
  if (!authOptions || authOptions.type !== authMethod) {
    return false;
  }

  // Para métodos que no sean SMS, requerir userId
  if (authMethod !== DocumentAuth.SMS && !userId) {
    console.log('🚨 AUTH REJECTED - Missing userId for non-SMS method:', { authMethod, userId });
    return false;
  }

  // ✅ AGREGAR ESTE LOG:
  console.log('🔍 AUTH VALIDATION:', {
    authMethod,
    userId: userId || 'NO USER',
    authOptionsType: authOptions?.type,
    isSMS: authMethod === DocumentAuth.SMS,
  });

  return await match(authOptions)
    .with({ type: DocumentAuth.ACCOUNT }, async () => {
      const recipientUser = await getUserByEmail(recipient.email);

      if (!recipientUser) {
        return false;
      }

      return recipientUser.id === userId;
    })
    .with({ type: DocumentAuth.PASSKEY }, async ({ authenticationResponse, tokenReference }) => {
      return await isPasskeyAuthValid({
        userId,
        authenticationResponse,
        tokenReference,
      });
    })
    .with({ type: DocumentAuth.TWO_FACTOR_AUTH }, async ({ token }) => {
      const user = await prisma.user.findFirst({
        where: {
          id: userId,
        },
      });

      // Should not be possible.
      if (!user) {
        throw new AppError(AppErrorCode.NOT_FOUND, {
          message: 'User not found',
        });
      }

      return await verifyTwoFactorAuthenticationToken({
        user,
        totpCode: token,
        window: 10, // 5 minutes worth of tokens
      });
    })
    .with({ type: DocumentAuth.SMS }, async ({ token, phoneNumber }) => {
      return await isSmsAuthValid({
        token,
        phoneNumber,
      });
    })
    .exhaustive();
};

type VerifyPasskeyOptions = {
  /**
   * The ID of the user who initiated the request.
   */
  userId: number;

  /**
   * The secondary ID of the verification token.
   */
  tokenReference: string;

  /**
   * The response from the passkey authenticator.
   */
  authenticationResponse: TAuthenticationResponseJSONSchema;
};

/**
 * Whether the provided passkey authenticator response is valid and the user is
 * authenticated.
 */
const isPasskeyAuthValid = async (options: VerifyPasskeyOptions): Promise<boolean> => {
  return verifyPasskey(options)
    .then(() => true)
    .catch(() => false);
};

type VerifySmsOptions = {
  /**
   * The SMS verification token.
   */
  token: string;

  /**
   * The phone number that should match the token.
   */
  phoneNumber: string;
};

/**
 * Whether the provided SMS token is valid.
 */
const isSmsAuthValid = async (options: VerifySmsOptions): Promise<boolean> => {
  return verifySmsToken(options)
    .then(() => true)
    .catch(() => false);
};

/**
 * Verifies whether the provided passkey authenticator is valid and the user is
 * authenticated.
 *
 * Will throw an error if the user should not be authenticated.
 */
const verifyPasskey = async ({
  userId,
  tokenReference,
  authenticationResponse,
}: VerifyPasskeyOptions): Promise<void> => {
  const passkey = await prisma.passkey.findFirst({
    where: {
      credentialId: Buffer.from(authenticationResponse.id, 'base64'),
      userId,
    },
  });

  if (!passkey) {
    throw new AppError(AppErrorCode.NOT_FOUND, {
      message: 'Passkey not found',
    });
  }

  const verificationToken = await prisma.verificationToken
    .delete({
      where: {
        userId,
        secondaryId: tokenReference,
      },
    })
    .catch(() => null);

  if (!verificationToken) {
    throw new AppError(AppErrorCode.NOT_FOUND, {
      message: 'Token not found',
    });
  }

  if (verificationToken.expires < new Date()) {
    throw new AppError(AppErrorCode.EXPIRED_CODE, {
      message: 'Token expired',
    });
  }

  const { rpId, origin } = getAuthenticatorOptions();

  const verification = await verifyAuthenticationResponse({
    response: authenticationResponse,
    expectedChallenge: verificationToken.token,
    expectedOrigin: origin,
    expectedRPID: rpId,
    authenticator: {
      credentialID: new Uint8Array(Array.from(passkey.credentialId)),
      credentialPublicKey: new Uint8Array(passkey.credentialPublicKey),
      counter: Number(passkey.counter),
    },
  }).catch(() => null); // May want to log this for insights.

  if (verification?.verified !== true) {
    throw new AppError(AppErrorCode.UNAUTHORIZED, {
      message: 'User is not authorized',
    });
  }

  await prisma.passkey.update({
    where: {
      id: passkey.id,
    },
    data: {
      lastUsedAt: new Date(),
      counter: verification.authenticationInfo.newCounter,
    },
  });
};

/**
 * Verifies whether the provided SMS token is valid.
 *
 * Will throw an error if the token is invalid or expired.
 */
const verifySmsToken = async ({ token, phoneNumber }: VerifySmsOptions): Promise<void> => {
  // In development mode with 'dev' SMS provider, allow predefined test codes
  const smsProvider = process.env.SMS_PROVIDER;
  const testCodes = ['123456', '111111', '000000'];

  if (smsProvider === 'dev' && testCodes.includes(token)) {
    console.log(`✅ Development SMS: Accepted test code ${token} for ${phoneNumber}`);
    return; // Allow test codes to pass verification
  }

  const smsToken = await prisma.smsVerificationToken.findFirst({
    where: {
      token,
      phoneNumber,
      used: false,
    },
  });

  if (!smsToken) {
    throw new AppError(AppErrorCode.NOT_FOUND, {
      message: 'SMS token not found',
    });
  }

  if (smsToken.expiresAt < new Date()) {
    throw new AppError(AppErrorCode.EXPIRED_CODE, {
      message: 'SMS token expired',
    });
  }

  // Mark the token as used
  await prisma.smsVerificationToken.update({
    where: {
      id: smsToken.id,
    },
    data: {
      used: true,
    },
  });
};
