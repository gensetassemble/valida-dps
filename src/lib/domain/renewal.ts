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
  const query = new URLSearchParams({ to, subject, body });
  return "https://outlook.office.com/mail/deeplink/compose?" + query;
}
