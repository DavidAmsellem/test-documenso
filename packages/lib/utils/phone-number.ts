import type { CountryCode } from 'libphonenumber-js';
import { isValidPhoneNumber, parsePhoneNumber } from 'libphonenumber-js';

export type PhoneNumberValidationResult = {
  isValid: boolean;
  formatted?: string;
  country?: string;
  error?: string;
};

/**
 * Validates and formats a phone number using international standards.
 *
 * @param phoneNumber - The phone number to validate (with or without country code)
 * @param defaultCountry - Default country code to use if not specified in the number
 * @returns PhoneNumberValidationResult with validation status and formatted number
 */
export const validateAndFormatPhoneNumber = (
  phoneNumber: string,
  defaultCountry?: CountryCode,
): PhoneNumberValidationResult => {
  try {
    // Remove any whitespace and normalize the input
    const cleanNumber = phoneNumber.trim();

    if (!cleanNumber) {
      return {
        isValid: false,
        error: 'Phone number is required',
      };
    }

    // First check if it's valid as-is (international format)
    if (isValidPhoneNumber(cleanNumber)) {
      const parsed = parsePhoneNumber(cleanNumber);
      return {
        isValid: true,
        formatted: parsed.format('E.164'),
        country: parsed.country,
      };
    }

    // If not valid and we have a default country, try with that
    if (defaultCountry && isValidPhoneNumber(cleanNumber, defaultCountry)) {
      const parsed = parsePhoneNumber(cleanNumber, defaultCountry);
      return {
        isValid: true,
        formatted: parsed.format('E.164'),
        country: parsed.country,
      };
    }

    return {
      isValid: false,
      error: 'Invalid phone number format. Please include country code (e.g., +1234567890)',
    };
  } catch (error) {
    return {
      isValid: false,
      error: 'Invalid phone number format',
    };
  }
};

/**
 * Simple validation to check if a phone number looks valid.
 * This is a lighter check for client-side validation.
 */
export const isPhoneNumberValid = (phoneNumber: string): boolean => {
  const cleanNumber = phoneNumber.trim();

  // Basic format check for international numbers
  const e164Pattern = /^\+[1-9]\d{1,14}$/;

  return e164Pattern.test(cleanNumber) && isValidPhoneNumber(cleanNumber);
};

/**
 * Formats a phone number for display purposes.
 */
export const formatPhoneNumberForDisplay = (phoneNumber: string): string => {
  try {
    const parsed = parsePhoneNumber(phoneNumber);
    return parsed.formatInternational();
  } catch {
    return phoneNumber;
  }
};
