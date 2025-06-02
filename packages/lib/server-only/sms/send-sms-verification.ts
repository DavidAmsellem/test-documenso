import twilio from 'twilio';

export interface SmsProvider {
  sendSms(to: string, message: string): Promise<boolean>;
}

export type SendSmsVerificationOptions = {
  phoneNumber: string;
  token: string;
  recipientName?: string;
  documentTitle?: string;
};

/**
 * Default SMS verification message template.
 */
const createSmsMessage = (options: SendSmsVerificationOptions): string => {
  const { token, documentTitle } = options;

  let message = `Your verification code for Documenso is: ${token}`;

  if (documentTitle) {
    message = `Your verification code for document "${documentTitle}" is: ${token}`;
  }

  message += `. This code expires in 10 minutes.`;

  return message;
};

/**
 * Send an SMS verification token.
 * This function uses the configured SMS provider to send the verification code.
 */
export const sendSmsVerification = async (
  provider: SmsProvider,
  options: SendSmsVerificationOptions,
): Promise<boolean> => {
  const message = createSmsMessage(options);

  try {
    return await provider.sendSms(options.phoneNumber, message);
  } catch (error) {
    console.error('Failed to send SMS verification:', error);
    return false;
  }
};

/**
 * Console SMS provider for development/testing.
 * This provider logs SMS messages to the console instead of sending real SMS.
 */
export class ConsoleSmsProvider implements SmsProvider {
  async sendSms(to: string, message: string): Promise<boolean> {
    // Simulate async behavior to satisfy ESLint
    await Promise.resolve();
    console.log(`=== SMS to ${to} ===`);
    console.log(message);
    console.log('===================');
    return true;
  }
}

/**
 * Mock SMS provider that always succeeds.
 * Useful for testing environments.
 */
export class MockSmsProvider implements SmsProvider {
  async sendSms(_to: string, _message: string): Promise<boolean> {
    // Simulate async operation
    await new Promise<void>((resolve) => {
      setTimeout(() => resolve(), 100);
    });
    return true;
  }
}

/**
 * Twilio SMS provider for production use.
 */
export class TwilioSmsProvider implements SmsProvider {
  private client: twilio.Twilio;
  private fromPhoneNumber: string;

  constructor(accountSid: string, authToken: string, fromPhoneNumber: string) {
    this.client = twilio(accountSid, authToken);
    this.fromPhoneNumber = fromPhoneNumber;
  }

  async sendSms(to: string, message: string): Promise<boolean> {
    try {
      const result = await this.client.messages.create({
        body: message,
        from: this.fromPhoneNumber,
        to: to,
      });

      // Check if message was sent successfully
      return result.status === 'queued' || result.status === 'sent';
    } catch (error) {
      console.error('Twilio SMS error:', error);
      return false;
    }
  }
}

/**
 * Development SMS provider that logs messages and supports test codes.
 * This provider allows predefined test codes to work without sending real SMS.
 */
export class DevSmsProvider implements SmsProvider {
  async sendSms(to: string, message: string): Promise<boolean> {
    // Simulate async behavior to satisfy ESLint
    await Promise.resolve();
    console.log(`=== DEV SMS to ${to} ===`);
    console.log(message);
    console.log('=== TEST CODES ACCEPTED ===');
    console.log('123456, 111111, 000000');
    console.log('==========================');
    return true;
  }
}

/**
 * Get the configured SMS provider based on environment variables.
 */
export const getSmsProvider = (): SmsProvider => {
  const provider = process.env.SMS_PROVIDER;

  switch (provider) {
    case 'console':
      return new ConsoleSmsProvider();
    case 'mock':
      return new MockSmsProvider();
    case 'dev':
      return new DevSmsProvider();
    case 'twilio': {
      const accountSid = process.env.TWILIO_ACCOUNT_SID;
      const authToken = process.env.TWILIO_AUTH_TOKEN;
      const fromPhoneNumber = process.env.TWILIO_PHONE_NUMBER;

      if (!accountSid || !authToken || !fromPhoneNumber) {
        console.warn(
          'Twilio credentials not configured. Missing TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, or TWILIO_PHONE_NUMBER. Falling back to console provider.',
        );
        return new ConsoleSmsProvider();
      }

      return new TwilioSmsProvider(accountSid, authToken, fromPhoneNumber);
    }
    default:
      // Default to console provider for development
      return new ConsoleSmsProvider();
  }
};
