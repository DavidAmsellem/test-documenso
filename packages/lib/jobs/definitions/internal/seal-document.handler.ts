import { DocumentStatus, RecipientRole, SigningStatus, WebhookTriggerEvents } from '@prisma/client';
import { nanoid } from 'nanoid';
import path from 'node:path';
import { PDFDocument } from 'pdf-lib';

import { prisma } from '@documenso/prisma';
import { signPdf } from '@documenso/signing';

import { AppError, AppErrorCode } from '../../../errors/app-error';
import { generateDocumentHash } from '../../../server-only/crypto/signature-hash';
import { sendCompletedEmail } from '../../../server-only/document/send-completed-email';
import PostHogServerClient from '../../../server-only/feature-flags/get-post-hog-server-client';
import { getCertificatePdf } from '../../../server-only/htmltopdf/get-certificate-pdf';
import { addCertificationPage } from '../../../server-only/pdf/add-certification-page';
import { addRejectionStampToPdf } from '../../../server-only/pdf/add-rejection-stamp-to-pdf';
import { flattenAnnotations } from '../../../server-only/pdf/flatten-annotations';
import { flattenForm } from '../../../server-only/pdf/flatten-form';
import { insertFieldInPDF } from '../../../server-only/pdf/insert-field-in-pdf';
import { legacy_insertFieldInPDF } from '../../../server-only/pdf/legacy-insert-field-in-pdf';
import { normalizeSignatureAppearances } from '../../../server-only/pdf/normalize-signature-appearances';
import { triggerWebhook } from '../../../server-only/webhooks/trigger/trigger-webhook';
import { DOCUMENT_AUDIT_LOG_TYPE } from '../../../types/document-audit-logs';
import {
  ZWebhookDocumentSchema,
  mapDocumentToWebhookDocumentPayload,
} from '../../../types/webhook-payload';
import { prefixedId } from '../../../universal/id';
import { getFileServerSide } from '../../../universal/upload/get-file.server';
import { putPdfFileServerSide } from '../../../universal/upload/put-file.server';
import { fieldsContainUnsignedRequiredField } from '../../../utils/advanced-fields-helpers';
import { isDocumentCompleted } from '../../../utils/document';
import { createDocumentAuditLogData } from '../../../utils/document-audit-logs';
import type { JobRunIO } from '../../client/_internal/job';
import type { TSealDocumentJobDefinition } from './seal-document';

