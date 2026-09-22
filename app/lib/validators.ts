/**
 * Almadel Universal Input Validators
 * Centralized, strict, and user-friendly validation functions across all forms and fields.
 */

// Phone number regex (Supports Pakistani formats: 03001234567, 0300-1234567, +923001234567, and international: +1..., etc.)
export const PHONE_REGEX = /^(\+92|0092|0)?3[0-9]{9}$|^(\+)?[1-9][0-9]{9,14}$/;

// Standard Email regex
export const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

// NTN regex (7 digits + 1 check digit: e.g. 1234567-8 or 12345678)
export const NTN_REGEX = /^[0-9]{7}-?[0-9]$/;

// STRN regex (13 digits: e.g. 12-34-5678-901-23 or 13 digits)
export const STRN_REGEX = /^[0-9]{2}-?[0-9]{2}-?[0-9]{4}-?[0-9]{3}-?[0-9]{2}$|^[0-9]{13}$/;

export type ValidationResult = {
  valid: boolean;
  error: string | null;
};

export type PhoneOptions = {
  required?: boolean;
  fieldName?: string;
  fieldLabel?: string;
};

export type TextOptions = {
  min?: number;
  minLength?: number;
  max?: number;
  maxLength?: number;
  required?: boolean;
  fieldName?: string;
  fieldLabel?: string;
};

export type NumberOptions = {
  min?: number;
  max?: number;
  integer?: boolean;
  integerOnly?: boolean;
  required?: boolean;
  fieldName?: string;
  fieldLabel?: string;
};

/**
 * Validates a mobile or phone number.
 */
export function validatePhone(
  value: string | undefined | null,
  options: boolean | PhoneOptions = true,
  deprecatedLabel?: string
): ValidationResult {
  const isReq = typeof options === "boolean" ? options : options.required ?? true;
  const label = typeof options === "object" ? options.fieldName || options.fieldLabel || "Mobile number" : deprecatedLabel || "Mobile number";

  const trimmed = String(value ?? "").trim();
  if (!trimmed) {
    return isReq
      ? { valid: false, error: `${label} is required.` }
      : { valid: true, error: null };
  }

  // Clean formatted separators
  const cleanNumber = trimmed.replace(/[\s\-_()]/g, "");
  const digitsOnly = cleanNumber.replace(/^\+/, "");

  if (!/^\+?[0-9]+$/.test(cleanNumber)) {
    return { valid: false, error: `${label} can only contain numbers and an optional leading '+'.` };
  }

  if (digitsOnly.length < 10) {
    return { valid: false, error: `${label} must be at least 10 digits (e.g. 0300-1234567).` };
  }

  if (digitsOnly.length > 15) {
    return { valid: false, error: `${label} cannot exceed 15 digits (currently ${digitsOnly.length} digits).` };
  }

  if (!PHONE_REGEX.test(cleanNumber)) {
    return { valid: false, error: `Please enter a valid ${label.toLowerCase()} (e.g. 03XXXXXXXXX or +923XXXXXXXXX).` };
  }

  return { valid: true, error: null };
}

/**
 * Validates an email address.
 */
export function validateEmail(
  value: string | undefined | null,
  options: boolean | PhoneOptions = false,
  deprecatedLabel?: string
): ValidationResult {
  const isReq = typeof options === "boolean" ? options : options.required ?? false;
  const label = typeof options === "object" ? options.fieldName || options.fieldLabel || "Email address" : deprecatedLabel || "Email address";

  const trimmed = String(value ?? "").trim();
  if (!trimmed) {
    return isReq
      ? { valid: false, error: `${label} is required.` }
      : { valid: true, error: null };
  }

  if (trimmed.length > 100) {
    return { valid: false, error: `${label} cannot exceed 100 characters.` };
  }

  if (!EMAIL_REGEX.test(trimmed)) {
    return { valid: false, error: "Please enter a valid email address (e.g. shop@almadel.com)." };
  }

  return { valid: true, error: null };
}

/**
 * Validates text string (name, title, category, etc.).
 */
