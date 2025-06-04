import { useMemo, useState } from 'react';

import { zodResolver } from '@hookform/resolvers/zod';
import { Trans } from '@lingui/react/macro';
import type { Field } from '@prisma/client';
import { RecipientRole } from '@prisma/client';
import { useForm } from 'react-hook-form';
import { match } from 'ts-pattern';
import { z } from 'zod';

import { fieldsContainUnsignedRequiredField } from '@documenso/lib/utils/advanced-fields-helpers';
import { Badge } from '@documenso/ui/primitives/badge';
import { Button } from '@documenso/ui/primitives/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogTitle,
  DialogTrigger,
} from '@documenso/ui/primitives/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@documenso/ui/primitives/form/form';
import { Input } from '@documenso/ui/primitives/input';
import { Separator } from '@documenso/ui/primitives/separator';

import { DocumentSigningDisclosure } from '~/components/general/document-signing/document-signing-disclosure';

export type DocumentSigningCompleteDialogProps = {
  isSubmitting: boolean;
  documentTitle: string;
  fields: Field[];
  fieldsValidated: () => void | Promise<void>;
  onSignatureComplete: (nextSigner?: { name: string; email: string }) => void | Promise<void>;
  role: RecipientRole;
  disabled?: boolean;
  allowDictateNextSigner?: boolean;
  defaultNextSigner?: {
    name: string;
    email: string;
  };
  // Nuevas props para mostrar más información
  recipientInfo?: {
    name: string;
    email: string;
    phone?: string | null;
    dni?: string | null;
  };
  documentInfo?: {
    createdAt?: Date;
    totalPages?: number;
    fileSize?: string;
    totalRecipients?: number;
    signingOrder?: number;
  };
};

const ZNextSignerFormSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  email: z.string().email('Invalid email address'),
});

type TNextSignerFormSchema = z.infer<typeof ZNextSignerFormSchema>;

