import { initiateSmsVerification } from '../server-only/sms';
import { validateAndFormatPhoneNumber } from '../utils/phone-number';

/**
 * Simple test script to verify SMS functionality
 */
async function testSmsSystem() {
  console.log('🧪 Testing SMS Authentication System...\n');

  // Test 1: Phone number validation
  console.log('📱 Testing phone number validation:');
  const testNumbers = ['+12317972455', '+1-231-797-2455', '2317972455', '+invalid', ''];

  for (const number of testNumbers) {
    const result = validateAndFormatPhoneNumber(number, 'US');
    console.log(
      `  ${number.padEnd(20)} -> ${result.isValid ? '✅' : '❌'} ${result.formatted || result.error}`,
    );
  }

  // Test 2: SMS sending (with console provider)
  console.log('\n📤 Testing SMS sending with console provider:');
  try {
    const result = await initiateSmsVerification({
      phoneNumber: '+12317972455',
      recipientName: 'Test User',
      documentTitle: 'Test Document',
      expiresInMinutes: 10,
    });

    if (result.success) {
      console.log('  ✅ SMS verification initiated successfully');
    } else {
      console.log(`  ❌ SMS verification failed: ${result.error}`);
    }
  } catch (error) {
    console.log(`  ❌ SMS verification error: ${error}`);
  }

  // Test 3: Rate limiting
  console.log('\n🚦 Testing rate limiting:');
  const phoneNumber = '+12317972455';

  for (let i = 1; i <= 5; i++) {
    try {
      const result = await initiateSmsVerification({
        phoneNumber,
        recipientName: 'Test User',
        documentTitle: 'Test Document',
      });

      if (result.success) {
        console.log(`  Attempt ${i}: ✅ SMS sent`);
      } else {
        console.log(`  Attempt ${i}: ❌ ${result.error}`);
      }
    } catch (error) {
      console.log(`  Attempt ${i}: ❌ Error: ${error}`);
    }
  }

  console.log('\n🎉 SMS system test completed!');
}

// Only run if called directly
if (require.main === module) {
  testSmsSystem().catch(console.error);
}

export { testSmsSystem };
