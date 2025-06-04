import { useEffect, useState } from 'react';

import { zodResolver } from '@hookform/resolvers/zod';
import { Trans } from '@lingui/react/macro';
import { RecipientRole } from '@prisma/client';
import {
  CheckCircle,
  FileText,
  Mail,
  MessageSquare,
  Phone,
  RefreshCw,
  Shield,
  User,
} from 'lucide-react';
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
    .min(1, { message: 'El número de teléfono es requerido' })
    .refine(
      (value) => {
        const validation = validateAndFormatPhoneNumber(value);
        return validation.isValid;
      },
      {
        message:
          'Por favor ingresa un número de teléfono válido con código de país (ej: +1234567890)',
      },
    ),
});

const ZSMSAuthFormSchema = z.object({
  token: z
    .string()
    .min(6, { message: 'El código debe tener 6 dígitos' })
    .max(6, { message: 'El código debe tener 6 dígitos' })
    .regex(/^\d{6}$/, { message: 'El código debe contener solo números' }),
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
  const { recipient, user, document, isCurrentlyAuthenticating, setIsCurrentlyAuthenticating } =
    useRequiredDocumentSigningAuthContext();

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

  const tokenValue = authForm.watch('token');

  const onSetupFormSubmit = async ({ phoneNumber }: TSMSSetupFormSchema) => {
    try {
      setIsSmsSending(true);
      setFormErrorCode(null);

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
      authForm.setValue('token', '');
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
    }
  };

  const onResendSms = async () => {
    if (!phoneNumber) return;

    try {
      setIsSmsSending(true);
      setFormErrorCode(null);

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
      authForm.setValue('token', '', { shouldValidate: false, shouldDirty: false });
    }
  }, [open, setupForm, authForm]);

  // Componente de información del recipient
  const RecipientInfo = () => (
    <div className="mb-6 rounded-lg border border-blue-200 bg-gradient-to-r from-blue-50 to-indigo-50 p-4 dark:border-blue-800 dark:from-blue-950/20 dark:to-indigo-950/20">
      <div className="flex items-start space-x-3">
        <div className="flex-shrink-0">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900/50">
            <Shield className="h-5 w-5 text-blue-600 dark:text-blue-400" />
          </div>
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="mb-2 text-sm font-semibold text-gray-900 dark:text-gray-100">
            <Trans>Secure Document Authentication</Trans>
          </h3>

          <div className="space-y-2 text-sm text-gray-600 dark:text-gray-300">
            <div className="flex items-center space-x-2">
              <User className="h-4 w-4 text-gray-400" />
              <span className="font-medium">{recipient.name || 'Recipient'}</span>
            </div>

            <div className="flex items-center space-x-2">
              <Mail className="h-4 w-4 text-gray-400" />
              <span className="rounded bg-gray-100 px-2 py-1 font-mono text-xs dark:bg-gray-800">
                {recipient.email}
              </span>
            </div>

            {document && (
              <div className="flex items-center space-x-2">
                <FileText className="h-4 w-4 text-gray-400" />
                <span className="truncate">{document.title}</span>
              </div>
            )}

            <div className="mt-3 flex items-center space-x-2 border-t border-blue-200 pt-2 dark:border-blue-700">
              <CheckCircle className="h-4 w-4 text-green-500" />
              <span className="text-xs font-medium text-green-700 dark:text-green-400">
                <Trans>Role: {recipient.role}</Trans>
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  if (step === 'setup') {
    return (
      <div className="space-y-6">
        {/* Header con icono */}
        <div className="pb-4 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-indigo-600">
            <Phone className="h-8 w-8 text-white" />
          </div>
          <h2 className="mb-2 text-xl font-semibold text-gray-900 dark:text-gray-100">
            <Trans>SMS Verification Required</Trans>
          </h2>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            <Trans>Secure your digital signature with SMS authentication</Trans>
          </p>
        </div>

        {/* Información del recipient */}
        <RecipientInfo />

        <Form {...setupForm}>
          <form onSubmit={setupForm.handleSubmit(onSetupFormSubmit)}>
            <fieldset disabled={isSmsSending}>
              <div className="space-y-6">
                <Alert className="border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950/20">
                  <MessageSquare className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                  <AlertDescription className="text-blue-800 dark:text-blue-200">
                    {recipient.role === RecipientRole.VIEWER && actionTarget === 'DOCUMENT' ? (
                      <Trans>
                        Enter your phone number to receive a verification code to view this document
                        securely.
                      </Trans>
                    ) : (
                      <Trans>
                        Enter your phone number to receive a verification code to{' '}
                        {actionVerb.toLowerCase()} this {actionTarget.toLowerCase()}.
                      </Trans>
                    )}
                  </AlertDescription>
                </Alert>

                <FormField
                  control={setupForm.control}
                  name="phoneNumber"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel required className="text-base font-medium">
                        <Trans>Phone Number</Trans>
                      </FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Phone className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 transform text-gray-400" />
                          <Input
                            {...field}
                            placeholder="+1 (555) 123-4567"
                            type="tel"
                            className="h-12 pl-10 text-base"
                          />
                        </div>
                      </FormControl>
                      <FormMessage />
                      <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                        <Trans>Include your country code (e.g., +1 for US, +34 for Spain)</Trans>
                      </p>
                    </FormItem>
                  )}
                />

                {formErrorCode && (
                  <Alert variant="destructive">
                    <AlertTitle>
                      <Trans>Verification Failed</Trans>
                    </AlertTitle>
                    <AlertDescription>
                      <Trans>
                        Failed to send SMS verification code. Please check your phone number and try
                        again.
                      </Trans>
                    </AlertDescription>
                  </Alert>
                )}

                <DialogFooter className="flex-col gap-3 sm:flex-row">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => onOpenChange(false)}
                    className="w-full sm:w-auto"
                  >
                    <Trans>Cancel</Trans>
                  </Button>

                  <Button
                    type="submit"
                    loading={isSmsSending}
                    className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 sm:w-auto"
                  >
                    {isSmsSending ? (
                      <>
                        <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                        <Trans>Sending Code...</Trans>
                      </>
                    ) : (
                      <>
                        <MessageSquare className="mr-2 h-4 w-4" />
                        <Trans>Send Verification Code</Trans>
                      </>
                    )}
                  </Button>
                </DialogFooter>
              </div>
            </fieldset>
          </form>
        </Form>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header con icono */}
      <div className="pb-4 text-center">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-green-500 to-emerald-600">
          <MessageSquare className="h-8 w-8 text-white" />
        </div>
        <h2 className="mb-2 text-xl font-semibold text-gray-900 dark:text-gray-100">
          <Trans>Enter Verification Code</Trans>
        </h2>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          <Trans>We've sent a 6-digit code to your phone</Trans>
        </p>
      </div>

      {/* Información del recipient */}
      <RecipientInfo />

      <Form {...authForm}>
        <form onSubmit={authForm.handleSubmit(onAuthFormSubmit)}>
          <fieldset disabled={isCurrentlyAuthenticating}>
            <div className="space-y-6">
              <Alert className="border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950/20">
                <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400" />
                <AlertDescription className="text-green-800 dark:text-green-200">
                  <Trans>
                    Verification code sent to{' '}
                    <span className="font-mono font-semibold">{phoneNumber}</span>
                  </Trans>
                </AlertDescription>
              </Alert>

              <FormField
                control={authForm.control}
                name="token"
                render={({ field }) => {
                  const handleTokenChange = (value: string) => {
                    authForm.setValue('token', value);
                    field.onChange(value);
                  };

                  return (
                    <FormItem>
                      <FormLabel required className="text-base font-medium">
                        <Trans>Verification Code</Trans>
                      </FormLabel>

                      <FormControl>
                        <div className="flex justify-center">
                          <PinInput
                            name="token"
                            onChange={handleTokenChange}
                            onBlur={field.onBlur}
                            value={tokenValue ?? ''}
                            maxLength={6}
                            inputMode="numeric"
                            pattern="[0-9]*"
                            type="text"
                            className="gap-3"
                          >
                            {Array(6)
                              .fill(null)
                              .map((_, i) => (
                                <PinInputGroup key={`group-${i}`}>
                                  <PinInputSlot
                                    index={i}
                                    key={`slot-${i}`}
                                    className="h-12 w-12 rounded-lg border-2 border-gray-300 text-lg font-semibold transition-all duration-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 dark:border-gray-600 dark:focus:ring-blue-800"
                                  />
                                </PinInputGroup>
                              ))}
                          </PinInput>
                        </div>
                      </FormControl>

                      <FormMessage />
                    </FormItem>
                  );
                }}
              />

              {formErrorCode && (
                <Alert variant="destructive">
                  <AlertTitle>
                    <Trans>Verification Failed</Trans>
                  </AlertTitle>
                  <AlertDescription>
                    <Trans>
                      We were unable to verify your code. Please try again or contact support.
                    </Trans>
                  </AlertDescription>
                </Alert>
              )}

              <div className="flex justify-center">
                <Button
                  type="button"
                  variant="link"
                  onClick={onResendSms}
                  loading={isSmsSending}
                  className="text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
                >
                  {isSmsSending ? (
                    <>
                      <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                      <Trans>Resending...</Trans>
                    </>
                  ) : (
                    <>
                      <RefreshCw className="mr-2 h-4 w-4" />
                      <Trans>Resend Code</Trans>
                    </>
                  )}
                </Button>
              </div>

              <DialogFooter className="flex-col gap-3 sm:flex-row">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setStep('setup')}
                  className="w-full sm:w-auto"
                >
                  <Trans>Change Number</Trans>
                </Button>

                <Button
                  type="submit"
                  loading={isCurrentlyAuthenticating}
                  className="w-full bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 sm:w-auto"
                >
                  {isCurrentlyAuthenticating ? (
                    <>
                      <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                      <Trans>Verifying...</Trans>
                    </>
                  ) : (
                    <>
                      <CheckCircle className="mr-2 h-4 w-4" />
                      <Trans>Verify & Continue</Trans>
                    </>
                  )}
                </Button>
              </DialogFooter>
            </div>
          </fieldset>
        </form>
      </Form>
    </div>
  );
};
