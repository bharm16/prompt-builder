export class TriggerValidationService {
  private readonly reservedTriggers = [
    '@system',
    '@admin',
    '@help',
    '@settings',
    '@all',
    '@everyone',
    '@here',
    '@channel',
    '@user',
    '@me',
    '@self',
  ];

  validate(trigger: string): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];
    const trimmed = trigger.trim();

    if (!trimmed.startsWith('@')) {
      errors.push('Trigger must start with @');
    }

    if (trimmed.length < 3) {
      errors.push('Trigger must be at least 3 characters (including @)');
    }

    if (trimmed.length > 20) {
      errors.push('Trigger must be 20 characters or less');
    }

    const afterAt = trimmed.slice(1);
    if (!/^[a-zA-Z][a-zA-Z0-9_]*$/.test(afterAt)) {
      errors.push('Trigger must start with a letter and contain only letters, numbers, and underscores');
    }

    if (this.reservedTriggers.includes(trimmed.toLowerCase())) {
      errors.push(`"${trimmed}" is a reserved trigger and cannot be used`);
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  normalize(trigger: string): string {
    return trigger.toLowerCase().trim();
  }

  format(trigger: string): string {
    if (!trigger.startsWith('@')) {
      return `@${trigger}`;
    }
    return trigger;
  }
}

export default TriggerValidationService;