export const DocumentSigningCompleteDialog = ({
  isSubmitting,
  documentTitle,
  fields,
  fieldsValidated,
  onSignatureComplete,
  role,
  disabled = false,
  allowDictateNextSigner = false,
  defaultNextSigner,
  recipientInfo,
  documentInfo,
}: DocumentSigningCompleteDialogProps) => {
  const [showDialog, setShowDialog] = useState(false);
  const [isEditingNextSigner, setIsEditingNextSigner] = useState(false);

  const form = useForm<TNextSignerFormSchema>({
    resolver: allowDictateNextSigner ? zodResolver(ZNextSignerFormSchema) : undefined,
    defaultValues: {
      name: defaultNextSigner?.name ?? '',
      email: defaultNextSigner?.email ?? '',
    },
  });

  const isComplete = useMemo(() => !fieldsContainUnsignedRequiredField(fields), [fields]);

  // Contar campos completados vs. totales
  const completedFields = fields.filter((field) => field.inserted).length;
  const totalFields = fields.length;

  const handleOpenChange = (open: boolean) => {
    if (form.formState.isSubmitting || !isComplete) {
      return;
    }

    if (open) {
      form.reset({
        name: defaultNextSigner?.name ?? '',
        email: defaultNextSigner?.email ?? '',
      });
    }

    setIsEditingNextSigner(false);
    setShowDialog(open);
  };

  const onFormSubmit = async (data: TNextSignerFormSchema) => {
    console.log('data', data);
    console.log('form.formState.errors', form.formState.errors);
    try {
      if (allowDictateNextSigner && data.name && data.email) {
        await onSignatureComplete({ name: data.name, email: data.email });
      } else {
        await onSignatureComplete();
      }
    } catch (error) {
      console.error('Error completing signature:', error);
    }
  };

  const isNextSignerValid = !allowDictateNextSigner || (form.watch('name') && form.watch('email'));

  return (
    <Dialog open={showDialog} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button
          className="w-full"
          type="button"
          size="lg"
          onClick={fieldsValidated}
          loading={isSubmitting}
          disabled={disabled}
        >
          {match({ isComplete, role })
            .with({ isComplete: false }, () => <Trans>Next field</Trans>)
            .with({ isComplete: true, role: RecipientRole.APPROVER }, () => <Trans>Approve</Trans>)
            .with({ isComplete: true, role: RecipientRole.VIEWER }, () => (
              <Trans>Mark as viewed</Trans>
            ))
            .with({ isComplete: true }, () => <Trans>Complete</Trans>)
            .exhaustive()}
        </Button>
      </DialogTrigger>

      <DialogContent className="max-w-lg">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onFormSubmit)}>
            <fieldset disabled={form.formState.isSubmitting} className="border-none p-0">
              <DialogTitle>
                <div className="text-foreground text-xl font-semibold">
                  {match(role)
                    .with(RecipientRole.VIEWER, () => 'Completar Visualización')
                    .with(RecipientRole.SIGNER, () => 'Completar Firmado')
                    .with(RecipientRole.APPROVER, () => 'Completar Aprobación')
                    .with(RecipientRole.CC, () => 'Completar Visualización')
                    .with(RecipientRole.ASSISTANT, () => 'Completar Asistencia')
                    .exhaustive()}
                </div>
              </DialogTitle>

              {/* Información detallada del documento */}
              <div className="mt-4 space-y-4">
                {/* Información básica */}
                <div className="text-base text-black">
                  {match(role)
                    .with(RecipientRole.VIEWER, () => (
                      <span>
                        Está a punto de completar la visualización de "
                        <span className="font-semibold text-black">{documentTitle}</span>
                        ".
                        <br />
                        <span className="font-medium">¿Está seguro?</span>
                      </span>
                    ))
                    .with(RecipientRole.SIGNER, () => (
                      <span>
                        Está a punto de completar la firma de "
                        <span className="font-semibold text-black">{documentTitle}</span>
                        ".
                        <br />
                        <span className="font-medium">¿Está seguro?</span>
                      </span>
                    ))
                    .with(RecipientRole.APPROVER, () => (
                      <span>
                        Está a punto de completar la aprobación de "
                        <span className="font-semibold text-black">{documentTitle}</span>
                        ".
                        <br />
                        <span className="font-medium">¿Está seguro?</span>
                      </span>
                    ))
                    .otherwise(() => (
                      <span>
                        Está a punto de completar la visualización de "
                        <span className="font-semibold text-black">{documentTitle}</span>
                        ".
                        <br />
                        <span className="font-medium">¿Está seguro?</span>
                      </span>
                    ))}
                </div>

                {/* Información detallada del documento */}
                <div className="space-y-4 rounded-xl border border-gray-200 bg-gray-50 p-5">
                  <h4 className="flex items-center text-base font-bold text-black">
                    📄 Información del Documento
                  </h4>

                  <div className="space-y-3 text-sm">
                    <div className="flex items-start justify-between">
                      <span className="font-medium text-gray-700">Documento:</span>
                      <span className="max-w-[200px] text-right font-semibold text-black">
                        {documentTitle}
                      </span>
                    </div>

                    {documentInfo?.createdAt && (
                      <div className="flex justify-between">
                        <span className="font-medium text-gray-700">Fecha de creación:</span>
                        <span className="font-semibold text-black">
                          {new Date(documentInfo.createdAt).toLocaleDateString('es-ES')}
                        </span>
                      </div>
                    )}

                    {documentInfo?.totalPages && (
                      <div className="flex justify-between">
                        <span className="font-medium text-gray-700">Páginas:</span>
                        <span className="font-semibold text-black">{documentInfo.totalPages}</span>
                      </div>
                    )}

                    <div className="flex items-center justify-between">
                      <span className="font-medium text-gray-700">Campos por completar:</span>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-black">
                          {completedFields}/{totalFields}
                        </span>
                        {completedFields === totalFields && (
                          <Badge
                            variant="default"
                            className="bg-green-500 px-2 py-1 text-xs font-medium text-white"
                          >
                            ✓ Completo
                          </Badge>
                        )}
                      </div>
                    </div>

                    {documentInfo?.totalRecipients && documentInfo?.signingOrder && (
                      <div className="flex justify-between">
                        <span className="font-medium text-gray-700">Orden de firma:</span>
                        <span className="font-semibold text-black">
                          {documentInfo.signingOrder} de {documentInfo.totalRecipients}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Información del firmante */}
                {recipientInfo && (
                  <div className="space-y-4 rounded-xl border border-blue-200 bg-blue-50 p-5">
                    <h4 className="flex items-center text-base font-bold text-black">
                      👤 Información del Firmante
                    </h4>

                    <div className="space-y-3 text-sm">
                      <div className="flex justify-between">
                        <span className="font-medium text-gray-700">Nombre:</span>
                        <span className="font-semibold text-black">{recipientInfo.name}</span>
                      </div>

                      <div className="flex items-start justify-between">
                        <span className="font-medium text-gray-700">Correo electrónico:</span>
                        <span className="max-w-[200px] text-right font-semibold text-black">
                          {recipientInfo.email}
                        </span>
                      </div>

                      {recipientInfo.phone && (
                        <div className="flex justify-between">
                          <span className="font-medium text-gray-700">Teléfono:</span>
                          <span className="font-semibold text-black">{recipientInfo.phone}</span>
                        </div>
                      )}

                      {recipientInfo.dni && (
                        <div className="flex justify-between">
                          <span className="font-medium text-gray-700">DNI:</span>
                          <span className="font-semibold text-black">{recipientInfo.dni}</span>
                        </div>
                      )}

                      <div className="flex items-center justify-between">
                        <span className="font-medium text-gray-700">Rol:</span>
                        <Badge
                          variant="secondary"
                          className="px-3 py-1 text-xs font-medium text-black"
                        >
                          {match(role)
                            .with(RecipientRole.VIEWER, () => 'Visualizador')
                            .with(RecipientRole.SIGNER, () => 'Firmante')
                            .with(RecipientRole.APPROVER, () => 'Aprobador')
                            .with(RecipientRole.CC, () => 'Copia')
                            .with(RecipientRole.ASSISTANT, () => 'Asistente')
                            .exhaustive()}
                        </Badge>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {allowDictateNextSigner && (
                <div className="mt-4 flex flex-col gap-4">
                  {!isEditingNextSigner && (
                    <div>
                      <p className="text-muted-foreground text-sm">
                        The next recipient to sign this document will be{' '}
                        <span className="font-semibold">{form.watch('name')}</span> (
                        <span className="font-semibold">{form.watch('email')}</span>).
                      </p>

                      <Button
                        type="button"
                        className="mt-2"
                        variant="outline"
                        size="sm"
                        onClick={() => setIsEditingNextSigner((prev) => !prev)}
                      >
                        <Trans>Update Recipient</Trans>
                      </Button>
                    </div>
                  )}

                  {isEditingNextSigner && (
                    <div className="flex flex-col gap-4 md:flex-row">
                      <FormField
                        control={form.control}
                        name="name"
                        render={({ field }) => (
                          <FormItem className="flex-1">
                            <FormLabel>
                              <Trans>Name</Trans>
                            </FormLabel>
                            <FormControl>
                              <Input
                                {...field}
                                className="mt-2"
                                placeholder="Enter the next signer's name"
                              />
                            </FormControl>

                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="email"
                        render={({ field }) => (
                          <FormItem className="flex-1">
                            <FormLabel>
                              <Trans>Email</Trans>
                            </FormLabel>
                            <FormControl>
                              <Input
                                {...field}
                                type="email"
                                className="mt-2"
                                placeholder="Enter the next signer's email"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  )}
                </div>
              )}

              <Separator className="my-4" />

              <DocumentSigningDisclosure className="mt-4" />

              <DialogFooter className="mt-4">
                <div className="flex w-full flex-1 flex-nowrap gap-4">
                  <Button
                    type="button"
                    className="flex-1"
                    variant="secondary"
                    onClick={() => setShowDialog(false)}
                    disabled={form.formState.isSubmitting}
                  >
                    Cancelar
                  </Button>

                  <Button
                    type="submit"
                    className="flex-1"
                    disabled={!isComplete || !isNextSignerValid}
                    loading={form.formState.isSubmitting}
                  >
                    {match(role)
                      .with(RecipientRole.VIEWER, () => 'Marcar como Visto')
                      .with(RecipientRole.SIGNER, () => 'Firmar')
                      .with(RecipientRole.APPROVER, () => 'Aprobar')
                      .with(RecipientRole.CC, () => 'Marcar como Visto')
                      .with(RecipientRole.ASSISTANT, () => 'Completar')
                      .exhaustive()}
                  </Button>
                </div>
              </DialogFooter>
            </fieldset>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};
