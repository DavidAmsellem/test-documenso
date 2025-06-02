import { useEffect, useState } from 'react';

import { zodResolver } from '@hookform/resolvers/zod';
import { Trans } from '@lingui/react/macro';
import { RecipientRole } from '@prisma/client';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import { AppError } from '@documenso/lib/errors/app-error';
import { DocumentAuth, type TRecipientActionAuth } from '@documenso/lib/types/document-auth';
import { validateAndFormatPhoneNumber } from '@documenso/lib/utils/phone-number';
import { Alert, AlertDescription, AlertTitle } from '@documenso/ui/primitives/alert';
import { Button } from '@documenso/ui/primitives/button';
import { DialogFooter } from '@documenso/ui/primitives/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@documenso/ui/primitives/form/form';
import { Input } from '@documenso/ui/primitives/input';
import { PinInput, PinInputGroup, PinInputSlot } from '@documenso/ui/primitives/pin-input';

import { useRequiredDocumentSigningAuthContext } from './document-signing-auth-provider';

export type DocumentSigningAuthSMSProps = {
  actionTarget?: 'FIELD' | 'DOCUMENT';
  actionVerb?: string;
  open: boolean;
  onOpenChange: (value: boolean) => void;
  onReauthFormSubmit: (values?: TRecipientActionAuth) => Promise<void> | void;
};

const ZSMSSetupFormSchema = z.object({
  phoneNumber: z
    .string()
    .min(1, { message: 'Phone number is required' })
    .refine(
      (value) => {
        const validation = validateAndFormatPhoneNumber(value);
        return validation.isValid;
      },
      {
        message: 'Please enter a valid phone number with country code (e.g., +1234567890)',
      },
    ),
});

const ZSMSAuthFormSchema = z.object({
  token: z
    .string()
    .min(6, { message: 'Token must be 6 digits long' })
    .max(6, { message: 'Token must be 6 digits long' })
    .regex(/^\d{6}$/, { message: 'Token must contain only digits' }),
  phoneNumber: z.string().min(1),
});

type TSMSSetupFormSchema = z.infer<typeof ZSMSSetupFormSchema>;
type TSMSAuthFormSchema = z.infer<typeof ZSMSAuthFormSchema>;

