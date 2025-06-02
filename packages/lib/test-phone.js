#!/usr/bin/env node

// Simple SMS test script
const { validateAndFormatPhoneNumber } = require('./utils/phone-number');

async function testPhoneValidation() {
  console.log('🧪 Testing Phone Number Validation...\n');

  const testNumbers = [
    '+12317972455', // Valid US number
    '+1-231-797-2455', // Valid with formatting
    '2317972455', // Missing country code
    '+invalid', // Invalid
    '', // Empty
  ];

  testNumbers.forEach((number) => {
    try {
      const result = validateAndFormatPhoneNumber(number, 'US');
      console.log(
        `${number.padEnd(20)} -> ${result.isValid ? '✅' : '❌'} ${result.formatted || result.error}`,
      );
    } catch (error) {
      console.log(`${number.padEnd(20)} -> ❌ Error: ${error.message}`);
    }
  });

  console.log('\n✅ Phone validation test completed!');
}

testPhoneValidation().catch(console.error);
