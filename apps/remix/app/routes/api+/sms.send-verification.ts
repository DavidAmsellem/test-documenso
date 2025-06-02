import { initiateSmsVerification } from '@documenso/lib/server-only/sms';
import { validateAndFormatPhoneNumber } from '@documenso/lib/utils/phone-number';

import type { Route } from './+types/sms.send-verification';

export async function action({ request }: Route.ActionArgs) {
  if (request.method !== 'POST') {
    return Response.json({ error: 'Method not allowed' }, { status: 405 });
  }

  try {
    const body = await request.json();
    const { phoneNumber, recipientId, recipientName, documentTitle } = body;

    if (!phoneNumber) {
      return Response.json({ error: 'Phone number is required' }, { status: 400 });
    }

    // Validate and format phone number
    const validation = validateAndFormatPhoneNumber(phoneNumber);
    if (!validation.isValid) {
      return Response.json({ error: validation.error || 'Invalid phone number' }, { status: 400 });
    }

    const result = await initiateSmsVerification({
      phoneNumber: validation.formatted!,
      recipientId,
      recipientName,
      documentTitle,
      expiresInMinutes: 10,
    });

    if (!result.success) {
      return Response.json({ error: result.error || 'Failed to send SMS' }, { status: 400 });
    }

    return Response.json({ success: true });
  } catch (error) {
    console.error('SMS verification error:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
