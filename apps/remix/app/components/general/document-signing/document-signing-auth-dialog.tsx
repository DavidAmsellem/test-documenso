import { Trans } from '@lingui/react/macro';
import { match } from 'ts-pattern';

import {
  DocumentAuth,
  type TRecipientActionAuth,
  type TRecipientActionAuthTypes,
} from '@documenso/lib/types/document-auth';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@documenso/ui/primitives/dialog';

import { DocumentSigningAuth2FA } from './document-signing-auth-2fa';
import { DocumentSigningAuthAccount } from './document-signing-auth-account';
import { DocumentSigningAuthPasskey } from './document-signing-auth-passkey';
import { useRequiredDocumentSigningAuthContext } from './document-signing-auth-provider';
import { DocumentSigningAuthSMS } from './document-signing-auth-sms';

export type DocumentSigningAuthDialogProps = {
  title?: string;
  documentAuthType: TRecipientActionAuthTypes;
  description?: string;

  open: boolean;
  onOpenChange: (value: boolean) => void;

  /**
   * The callback to run when the reauth form is filled out.
   */
  onReauthFormSubmit: (values?: TRecipientActionAuth) => Promise<void> | void;
};

export const DocumentSigningAuthDialog = ({
  title,
  description,
  documentAuthType,
  actionTarget: _actionTarget,
  open,
  onOpenChange,
  onReauthFormSubmit,
}: DocumentSigningAuthDialogProps) => {
  const {
    recipient: _recipient,
    user: _user,
    isCurrentlyAuthenticating,
  } = useRequiredDocumentSigningAuthContext();

  // ✅ QUITAR O COMENTAR ESTOS LOGS:
  // console.log('🔍 AUTH DIALOG RENDERED:', {
  //   documentAuthType,
  //   open,
  //   title,
  //   description,
  // });

  const handleOnOpenChange = (value: boolean) => {
    if (isCurrentlyAuthenticating) {
      return;
    }
    onOpenChange(value);
  };

  return (
    <Dialog open={open} onOpenChange={handleOnOpenChange}>
      <DialogContent className="w-full max-w-lg">
        <DialogHeader>
          <DialogTitle>{title || <Trans>Authentication required</Trans>}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>

        {/* ✅ QUITAR ESTE LOG: */}
        {/* {console.log('🔍 DIALOG MATCH INPUT:', {
          documentAuthType,
          typeof: typeof documentAuthType,
        })} */}

        {match({ documentAuthType })
          .with({ documentAuthType: DocumentAuth.ACCOUNT }, () => (
            <DocumentSigningAuthAccount
              open={open}
              onOpenChange={onOpenChange}
              onReauthFormSubmit={onReauthFormSubmit}
            />
          ))
          .with({ documentAuthType: DocumentAuth.PASSKEY }, () => (
            <DocumentSigningAuthPasskey
              open={open}
              onOpenChange={onOpenChange}
              onReauthFormSubmit={onReauthFormSubmit}
            />
          ))
          .with({ documentAuthType: DocumentAuth.TWO_FACTOR_AUTH }, () => (
            <DocumentSigningAuth2FA
              open={open}
              onOpenChange={onOpenChange}
              onReauthFormSubmit={onReauthFormSubmit}
            />
          ))
          .with({ documentAuthType: DocumentAuth.SMS }, () => {
            // ✅ QUITAR ESTE LOG:
            // console.log('🔍 MATCHING SMS CASE - Rendering DocumentSigningAuthSMS');
            return (
              <DocumentSigningAuthSMS
                open={open}
                onOpenChange={onOpenChange}
                onReauthFormSubmit={onReauthFormSubmit}
              />
            );
          })
          .with({ documentAuthType: DocumentAuth.EXPLICIT_NONE }, () => null)
          .exhaustive()}
      </DialogContent>
    </Dialog>
  );
};
