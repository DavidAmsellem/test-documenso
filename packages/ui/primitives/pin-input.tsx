import * as React from 'react';

import { OTPInput, OTPInputContext } from 'input-otp';
import { Minus } from 'lucide-react';

import { cn } from '../lib/utils';

const PinInput = React.forwardRef<
  React.ElementRef<typeof OTPInput>,
  React.ComponentPropsWithoutRef<typeof OTPInput>
>(({ className, containerClassName, value, defaultValue, ...props }, ref) => {
  // Debug logs para entender qué valores están llegando
  React.useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      console.log('🔍 PinInput Debug:', {
        value,
        defaultValue,
        hasValue: value !== undefined,
        hasDefaultValue: defaultValue !== undefined,
        valueLength: value?.length,
        valueType: typeof value,
        propsKeys: Object.keys(props),
      });
    }
  }, [value, defaultValue, props]);

  return (
    <OTPInput
      ref={ref}
      value={value}
      defaultValue={defaultValue}
      containerClassName={cn(
        'flex items-center gap-2 has-[:disabled]:opacity-50',
        containerClassName,
      )}
      className={cn('disabled:cursor-not-allowed', className)}
      autoComplete="one-time-code"
      inputMode="numeric"
      autoCorrect="off"
      spellCheck="false"
      autoCapitalize="off"
      data-lpignore="true"
      data-form-type="other"
      data-autocomplete="false"
      data-autofill="false"
      data-autofocus="false"
      role="presentation"
      data-browser-autocomplete="false"
      data-chrome-autocomplete="off"
      data-recaptcha="true"
      data-autocapitalize="off"
      data-autosubmit="off"
      data-browser-autofill-force-override="true"
      {...props}
    />
  );
});

PinInput.displayName = 'PinInput';

const PinInputGroup = React.forwardRef<
  React.ElementRef<'div'>,
  React.ComponentPropsWithoutRef<'div'>
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn('flex items-center', className)} {...props} />
));

PinInputGroup.displayName = 'PinInputGroup';

const PinInputSlot = React.forwardRef<
  React.ElementRef<'div'>,
  React.ComponentPropsWithoutRef<'div'> & { index: number }
>(({ index, className, ...props }, ref) => {
  const context = React.useContext(OTPInputContext);
  const { char, hasFakeCaret, isActive } = context.slots[index];

  const randomName = React.useMemo(
    () => `pin-${index}-${Math.random().toString(36).substring(2, 10)}`,
    [index],
  );

  return (
    <div
      ref={ref}
      className={cn(
        'border-input relative flex h-10 w-10 items-center justify-center border-y border-r font-mono shadow-sm transition-all first:rounded-l-md first:border-l last:rounded-r-md',
        isActive && 'ring-ring z-10 ring-1',
        className,
      )}
      autoComplete="new-password"
      inputMode="none"
      spellCheck="false"
      autoCorrect="off"
      autoCapitalize="off"
      aria-autocomplete="none"
      name={randomName}
      data-value={char || ''}
      data-random-name={randomName}
      data-autocomplete="off"
      data-autofill="off"
      data-autosubmit="off"
      data-autocomplete-type="off"
      data-browser-autofill-force-override="true"
      data-browser-autocomplete="false"
      data-chrome-autocomplete="disabled"
      data-for="pin-input"
      data-lpignore="true"
      data-temp-mail-org="0"
      data-recaptcha="true"
      data-form-type="other"
      data-credential-autofill="off"
      {...props}
    >
      {char}
      {hasFakeCaret && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="animate-caret-blink bg-foreground h-4 w-px duration-1000" />
        </div>
      )}
    </div>
  );
});

PinInputSlot.displayName = 'PinInputSlot';

const PinInputSeparator = React.forwardRef<
  React.ElementRef<'div'>,
  React.ComponentPropsWithoutRef<'div'>
>(({ ...props }, ref) => (
  <div ref={ref} role="separator" {...props}>
    <Minus className="h-5 w-5" />
  </div>
));

PinInputSeparator.displayName = 'PinInputSeparator';

export { PinInput, PinInputGroup, PinInputSlot, PinInputSeparator };
