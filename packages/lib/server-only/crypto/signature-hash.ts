import { hashString } from '../auth/hash';

/**
 * Genera un hash SHA-512 para los datos de una firma
 */
export const generateSignatureHash = (signatureData: {
  recipientId: number;
  fieldId: number;
  signatureImageAsBase64?: string | null;
  typedSignature?: string | null;
  created: Date;
}): string => {
  // Crear un objeto con los datos relevantes de la firma
  const dataToHash = {
    recipientId: signatureData.recipientId,
    fieldId: signatureData.fieldId,
    signatureImageAsBase64: signatureData.signatureImageAsBase64,
    typedSignature: signatureData.typedSignature,
    created: signatureData.created.toISOString(),
  };

  return hashString(JSON.stringify(dataToHash));
};

/**
 * Genera un hash SHA-512 para un documento completo
 */
export const generateDocumentHash = (documentData: {
  id: number;
  title: string;
  documentDataId: string;
  completedAt?: Date | null;
  signatures: Array<{
    id: number;
    signatureHash?: string | null;
  }>;
}): string => {
  // Crear un objeto con los datos relevantes del documento
  const dataToHash = {
    id: documentData.id,
    title: documentData.title,
    documentDataId: documentData.documentDataId,
    completedAt: documentData.completedAt?.toISOString(),
    signatures: documentData.signatures.map((sig) => ({
      id: sig.id,
      signatureHash: sig.signatureHash,
    })),
  };

  return hashString(JSON.stringify(dataToHash));
};

/**
 * Verifica si un hash de firma es válido
 */
export const verifySignatureHash = (
  signatureData: {
    recipientId: number;
    fieldId: number;
    signatureImageAsBase64?: string | null;
    typedSignature?: string | null;
    created: Date;
  },
  expectedHash: string,
): boolean => {
  const calculatedHash = generateSignatureHash(signatureData);
  return calculatedHash === expectedHash;
};

/**
 * Verifica si un hash de documento es válido
 */
export const verifyDocumentHash = (
  documentData: {
    id: number;
    title: string;
    documentDataId: string;
    completedAt?: Date | null;
    signatures: Array<{
      id: number;
      signatureHash?: string | null;
    }>;
  },
  expectedHash: string,
): boolean => {
  const calculatedHash = generateDocumentHash(documentData);
  return calculatedHash === expectedHash;
};