export function validateText(
  value: string | undefined | null,
  options: TextOptions = {}
): ValidationResult {
  const min = options.minLength ?? options.min ?? 1;
  const max = options.maxLength ?? options.max ?? 200;
  const required = options.required ?? true;
  const label = options.fieldName ?? options.fieldLabel ?? "Field";

  const trimmed = String(value ?? "").trim();

  if (!trimmed) {
    return required
      ? { valid: false, error: `${label} is required.` }
      : { valid: true, error: null };
  }

  if (trimmed.length < min) {
    return { valid: false, error: `${label} must be at least ${min} characters.` };
  }

  if (trimmed.length > max) {
    return { valid: false, error: `${label} cannot exceed ${max} characters.` };
  }

  return { valid: true, error: null };
}

/**
 * Validates a numeric value (price, stock, amount, etc.).
 */
export function validateNumber(
  value: number | string | undefined | null,
  options: NumberOptions = {}
): ValidationResult {
  const min = options.min ?? 0;
  const max = options.max ?? 1_000_000_000;
  const integer = options.integerOnly ?? options.integer ?? false;
  const required = options.required ?? true;
  const label = options.fieldName ?? options.fieldLabel ?? "Value";

  if (value === undefined || value === null || String(value).trim() === "") {
    return required
      ? { valid: false, error: `${label} is required.` }
      : { valid: true, error: null };
  }

  const num = Number(value);
  if (isNaN(num)) {
    return { valid: false, error: `${label} must be a valid number.` };
  }

  if (integer && !Number.isInteger(num)) {
    return { valid: false, error: `${label} must be a whole number (no decimals).` };
  }

  if (num < min) {
    return { valid: false, error: `${label} cannot be less than ${min}.` };
  }

  if (num > max) {
    return { valid: false, error: `${label} cannot exceed ${max.toLocaleString()}.` };
  }

  return { valid: true, error: null };
}

/**
 * Validates password strength.
 */
export function validatePassword(
  value: string | undefined | null,
  options: { min?: number; max?: number; required?: boolean; fieldName?: string; fieldLabel?: string } = {}
): ValidationResult {
  const min = options.min ?? 8;
  const max = options.max ?? 128;
  const required = options.required ?? true;
  const label = options.fieldName ?? options.fieldLabel ?? "Password";
  const str = String(value ?? "");

  if (!str) {
    return required
      ? { valid: false, error: `${label} is required.` }
      : { valid: true, error: null };
  }

  if (str.length < min) {
    return { valid: false, error: `${label} must contain at least ${min} characters.` };
  }

  if (str.length > max) {
    return { valid: false, error: `${label} cannot exceed ${max} characters.` };
  }

  return { valid: true, error: null };
}

/**
 * Sanitizes phone input: keeps only digits and optional leading +.
 */
export function sanitizePhoneInput(input: string): string {
  const trimmed = input.trim();
  const hasLeadingPlus = trimmed.startsWith("+");
  const digitsOnly = trimmed.replace(/[^0-9]/g, "");
  const result = (hasLeadingPlus ? "+" : "") + digitsOnly;
  return result.slice(0, 16); // max 15 digits + 1 plus
}

/**
 * Formats a raw number string into financial figures with thousand commas:
 * e.g. "1000000" -> "1,000,000", 1250500 -> "1,250,500"
 */
export function formatCurrencyInput(value: string | number | undefined | null): string {
  if (value === undefined || value === null) return "";
  const rawStr = String(value).replace(/,/g, "").trim();
  if (!rawStr) return "";
  const num = Number(rawStr);
  if (isNaN(num)) return rawStr;
  const parts = rawStr.split(".");
  parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return parts.join(".");
}

/**
 * Parses user input containing commas into a clean raw numeric string for calculation:
 * e.g. "1,000,000" -> "1000000", "₨ 50,000" -> "50000"
 */
export function parseCurrencyInput(value: string): string {
  const clean = value.replace(/[^0-9.]/g, "");
  const parts = clean.split(".");
  if (parts.length > 2) {
    return parts[0] + "." + parts.slice(1).join("");
  }
  return clean;
}

