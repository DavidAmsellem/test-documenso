import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';

/**
 * Información del firmante para la certificación
 */
interface SignerInfo {
  name: string;
  email: string;
  dni?: string; // No disponible en el modelo actual
  phone?: string; // No disponible en el modelo actual
  signedAt?: Date;
  role?: string;
  signatureHash?: string; // SHA-512 hash de la firma
}

/**
 * Opciones para la página de certificación
 */
interface CertificationPageOptions {
  documentId: number;
  documentTitle: string;
  companyName?: string;
  documentHash?: string; // SHA-512 hash del documento
  signers?: SignerInfo[];
}

/**
 * Genera una página de certificación completa para añadir al PDF firmado
 * Incluye información de los firmantes: nombre, email, DNI, teléfono
 */
export async function addCertificationPage(
  options: CertificationPageOptions,
): Promise<Buffer | null> {
  try {
    console.log('📄 Starting certification page creation for document:', options.documentId);

    const {
      documentId,
      documentTitle,
      companyName = 'Documenso',
      documentHash,
      signers = [],
    } = options;

    // Crear nuevo documento PDF con una página A4
    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage([595.276, 841.89]); // A4 size
    const { width, height } = page.getSize();

    // Cargar fuentes básicas
    const titleFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    const normalFont = await pdfDoc.embedFont(StandardFonts.Helvetica);

    // Dibujar contenido básico
    let currentY = height - 100;

    // === TÍTULO PRINCIPAL ===
    page.drawText('CERTIFICADO DE FIRMA DIGITAL', {
      x: 50,
      y: currentY,
      size: 18,
      font: titleFont,
      color: rgb(0.1, 0.1, 0.5),
    });

    currentY -= 40;

    // === INFORMACIÓN BÁSICA ===
    page.drawText('Información del Documento:', {
      x: 50,
      y: currentY,
      size: 14,
      font: titleFont,
      color: rgb(0.2, 0.2, 0.2),
    });

    currentY -= 30;

    // Título del documento
    page.drawText(`Título: ${documentTitle}`, {
      x: 70,
      y: currentY,
      size: 11,
      font: normalFont,
      color: rgb(0.3, 0.3, 0.3),
    });

    currentY -= 20;

    // ID del documento
    page.drawText(`ID de Documento: DOC-${documentId.toString().padStart(6, '0')}`, {
      x: 70,
      y: currentY,
      size: 11,
      font: normalFont,
      color: rgb(0.3, 0.3, 0.3),
    });

    currentY -= 20;

    // Fecha de generación
    const now = new Date();
    page.drawText(
      `Fecha de Certificación: ${now.toLocaleDateString('es-ES', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })}`,
      {
        x: 70,
        y: currentY,
        size: 11,
        font: normalFont,
        color: rgb(0.3, 0.3, 0.3),
      },
    );

    currentY -= 50;

    // === INFORMACIÓN DE FIRMANTES ===
    if (signers.length > 0) {
      page.drawText('Firmantes del Documento:', {
        x: 50,
        y: currentY,
        size: 14,
        font: titleFont,
        color: rgb(0.2, 0.2, 0.2),
      });

      currentY -= 25;

      signers.forEach((signer, index) => {
        // Nombre del firmante
        page.drawText(`${index + 1}. ${signer.name}`, {
          x: 70,
          y: currentY,
          size: 12,
          font: titleFont,
          color: rgb(0.1, 0.1, 0.1),
        });

        currentY -= 18;

        // Email
        page.drawText(`   Email: ${signer.email}`, {
          x: 70,
          y: currentY,
          size: 10,
          font: normalFont,
          color: rgb(0.4, 0.4, 0.4),
        });

        currentY -= 15;

        // DNI (si está disponible)
        if (signer.dni) {
          page.drawText(`   DNI/ID: ${signer.dni}`, {
            x: 70,
            y: currentY,
            size: 10,
            font: normalFont,
            color: rgb(0.4, 0.4, 0.4),
          });

          currentY -= 15;
        }

        // Teléfono (si está disponible)
        if (signer.phone) {
          page.drawText(`   Teléfono: ${signer.phone}`, {
            x: 70,
            y: currentY,
            size: 10,
            font: normalFont,
            color: rgb(0.4, 0.4, 0.4),
          });

          currentY -= 15;
        }

        // Fecha de firma (si está disponible)
        if (signer.signedAt) {
          page.drawText(
            `   Firmado el: ${signer.signedAt.toLocaleDateString('es-ES', {
              year: 'numeric',
              month: 'long',
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
            })}`,
            {
              x: 70,
              y: currentY,
              size: 10,
              font: normalFont,
              color: rgb(0.4, 0.4, 0.4),
            },
          );

          currentY -= 15;
        }

        // Rol (si está disponible)
        if (signer.role) {
          page.drawText(`   Rol: ${signer.role}`, {
            x: 70,
            y: currentY,
            size: 10,
            font: normalFont,
            color: rgb(0.4, 0.4, 0.4),
          });

          currentY -= 15;
        }

        // Hash de la firma (si está disponible)
        if (signer.signatureHash) {
          page.drawText(`   Hash de Firma: ${signer.signatureHash.substring(0, 32)}...`, {
            x: 70,
            y: currentY,
            size: 9,
            font: normalFont,
            color: rgb(0.2, 0.5, 0.2),
          });

          currentY -= 15;
        }

        currentY -= 10; // Espacio entre firmantes
      });

      currentY -= 20;
    } else {
      // Si no hay información de firmantes, mostrar mensaje genérico
      page.drawText('Documento firmado digitalmente', {
        x: 50,
        y: currentY,
        size: 12,
        font: normalFont,
        color: rgb(0.3, 0.3, 0.3),
      });

      currentY -= 40;
    }

    // === INFORMACIÓN DE INTEGRIDAD ===
    page.drawText('Información de Integridad:', {
      x: 50,
      y: currentY,
      size: 14,
      font: titleFont,
      color: rgb(0.2, 0.2, 0.2),
    });

    currentY -= 25;

    // Hash del documento
    if (documentHash) {
      page.drawText('Hash del Documento (SHA-512):', {
        x: 70,
        y: currentY,
        size: 11,
        font: titleFont,
        color: rgb(0.3, 0.3, 0.3),
      });

      currentY -= 18;

      // Dividir el hash en líneas para mejor legibilidad
      const hashLines = [documentHash.substring(0, 64), documentHash.substring(64, 128)];

      hashLines.forEach((line) => {
        page.drawText(line, {
          x: 70,
          y: currentY,
          size: 8,
          font: normalFont,
          color: rgb(0.2, 0.5, 0.2),
        });
        currentY -= 12;
      });

      currentY -= 15;
    }

    // Información adicional sobre verificación
    page.drawText('Este hash permite verificar la integridad del documento.', {
      x: 70,
      y: currentY,
      size: 10,
      font: normalFont,
      color: rgb(0.4, 0.4, 0.4),
    });

    currentY -= 30;

    // === PIE DE PÁGINA ===
    page.drawText(`Certificado generado por ${companyName}`, {
      x: 50,
      y: 50,
      size: 10,
      font: normalFont,
      color: rgb(0.5, 0.5, 0.5),
    });

    // Línea decorativa
    page.drawLine({
      start: { x: 50, y: height - 130 },
      end: { x: width - 50, y: height - 130 },
      thickness: 2,
      color: rgb(0.1, 0.1, 0.5),
    });

    console.log('✅ Basic certification page created successfully');

    // Exportar como Buffer
    const pdfBytes = await pdfDoc.save();
    return Buffer.from(pdfBytes);
  } catch (error) {
    console.error('❌ Error creating certification page:', error);
    return null;
  }
}
