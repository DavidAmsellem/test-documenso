# SMS Authentication for Document Signing

This feature adds SMS verification as an additional authentication method for document signing in Documenso. Recipients can now be required to verify their phone number via SMS before accessing or signing documents.

## Features

- **SMS Verification**: Sends a 6-digit verification code via SMS
- **Phone Number Validation**: Uses libphonenumber-js for robust international phone number validation
- **Rate Limiting**: Prevents SMS abuse with configurable rate limits (default: 3 SMS per phone number per hour)
- **Multiple Providers**: Supports Twilio (production), Console (development), and Mock (testing) providers
- **Two-Step Flow**: Phone number entry → verification code input

## Configuration

### Environment Variables

Add these variables to your `.env` file:

```bash
# SMS Provider Configuration
SMS_PROVIDER="twilio"  # Options: console, mock, twilio
TWILIO_ACCOUNT_SID="your_account_sid"
TWILIO_AUTH_TOKEN="your_auth_token"
TWILIO_PHONE_NUMBER="+1234567890"  # Your Twilio phone number
```

### Providers

- **`console`**: Logs SMS messages to console (development)
- **`mock`**: Always succeeds without sending SMS (testing)
- **`twilio`**: Sends real SMS via Twilio (production)

## Usage

### 1. Document Setup

When creating or editing a document, you can now select "Require SMS" as an authentication method for recipients:

1. Go to document settings
2. Select a recipient
3. Choose "Require SMS" from authentication options
4. Save the document

### 2. Recipient Experience

When a recipient accesses a document with SMS authentication:

1. **Phone Number Entry**: Enter phone number with country code (e.g., +1234567890)
2. **SMS Delivery**: Receives 6-digit verification code via SMS
3. **Code Verification**: Enter the code to access the document
4. **Document Access**: Can now view and sign the document

### 3. Verification Process

- Verification codes expire after 10 minutes
- Rate limiting: Maximum 3 SMS per phone number per hour
- Phone numbers are validated using international standards
- Codes are 6 digits long and contain only numbers

## Implementation Details

### Database Schema

```sql
model SmsVerificationToken {
  id          Int      @id @default(autoincrement())
  token       String   @unique
  phoneNumber String
  recipientId Int?
  expiresAt   DateTime
  createdAt   DateTime @default(now())
  used        Boolean  @default(false)

  @@index([phoneNumber])
  @@index([token])
  @@index([expiresAt])
}
```

### API Endpoints

- `POST /api/sms/send-verification`: Send SMS verification code
- SMS verification is handled in the document authorization flow

### Security Features

- **Rate Limiting**: Prevents SMS bombing attacks
- **Token Expiration**: 10-minute expiry for verification codes
- **One-Time Use**: Tokens can only be used once
- **Phone Validation**: Comprehensive phone number validation
- **Error Handling**: Graceful fallbacks and error messages

## Testing

### Development Testing

Set `SMS_PROVIDER=console` to see SMS messages in the console:

```bash
=== SMS to +1234567890 ===
Your verification code for document "Test Document" is: 123456. This code expires in 10 minutes.
===================
```

### Unit Testing

Set `SMS_PROVIDER=mock` for automated testing environments.

### Production Testing

Use a test phone number with Twilio's test credentials to verify the flow without charges.

## Troubleshooting

### Common Issues

1. **Twilio Authentication Errors**

   - Verify TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN
   - Check that your Twilio phone number is verified
   - Ensure sufficient Twilio account balance

2. **Phone Number Validation Errors**

   - Use E.164 format (+1234567890)
   - Include country code
   - Remove spaces, dashes, or parentheses

3. **Rate Limiting**

   - Wait for the rate limit window to reset
   - Check rate limit configuration in code
   - Use different phone numbers for testing

4. **SMS Not Received**
   - Check phone number format
   - Verify Twilio account status
   - Check SMS delivery logs in Twilio console

### Configuration Examples

#### Development

```bash
SMS_PROVIDER=console
```

#### Testing

```bash
SMS_PROVIDER=mock
```

#### Production

```bash
SMS_PROVIDER=twilio
TWILIO_ACCOUNT_SID=AC21b544e6c50c04878f387cb8796c9c3a
TWILIO_AUTH_TOKEN=3875ac7441ae8588e3ffcf17bff96551
TWILIO_PHONE_NUMBER=+12317972455
```

## Architecture

The SMS authentication system consists of:

1. **Database Layer**: `SmsVerificationToken` model for token storage
2. **Service Layer**: SMS provider abstraction with Twilio, Console, and Mock implementations
3. **API Layer**: REST endpoint for sending verification codes
4. **UI Layer**: React components for phone entry and verification
5. **Authorization Layer**: Integration with document access control
6. **Validation Layer**: Phone number validation and rate limiting

## Future Enhancements

- International SMS pricing optimization
- Custom message templates
- SMS delivery status tracking
- Admin dashboard for SMS usage analytics
- Support for additional SMS providers (AWS SNS, etc.)
- Webhook support for delivery confirmations
