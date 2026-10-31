/** Toggle only the selected validity facet, retaining the user's other filters. */
export function dashboardStatusHref(params: Record<string, string | undefined>, branch: string, status: string) {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) if (value !== undefined) query.set(key, value);
  query.set("branch", branch);
  query.set("page", "1");
  if (params.validity === status) query.delete("validity");
  else query.set("validity", status);
  return "/dashboard?" + query.toString();
}
