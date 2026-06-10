import type { Invoice } from "./local-store";

export type PaymentProvider = "stripe" | "square" | "paypal" | "manual";

export interface PaymentSettings {
  provider: PaymentProvider;
  enabled: boolean;
  businessName: string;
  currency: string;
  /** Stripe Payment Link or hosted Checkout URL. */
  stripeLink: string;
  /** Optional Stripe publishable key (safe for the browser — never the secret key). */
  stripePublishableKey: string;
  /** Square hosted checkout / payment link URL. */
  squareLink: string;
  /** PayPal.Me username (e.g. "myswimclub") — supports dynamic amounts. */
  paypalMeUser: string;
  /**
   * Optional generic checkout URL template with placeholders:
   * {amount} {amount_cents} {currency} {description} {email} {invoiceId}.
   * When set, this takes precedence and enables dynamic amounts for any
   * provider that exposes such a link (e.g. a hosted Checkout Session URL).
   */
  checkoutUrlTemplate: string;
  /** Instructions shown to families for manual payments (cash/check/Zelle…). */
  manualInstructions: string;
}

export const PROVIDER_LABELS: Record<PaymentProvider, string> = {
  stripe: "Stripe",
  square: "Square",
  paypal: "PayPal",
  manual: "Manual (cash / check)",
};

export const DEFAULT_PAYMENT_SETTINGS: PaymentSettings = {
  provider: "manual",
  enabled: false,
  businessName: "",
  currency: "USD",
  stripeLink: "",
  stripePublishableKey: "",
  squareLink: "",
  paypalMeUser: "",
  checkoutUrlTemplate: "",
  manualInstructions: "",
};

const SETTINGS_KEY = "swimmanager_payment_settings";

export function readPaymentSettings(): PaymentSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return DEFAULT_PAYMENT_SETTINGS;
    return { ...DEFAULT_PAYMENT_SETTINGS, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_PAYMENT_SETTINGS;
  }
}

export function writePaymentSettings(settings: PaymentSettings): void {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}

function fillTemplate(template: string, invoice: Invoice, currency: string, email?: string): string {
  const amount = invoice.amount.toFixed(2);
  return template
    .replace(/\{amount\}/g, amount)
    .replace(/\{amount_cents\}/g, String(Math.round(invoice.amount * 100)))
    .replace(/\{currency\}/g, currency)
    .replace(/\{description\}/g, encodeURIComponent(invoice.description ?? `Invoice INV-${String(invoice.id).padStart(5, "0")}`))
    .replace(/\{email\}/g, encodeURIComponent(email ?? ""))
    .replace(/\{invoiceId\}/g, String(invoice.id));
}

/**
 * Build a hosted checkout URL for an invoice based on the configured provider.
 * Returns null for the manual provider (no online checkout) or when no link is
 * configured for the active provider.
 */
export function buildCheckoutUrl(
  settings: PaymentSettings,
  invoice: Invoice,
  email?: string
): string | null {
  // A generic template wins when present — it supports dynamic amounts.
  if (settings.checkoutUrlTemplate.trim()) {
    return fillTemplate(settings.checkoutUrlTemplate.trim(), invoice, settings.currency, email);
  }

  const ref = `INV-${String(invoice.id).padStart(5, "0")}`;

  switch (settings.provider) {
    case "stripe": {
      if (!settings.stripeLink.trim()) return null;
      const url = new URL(settings.stripeLink.trim());
      // Stripe Payment Links accept these query params.
      url.searchParams.set("client_reference_id", ref);
      if (email) url.searchParams.set("prefilled_email", email);
      return url.toString();
    }
    case "square": {
      if (!settings.squareLink.trim()) return null;
      return settings.squareLink.trim();
    }
    case "paypal": {
      const user = settings.paypalMeUser.trim().replace(/^@/, "");
      if (!user) return null;
      // PayPal.Me supports a dynamic amount + currency in the path.
      return `https://www.paypal.com/paypalme/${encodeURIComponent(user)}/${invoice.amount.toFixed(2)}${settings.currency}`;
    }
    default:
      return null;
  }
}

/** Whether the active provider can open an online checkout for this config. */
export function canCollectOnline(settings: PaymentSettings): boolean {
  if (!settings.enabled) return false;
  if (settings.checkoutUrlTemplate.trim()) return true;
  switch (settings.provider) {
    case "stripe": return !!settings.stripeLink.trim();
    case "square": return !!settings.squareLink.trim();
    case "paypal": return !!settings.paypalMeUser.trim();
    default: return false;
  }
}
