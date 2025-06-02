import { writeFileSync } from 'fs';

import { addCertificationPage } from './add-certification-page';

/**
 * Script de prueba para verificar la generación de páginas de certificación
 */
async function testCertificationPage() {
  console.log('🧪 Testing certification page generation...');

  try {
    // Datos de prueba para los firmantes
    const testSigners = [
      {
        name: 'Juan Pérez García',
        email: 'juan.perez@email.com',
        signedAt: new Date('2024-01-15T10:30:00Z'),
        role: 'SIGNER',
      },
      {
        name: 'María López Rodríguez',
        email: 'maria.lopez@empresa.com',
        signedAt: new Date('2024-01-15T11:45:00Z'),
        role: 'APPROVER',
      },
    ];

    // Generar página de certificación de prueba
    const certificationPage = await addCertificationPage({
      documentId: 12345,
      documentTitle: 'Contrato de Prueba - Test Document',
      companyName: 'Mi Empresa S.L.',
      signers: testSigners,
    });

    if (certificationPage) {
      // Guardar archivo de prueba
      const outputPath = '/tmp/test-certification-page.pdf';
      writeFileSync(outputPath, certificationPage);

      console.log('✅ Test successful! Certification page generated at:', outputPath);
      console.log('📂 File size:', certificationPage.length, 'bytes');

      return true;
    } else {
      console.log('❌ Test failed: No certification page generated');
      return false;
    }
  } catch (error) {
    console.error('❌ Test failed with error:', error);
    return false;
  }
}

// Ejecutar prueba si se llama directamente
if (require.main === module) {
  testCertificationPage()
    .then((success) => {
      process.exit(success ? 0 : 1);
    })
    .catch((error) => {
      console.error('💥 Unexpected error:', error);
      process.exit(1);
    });
}

export { testCertificationPage };
