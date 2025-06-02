import { createSmsVerificationToken } from './create-sms-verification-token';
import { checkSmsRateLimit } from './rate-limit';
import { getSmsProvider, sendSmsVerification } from './send-sms-verification';

export type InitiateSmsVerificationOptions = {
  phoneNumber: string;
  recipientId?: number;
  recipientName?: string;
  documentTitle?: string;
  expiresInMinutes?: number;
};

/**
 * Basic phone number validation.
 */
const isValidPhoneNumber = (phoneNumber: string): boolean => {
  // E.164 format validation
  return /^\+[1-9]\d{1,14}$/.test(phoneNumber);
};

/**
 * Initiate SMS verification by creating a token and sending it via SMS.
 */
export const initiateSmsVerification = async (
  options: InitiateSmsVerificationOptions,
): Promise<{ success: boolean; error?: string }> => {
  try {
    // Validate phone number format (basic validation)
    if (!isValidPhoneNumber(options.phoneNumber)) {
      return {
        success: false,
        error: 'Invalid phone number format',
      };
    }

    // Check rate limiting
    const rateLimitResult = checkSmsRateLimit({
      phoneNumber: options.phoneNumber,
    });

    if (!rateLimitResult.allowed) {
      const resetTime = new Date(rateLimitResult.resetTime);
      return {
        success: false,
        error: `Too many SMS requests. Please try again after ${resetTime.toLocaleTimeString()}.`,
      };
    }

    // Create the verification token
    const smsToken = await createSmsVerificationToken({
      phoneNumber: options.phoneNumber,
      recipientId: options.recipientId,
      expiresInMinutes: options.expiresInMinutes,
    });

    // Send the SMS
    const smsProvider = getSmsProvider();
    const smsSent = await sendSmsVerification(smsProvider, {
      phoneNumber: options.phoneNumber,
      token: smsToken.token,
      recipientName: options.recipientName,
      documentTitle: options.documentTitle,
    });

    if (!smsSent) {
      return {
        success: false,
        error: 'Failed to send SMS',
      };
    }

    return {
      success: true,
    };
  } catch (error) {
    console.error('Failed to initiate SMS verification:', error);
    return {
      success: false,
      error: 'Internal server error',
    };
  }
};