export const DocumentSigningAuthSMS = ({
  actionTarget = 'FIELD',
  actionVerb = 'sign',
  open,
  onOpenChange,
  onReauthFormSubmit,
}: DocumentSigningAuthSMSProps) => {
  // ✅ AGREGAR setIsCurrentlyAuthenticating AL DESTRUCTURING:
  const { recipient, user, isCurrentlyAuthenticating, setIsCurrentlyAuthenticating } =
    useRequiredDocumentSigningAuthContext();

  // ✅ AGREGAR ESTE LOG AL INICIO DEL COMPONENTE:
  console.log('🔍 SMS COMPONENT RENDERED:', {
    recipient: recipient.email,
    user: user ? user.email : 'NO USER',
    actionTarget,
    actionVerb,
    open,
  });

  const [step, setStep] = useState<'setup' | 'verify'>('setup');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [isSmsSending, setIsSmsSending] = useState(false);
  const [formErrorCode, setFormErrorCode] = useState<string | null>(null);

  const setupForm = useForm<TSMSSetupFormSchema>({
    resolver: zodResolver(ZSMSSetupFormSchema),
    defaultValues: {
      phoneNumber: '',
    },
  });

  const authForm = useForm<TSMSAuthFormSchema>({
    resolver: zodResolver(ZSMSAuthFormSchema),
    defaultValues: {
      token: '',
      phoneNumber: '',
    },
  });

  // ✅ AGREGAR ESTA LÍNEA después de las declaraciones de authForm
  const tokenValue = authForm.watch('token');

  const onSetupFormSubmit = async ({ phoneNumber }: TSMSSetupFormSchema) => {
    try {
      setIsSmsSending(true);
      setFormErrorCode(null);

      // Validate and format the phone number
      const validation = validateAndFormatPhoneNumber(phoneNumber);
      if (!validation.isValid) {
        throw new Error(validation.error || 'Invalid phone number');
      }

      const formattedPhoneNumber = validation.formatted!;

      const response = await fetch('/api/sms/send-verification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phoneNumber: formattedPhoneNumber,
          recipientId: recipient.id,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to send SMS');
      }

      setPhoneNumber(formattedPhoneNumber);
      authForm.setValue('phoneNumber', formattedPhoneNumber);
      authForm.setValue('token', ''); // ← Agregar esta línea
      setStep('verify');
    } catch (err) {
      const error = AppError.parseError(err);
      setFormErrorCode(error.code);
    } finally {
      setIsSmsSending(false);
    }
  };

  const onAuthFormSubmit = async ({ token, phoneNumber }: TSMSAuthFormSchema) => {
    try {
      setIsCurrentlyAuthenticating(true);

      // ✅ AGREGAR ESTE LOG:
      console.log('🔍 SMS AUTH SUBMIT:', {
        token,
        phoneNumber,
        recipientId: recipient.id,
        recipientEmail: recipient.email,
      });

      await onReauthFormSubmit({
        type: DocumentAuth.SMS,
        token,
        phoneNumber,
      });

      setIsCurrentlyAuthenticating(false);
      onOpenChange(false);
    } catch (err) {
      setIsCurrentlyAuthenticating(false);

      const error = AppError.parseError(err);
      setFormErrorCode(error.code);

      // ✅ AGREGAR ESTE LOG:
      console.log('🚨 SMS AUTH ERROR:', {
        error: error,
        message: error.message,
        code: error.code,
        status: err?.status,
      });
    }
  };

  const onResendSms = async () => {
    if (!phoneNumber) return;

    try {
      setIsSmsSending(true);
      setFormErrorCode(null);

      // TODO: Replace with actual API call to resend SMS
      const response = await fetch('/api/sms/send-verification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phoneNumber,
          recipientId: recipient.id,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to resend SMS');
      }
    } catch (err) {
      const error = AppError.parseError(err);
      setFormErrorCode(error.code);
    } finally {
      setIsSmsSending(false);
    }
  };

  useEffect(() => {
    if (open) {
      setStep('setup');
      setPhoneNumber('');
      setFormErrorCode(null);
      setupForm.reset({ phoneNumber: '' });
      authForm.reset({ token: '', phoneNumber: '' });
      // Force clear the token field explicitly to prevent field corruption
      authForm.setValue('token', '', { shouldValidate: false, shouldDirty: false });

      if (process.env.NODE_ENV === 'development') {
        console.log('🔍 SMS Modal opened - Form reset:', {
          setupFormValues: setupForm.getValues(),
          authFormValues: authForm.getValues(),
        });
      }
    }
  }, [open, setupForm, authForm]);

  if (step === 'setup') {
    return (
      <Form {...setupForm}>
        <form onSubmit={setupForm.handleSubmit(onSetupFormSubmit)}>
          <fieldset disabled={isSmsSending}>
            <div className="space-y-4">
              <Alert>
                <AlertDescription>
                  <p>
                    {recipient.role === RecipientRole.VIEWER && actionTarget === 'DOCUMENT' ? (
                      <Trans>
                        Enter your phone number to receive a verification code to view this
                        document.
                      </Trans>
                    ) : (
                      <Trans>
                        Enter your phone number to receive a verification code to{' '}
                        {actionVerb.toLowerCase()} this {actionTarget.toLowerCase()}.
                      </Trans>
                    )}
                  </p>
                </AlertDescription>
              </Alert>

              <FormField
                control={setupForm.control}
                name="phoneNumber"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel required>Phone Number</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="+1234567890" type="tel" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {formErrorCode && (
                <Alert variant="destructive">
                  <AlertTitle>
                    <Trans>Error</Trans>
                  </AlertTitle>
                  <AlertDescription>
                    <Trans>
                      Failed to send SMS verification code. Please check your phone number and try
                      again.
                    </Trans>
                  </AlertDescription>
                </Alert>
              )}

              <DialogFooter>
                <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>
                  <Trans>Cancel</Trans>
                </Button>

                <Button type="submit" loading={isSmsSending}>
                  <Trans>Send Code</Trans>
                </Button>
              </DialogFooter>
            </div>
          </fieldset>
        </form>
      </Form>
    );
  }

  return (
    <Form {...authForm}>
      <form onSubmit={authForm.handleSubmit(onAuthFormSubmit)}>
        <fieldset disabled={isCurrentlyAuthenticating}>
          <div className="space-y-4">
            <Alert>
              <AlertDescription>
                <Trans>
                  We've sent a 6-digit verification code to {phoneNumber}. Enter the code below to
                  continue.
                </Trans>
              </AlertDescription>
            </Alert>

            <FormField
              control={authForm.control}
              name="token"
              render={({ field }) => {
                // Custom onChange handler that bypasses the corrupted field
                const handleTokenChange = (value: string) => {
                  console.log('🔧 Manual token change:', value);
                  authForm.setValue('token', value);
                  // Still call the original field onChange for form validation
                  field.onChange(value);
                };

                return (
                  <FormItem>
                    <FormLabel required>Verification Code</FormLabel>

                    {process.env.NODE_ENV === 'development' && (
                      <div style={{ fontSize: '12px', color: 'blue', marginBottom: '8px' }}>
                        🔍 authForm.getValues(): {JSON.stringify(authForm.getValues())}
                      </div>
                    )}

                    {process.env.NODE_ENV === 'development' && (
                      <div style={{ fontSize: '12px', color: 'green', marginBottom: '8px' }}>
                        🔍 tokenValue (watch): "{tokenValue}"
                      </div>
                    )}

                    {process.env.NODE_ENV === 'development' && (
                      <div style={{ fontSize: '12px', color: 'red', marginBottom: '8px' }}>
                        🔍 SMS Debug: field.name = "{field.name}", field.value = "{field.value}",
                        type = {typeof field.value}
                      </div>
                    )}

                    <FormControl>
                      <PinInput
                        name="token"
                        onChange={handleTokenChange}
                        onBlur={field.onBlur}
                        value={tokenValue ?? ''}
                        maxLength={6}
                        inputMode="numeric"
                        pattern="[0-9]*"
                        type="text"
                        aria-invalid="false"
                        aria-required="true"
                        data-pin-input="true"
                        data-temp-mail-org="0"
                      >
                        {Array(6)
                          .fill(null)
                          .map((_, i) => {
                            const randomKey = `${Math.random().toString(36).substring(2, 10)}`;
                            return (
                              <PinInputGroup key={`group-${randomKey}-${i}`}>
                                <PinInputSlot
                                  index={i}
                                  key={`slot-${randomKey}-${i}`}
                                  id={`sms-pin-${i}-${randomKey}`}
                                />
                              </PinInputGroup>
                            );
                          })}
                      </PinInput>
                    </FormControl>

                    <FormMessage />
                  </FormItem>
                );
              }}
            />

            {formErrorCode && (
              <Alert variant="destructive">
                <AlertTitle>
                  <Trans>Unauthorized</Trans>
                </AlertTitle>
                <AlertDescription>
                  <Trans>
                    We were unable to verify your code. Please try again or contact support.
                  </Trans>
                </AlertDescription>
              </Alert>
            )}

            <div className="flex justify-center">
              <Button type="button" variant="link" onClick={onResendSms} loading={isSmsSending}>
                <Trans>Resend Code</Trans>
              </Button>
            </div>

            <DialogFooter>
              <Button type="button" variant="secondary" onClick={() => setStep('setup')}>
                <Trans>Back</Trans>
              </Button>

              <Button type="submit" loading={isCurrentlyAuthenticating}>
                <Trans>Verify</Trans>
              </Button>
            </DialogFooter>
          </div>
        </fieldset>
      </form>
    </Form>
  );
};
