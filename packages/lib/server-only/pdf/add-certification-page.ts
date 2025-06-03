import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';

/**
 * Información del firmante para la certificación
 */
interface SignerInfo {
  name: string;
  email: string;
  dni?: string;
  phone?: string;
  signedAt?: Date;
  role?: string;
  signatureHash?: string;
}

/**
 * Opciones para la página de certificación
 */
interface CertificationPageOptions {
  documentId: number;
  documentTitle: string;
  companyName?: string;
  documentHash?: string;
  signers?: SignerInfo[];
}

export async function addCertificationPage(
  options: CertificationPageOptions,
): Promise<Buffer | null> {
  try {
    console.log('📄 Starting certification page creation for document:', options.documentId);
    console.log('🔍 CERTIFICATION OPTIONS:', {
      documentId: options.documentId,
      documentTitle: options.documentTitle,
      signersCount: options.signers?.length || 0,
      signers: options.signers?.map((s) => ({
        name: s.name,
        email: s.email,
        phone: s.phone,
        dni: s.dni,
      })),
    });

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

    // Constantes para el layout
    const margin = 50;
    const lineHeight = 15;

    // Dibujar contenido básico
    let currentY = height - 100;

    // === TÍTULO PRINCIPAL ===
    page.drawText('CERTIFICADO DE FIRMA DIGITAL', {
      x: margin,
      y: currentY,
      size: 18,
      font: titleFont,
      color: rgb(0.1, 0.1, 0.5),
    });

    currentY -= 40;

    // === INFORMACIÓN BÁSICA ===
    page.drawText('Información del Documento:', {
      x: margin,
      y: currentY,
      size: 14,
      font: titleFont,
      color: rgb(0.2, 0.2, 0.2),
    });

    currentY -= 30;

    // Título del documento
    page.drawText(`Título: ${documentTitle}`, {
      x: margin + 20,
      y: currentY,
      size: 11,
      font: normalFont,
      color: rgb(0.3, 0.3, 0.3),
    });

    currentY -= 20;

    // ID del documento
    page.drawText(`ID de Documento: DOC-${documentId.toString().padStart(6, '0')}`, {
      x: margin + 20,
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
        x: margin + 20,
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
        x: margin,
        y: currentY,
        size: 14,
        font: titleFont,
        color: rgb(0.2, 0.2, 0.2),
      });

      currentY -= 25;

      // Dibujar información de los firmantes
      signers.forEach((signer, index) => {
        console.log(`🔍 PROCESSING SIGNER ${index + 1}:`, {
          name: signer.name,
          email: signer.email,
          phone: signer.phone,
          dni: signer.dni,
        });

        const signerNumber = index + 1;

        // Número y nombre del firmante
        page.drawText(`${signerNumber}. ${signer.name}`, {
          x: margin,
          y: currentY,
          size: 12,
          font: titleFont,
          color: rgb(0.1, 0.1, 0.1),
        });
        currentY -= lineHeight;

        // Email
        page.drawText(` Email: ${signer.email}`, {
          x: margin + 10,
          y: currentY,
          size: 10,
          font: normalFont,
          color: rgb(0.3, 0.3, 0.3),
        });
        currentY -= lineHeight;

        // DNI si está disponible
        if (signer.dni) {
          console.log(`✅ DRAWING DNI for ${signer.name}: ${signer.dni}`);
          page.drawText(` DNI: ${signer.dni}`, {
            x: margin + 10,
            y: currentY,
            size: 10,
            font: normalFont,
            color: rgb(0.3, 0.3, 0.3),
          });
          currentY -= lineHeight;
        } else {
          console.log(`❌ NO DNI for ${signer.name}`);
        }

        // Teléfono si está disponible
        if (signer.phone) {
          console.log(`✅ DRAWING PHONE for ${signer.name}: ${signer.phone}`);
          page.drawText(` Teléfono: ${signer.phone}`, {
            x: margin + 10,
            y: currentY,
            size: 10,
            font: normalFont,
            color: rgb(0.3, 0.3, 0.3),
          });
          currentY -= lineHeight;
        } else {
          console.log(`❌ NO PHONE for ${signer.name}`);
        }

        // Fecha de firma
        if (signer.signedAt) {
          const signedDate = signer.signedAt.toLocaleDateString('es-ES', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
          });
          const signedTime = signer.signedAt.toLocaleTimeString('es-ES', {
            hour: '2-digit',
            minute: '2-digit',
          });

          page.drawText(` Firmado el: ${signedDate}, ${signedTime}`, {
            x: margin + 10,
            y: currentY,
            size: 10,
            font: normalFont,
            color: rgb(0.3, 0.3, 0.3),
          });
          currentY -= lineHeight;
        }

        // Rol
        if (signer.role) {
          page.drawText(` Rol: ${signer.role}`, {
            x: margin + 10,
            y: currentY,
            size: 10,
            font: normalFont,
            color: rgb(0.3, 0.3, 0.3),
          });
          currentY -= lineHeight;
        }

        // Hash de firma
        if (signer.signatureHash) {
          const shortHash = `${signer.signatureHash.substring(0, 32)}...`;
          page.drawText(` Hash de Firma: ${shortHash}`, {
            x: margin + 10,
            y: currentY,
            size: 10,
            font: normalFont,
            color: rgb(0.3, 0.3, 0.3),
          });
          currentY -= lineHeight;
        }

        currentY -= 10; // Espacio entre firmantes
      });

      currentY -= 20;
    } else {
      // Si no hay información de firmantes, mostrar mensaje genérico
      page.drawText('Documento firmado digitalmente', {
        x: margin,
        y: currentY,
        size: 12,
        font: normalFont,
        color: rgb(0.3, 0.3, 0.3),
      });

      currentY -= 40;
    }

    // === INFORMACIÓN DE INTEGRIDAD ===
    page.drawText('Información de Integridad:', {
      x: margin,
      y: currentY,
      size: 14,
      font: titleFont,
      color: rgb(0.2, 0.2, 0.2),
    });

    currentY -= 25;

    // Hash del documento
    if (documentHash) {
      page.drawText('Hash del Documento (SHA-512):', {
        x: margin + 20,
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
          x: margin + 20,
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
      x: margin + 20,
      y: currentY,
      size: 10,
      font: normalFont,
      color: rgb(0.4, 0.4, 0.4),
    });

    currentY -= 30;

    // === PIE DE PÁGINA ===
    page.drawText(`Certificado generado por ${companyName}`, {
      x: margin,
      y: 50,
      size: 10,
      font: normalFont,
      color: rgb(0.5, 0.5, 0.5),
    });

    // Línea decorativa
    page.drawLine({
      start: { x: margin, y: height - 130 },
      end: { x: width - margin, y: height - 130 },
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
