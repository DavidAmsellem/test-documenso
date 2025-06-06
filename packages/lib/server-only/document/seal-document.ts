import { DocumentStatus, RecipientRole, SigningStatus, WebhookTriggerEvents } from '@prisma/client';
import { nanoid } from 'nanoid';
import path from 'node:path';
import { PDFDocument } from 'pdf-lib';

import PostHogServerClient from '@documenso/lib/server-only/feature-flags/get-post-hog-server-client';
import { DOCUMENT_AUDIT_LOG_TYPE } from '@documenso/lib/types/document-audit-logs';
import { createDocumentAuditLogData } from '@documenso/lib/utils/document-audit-logs';
import { prisma } from '@documenso/prisma';
import { signPdf } from '@documenso/signing';

import {
  ZWebhookDocumentSchema,
  mapDocumentToWebhookDocumentPayload,
} from '../../types/webhook-payload';
import type { RequestMetadata } from '../../universal/extract-request-metadata';
import { getFileServerSide } from '../../universal/upload/get-file.server';
import { putPdfFileServerSide } from '../../universal/upload/put-file.server';
import { fieldsContainUnsignedRequiredField } from '../../utils/advanced-fields-helpers';
import { generateDocumentHash } from '../crypto/signature-hash';
import { getCertificatePdf } from '../htmltopdf/get-certificate-pdf';
import { addCertificationPage } from '../pdf/add-certification-page';
import { addRejectionStampToPdf } from '../pdf/add-rejection-stamp-to-pdf';
import { flattenAnnotations } from '../pdf/flatten-annotations';
import { flattenForm } from '../pdf/flatten-form';
import { insertFieldInPDF } from '../pdf/insert-field-in-pdf';
import { legacy_insertFieldInPDF } from '../pdf/legacy-insert-field-in-pdf';
import { normalizeSignatureAppearances } from '../pdf/normalize-signature-appearances';
import { triggerWebhook } from '../webhooks/trigger/trigger-webhook';
import { sendCompletedEmail } from './send-completed-email';

export type SealDocumentOptions = {
  documentId: number;
  sendEmail?: boolean;
  isResealing?: boolean;
  requestMetadata?: RequestMetadata;
};

export const sealDocument = async ({
  documentId,
  sendEmail = true,
  isResealing = false,
  requestMetadata,
}: SealDocumentOptions) => {
  const document = await prisma.document.findFirstOrThrow({
    where: {
      id: documentId,
      status: DocumentStatus.COMPLETED,
    },
    include: {
      documentData: true,
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
    '🔍 DOCUMENT RECIPIENTS FROM DB:',
    document.recipients.map((r) => ({
      name: r.name,
      email: r.email,
      phone: r.phone,
      dni: r.dni,
    })),
  );

  const { documentData } = document;

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

  // If the document is not rejected, ensure all recipients have signed
  if (
    !isRejected &&
    recipients.some((recipient) => recipient.signingStatus !== SigningStatus.SIGNED)
  ) {
    throw new Error(`Document ${document.id} has unsigned recipients`);
  }

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

  // !: Need to write the fields onto the document as a hard copy
  const pdfData = await getFileServerSide(documentData);

  const certificateData =
    (document.team?.teamGlobalSettings?.includeSigningCertificate ?? true)
      ? await getCertificatePdf({
          documentId,
          language: document.documentMeta?.language,
        }).catch(() => null)
      : null;

  const doc = await PDFDocument.load(pdfData);

  // Normalize and flatten layers that could cause issues with the signature
  normalizeSignatureAppearances(doc);
  flattenForm(doc);
  flattenAnnotations(doc);

  // Add rejection stamp if the document is rejected
  if (isRejected && rejectionReason) {
    await addRejectionStampToPdf(doc, rejectionReason);
  }

  if (certificateData) {
    const certificate = await PDFDocument.load(certificateData);

    const certificatePages = await doc.copyPages(certificate, certificate.getPageIndices());

    certificatePages.forEach((page) => {
      doc.addPage(page);
    });
  } // Añadir página de certificación personalizada (nueva funcionalidad)
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
        console.log('🔍 DEBUG RECIPIENT DATA:', {
          name: recipient.name,
          email: recipient.email,
          dni: recipient.dni,
          phone: recipient.phone,
          hasSignature: recipient.fields.some((f) => f.signature),
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

      console.log('🔍 SIGNERS INFO FINAL:', signersInfo);

      const customCertificationPage = await addCertificationPage({
        documentId: document.id,
        documentTitle: document.title,
        companyName: document.team?.name || 'Documenso',
        documentHash: documentHash,
        signers: signersInfo,
      });

      if (customCertificationPage) {
        const customCertDoc = await PDFDocument.load(customCertificationPage);
        const customCertPages = await doc.copyPages(customCertDoc, customCertDoc.getPageIndices());

        customCertPages.forEach((page) => {
          doc.addPage(page);
        });

        console.log('✅ Custom certification page added to document:', document.id);
      }
    } catch (error) {
      console.error('❌ Error adding custom certification page:', error);
      // Continue without the custom certification page - no need to fail the entire process
    }
  }

  for (const field of fields) {
    document.useLegacyFieldInsertion
      ? await legacy_insertFieldInPDF(doc, field)
      : await insertFieldInPDF(doc, field);
  }

  // Re-flatten post-insertion to handle fields that create arcoFields
  flattenForm(doc);

  const pdfBytes = await doc.save();

  const pdfBuffer = await signPdf({ pdf: Buffer.from(pdfBytes) });

  const { name } = path.parse(document.title);

  // Add suffix based on document status
  const suffix = isRejected ? '_rejected.pdf' : '_signed.pdf';

  const { data: newData } = await putPdfFileServerSide({
    name: `${name}${suffix}`,
    type: 'application/pdf',
    arrayBuffer: async () => Promise.resolve(pdfBuffer),
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

  await prisma.$transaction(async (tx) => {
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
        data: newData,
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
          ...(isRejected ? { isRejected: true, rejectionReason } : {}),
        },
      }),
    });
  });

  if (sendEmail && !isResealing) {
    await sendCompletedEmail({ documentId, requestMetadata });
  }

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
    userId: document.userId,
    teamId: document.teamId ?? undefined,
  });
};
