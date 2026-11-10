export class CalMeterError extends Error {
  public readonly code: string;

  constructor(message: string, code: string = 'CAL_METER_ERROR') {
    super(message);
    this.name = 'CalMeterError';
    this.code = code;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class UnsupportedPopulationError extends CalMeterError {
  constructor(message: string, code: string = 'UNSUPPORTED_POPULATION') {
    super(message, code);
    this.name = 'UnsupportedPopulationError';
  }
}

export class CalculationSafetyError extends CalMeterError {
  public readonly details?: Record<string, unknown>;

  constructor(
    message: string,
    code: string = 'CALCULATION_SAFETY_VIOLATION',
    details?: Record<string, unknown>,
  ) {
    super(message, code);
    this.name = 'CalculationSafetyError';
    this.details = details;
  }
}

export class ServingConversionError extends CalMeterError {
  constructor(message: string, code: string = 'SERVING_CONVERSION_ERROR') {
    super(message, code);
    this.name = 'ServingConversionError';
  }
}

export class DomainValidationError extends CalMeterError {
  constructor(message: string, code: string = 'VALIDATION_ERROR') {
    super(message, code);
    this.name = 'DomainValidationError';
  }
}
