export const renewalNext: Record<string, string> = {
  uncontacted: "contacted",
  contacted: "offered",
  offered: "po_received",
  deferred: "contacted",
};
export function allowedRenewalTargets(stage: string) {
  return renewalNext[stage]
    ? [
        renewalNext[stage],
        ...(stage !== "deferred" ? ["deferred"] : []),
        "not_renewed",
      ]
    : [];
}
export function outlookCompose(to: string, subject: string, body: string) {
  // Outlook treats form-style '+' literally in deeplink fields.
  const query = Object.entries({ to, subject, body })
    .map(([key, value]) => `${key}=${encodeURIComponent(value)}`).join("&");
  return "https://outlook.office.com/mail/deeplink/compose?" + query;
}