export const run = async ({
  payload,
  io,
}: {
  payload: TSealDocumentJobDefinition;
  io: JobRunIO;
}) => {
  const { documentId, sendEmail = true, isResealing = false, requestMetadata } = payload;

  const document = await prisma.document.findFirstOrThrow({
    where: {
      id: documentId,
    },
    include: {
      documentMeta: true,
      recipients: {
        include: {
          fields: {
            include: {
              signature: true,
            },
          },
        },
      },
      team: {
        select: {
          name: true,
          teamGlobalSettings: {
            select: {
              includeSigningCertificate: true,
            },
          },
        },
      },
    },
  });

  console.log(
    '🔍 HANDLER RECIPIENTS FROM DB:',
    document.recipients.map((r) => ({
      name: r.name,
      email: r.email,
      phone: r.phone,
      dni: r.dni,
    })),
  );

  const isComplete =
    document.recipients.some((recipient) => recipient.signingStatus === SigningStatus.REJECTED) ||
    document.recipients.every((recipient) => recipient.signingStatus === SigningStatus.SIGNED);

  if (!isComplete) {
    throw new AppError(AppErrorCode.UNKNOWN_ERROR, {
      message: 'Document is not complete',
    });
  }

  // Seems silly but we need to do this in case the job is re-ran
  // after it has already run through the update task further below.
  // eslint-disable-next-line @typescript-eslint/require-await
  const _documentStatus = await io.runTask('get-document-status', async () => {
    return document.status;
  });

  // This is the same case as above.
  // eslint-disable-next-line @typescript-eslint/require-await
  const documentDataId = await io.runTask('get-document-data-id', async () => {
    return document.documentDataId;
  });

  const documentData = await prisma.documentData.findFirst({
    where: {
      id: documentDataId,
    },
  });

  if (!documentData) {
    throw new Error(`Document ${document.id} has no document data`);
  }

  const recipients = await prisma.recipient.findMany({
    where: {
      documentId: document.id,
      role: {
        not: RecipientRole.CC,
      },
    },
    include: {
      fields: {
        include: {
          signature: true,
        },
      },
    },
  });

  // Determine if the document has been rejected by checking if any recipient has rejected it
  const rejectedRecipient = recipients.find(
    (recipient) => recipient.signingStatus === SigningStatus.REJECTED,
  );

  const isRejected = Boolean(rejectedRecipient);

  // Get the rejection reason from the rejected recipient
  const rejectionReason = rejectedRecipient?.rejectionReason ?? '';

  const fields = await prisma.field.findMany({
    where: {
      documentId: document.id,
    },
    include: {
      signature: true,
    },
  });

  // Skip the field check if the document is rejected
  if (!isRejected && fieldsContainUnsignedRequiredField(fields)) {
    throw new Error(`Document ${document.id} has unsigned required fields`);
  }

  if (isResealing) {
    // If we're resealing we want to use the initial data for the document
    // so we aren't placing fields on top of eachother.
    documentData.data = documentData.initialData;
  }

  if (!document.qrToken) {
    await prisma.document.update({
      where: {
        id: document.id,
      },
      data: {
        qrToken: prefixedId('qr'),
      },
    });
  }

  const pdfData = await getFileServerSide(documentData);

  const certificateData =
    (document.team?.teamGlobalSettings?.includeSigningCertificate ?? true)
      ? await getCertificatePdf({
          documentId,
          language: document.documentMeta?.language,
        }).catch(() => null)
      : null;

  const newDataId = await io.runTask('decorate-and-sign-pdf', async () => {
    const pdfDoc = await PDFDocument.load(pdfData);

    // Normalize and flatten layers that could cause issues with the signature
    normalizeSignatureAppearances(pdfDoc);
    flattenForm(pdfDoc);
    flattenAnnotations(pdfDoc);

    // Add rejection stamp if the document is rejected
    if (isRejected && rejectionReason) {
      await addRejectionStampToPdf(pdfDoc, rejectionReason);
    }

    if (certificateData) {
      const certificateDoc = await PDFDocument.load(certificateData);

      const certificatePages = await pdfDoc.copyPages(
        certificateDoc,
        certificateDoc.getPageIndices(),
      );

      certificatePages.forEach((page) => {
        pdfDoc.addPage(page);
      });
    }

    // Añadir página de certificación personalizada (nueva funcionalidad)
    if (document.team?.teamGlobalSettings?.includeSigningCertificate ?? true) {
      try {
        // Collect all signatures with hashes
        const allSignatures = recipients.flatMap((recipient) =>
          recipient.fields
            .filter((field) => field.signature)
            .map((field) => ({
              id: field.signature!.id,
              signatureHash: field.signature!.signatureHash,
            })),
        );

        // Generate document hash
        const documentHash = generateDocumentHash({
          id: document.id,
          title: document.title,
          documentDataId: document.documentDataId,
          completedAt: document.completedAt,
          signatures: allSignatures,
        });

        // Preparar información de los firmantes para la certificación
        const signersInfo = recipients.map((recipient) => {
          console.log('🔍 HANDLER DEBUG RECIPIENT:', {
            name: recipient.name,
            email: recipient.email,
            dni: recipient.dni,
            phone: recipient.phone,
          });

          return {
            name: recipient.name,
            email: recipient.email,
            dni: recipient.dni || undefined,
            phone: recipient.phone || undefined,
            signedAt: recipient.signedAt || undefined,
            role: recipient.role || undefined,
            signatureHash:
              recipient.fields.find((f) => f.signature)?.signature?.signatureHash || undefined,
          };
        });

        console.log('🔍 HANDLER SIGNERS INFO FINAL:', signersInfo);

        const customCertificationPage = await addCertificationPage({
          documentId: document.id,
          documentTitle: document.title,
          companyName: document.team?.name || 'Documenso',
          documentHash: documentHash,
          signers: signersInfo,
        });

        if (customCertificationPage) {
          const customCertDoc = await PDFDocument.load(customCertificationPage);
          const customCertPages = await pdfDoc.copyPages(
            customCertDoc,
            customCertDoc.getPageIndices(),
          );

          customCertPages.forEach((page) => {
            pdfDoc.addPage(page);
          });

          console.log('✅ Custom certification page added to document:', document.id);
        }
      } catch (error) {
        console.error('❌ Error adding custom certification page:', error);
        // Continue without the custom certification page - no need to fail the entire process
      }
    }

    for (const field of fields) {
      if (field.inserted) {
        document.useLegacyFieldInsertion
          ? await legacy_insertFieldInPDF(pdfDoc, field)
          : await insertFieldInPDF(pdfDoc, field);
      }
    }

    // Re-flatten the form to handle our checkbox and radio fields that
    // create native arcoFields
    flattenForm(pdfDoc);

    const pdfBytes = await pdfDoc.save();
    const pdfBuffer = await signPdf({ pdf: Buffer.from(pdfBytes) });

    const { name } = path.parse(document.title);

    // Add suffix based on document status
    const suffix = isRejected ? '_rejected.pdf' : '_signed.pdf';

    const documentData = await putPdfFileServerSide({
      name: `${name}${suffix}`,
      type: 'application/pdf',
      arrayBuffer: async () => Promise.resolve(pdfBuffer),
    });

    return documentData.id;
  });

  const postHog = PostHogServerClient();

  if (postHog) {
    postHog.capture({
      distinctId: nanoid(),
      event: 'App: Document Sealed',
      properties: {
        documentId: document.id,
        isRejected,
      },
    });
  }

  await io.runTask('update-document', async () => {
    await prisma.$transaction(async (tx) => {
      const newData = await tx.documentData.findFirstOrThrow({
        where: {
          id: newDataId,
        },
      });

      await tx.document.update({
        where: {
          id: document.id,
        },
        data: {
          status: isRejected ? DocumentStatus.REJECTED : DocumentStatus.COMPLETED,
          completedAt: new Date(),
        },
      });

      await tx.documentData.update({
        where: {
          id: documentData.id,
        },
        data: {
          data: newData.data,
        },
      });

      await tx.documentAuditLog.create({
        data: createDocumentAuditLogData({
          type: DOCUMENT_AUDIT_LOG_TYPE.DOCUMENT_COMPLETED,
          documentId: document.id,
          requestMetadata,
          user: null,
          data: {
            transactionId: nanoid(),
            ...(isRejected ? { isRejected: true, rejectionReason: rejectionReason } : {}),
          },
        }),
      });
    });
  });

  await io.runTask('send-completed-email', async () => {
    let shouldSendCompletedEmail = sendEmail && !isResealing && !isRejected;

    if (isResealing && !isDocumentCompleted(document.status)) {
      shouldSendCompletedEmail = sendEmail;
    }

    if (shouldSendCompletedEmail) {
      await sendCompletedEmail({ documentId, requestMetadata });
    }
  });

  const updatedDocument = await prisma.document.findFirstOrThrow({
    where: {
      id: document.id,
    },
    include: {
      documentData: true,
      documentMeta: true,
      recipients: true,
    },
  });

  await triggerWebhook({
    event: isRejected
      ? WebhookTriggerEvents.DOCUMENT_REJECTED
      : WebhookTriggerEvents.DOCUMENT_COMPLETED,
    data: ZWebhookDocumentSchema.parse(mapDocumentToWebhookDocumentPayload(updatedDocument)),
    userId: updatedDocument.userId,
    teamId: updatedDocument.teamId ?? undefined,
  });
};
