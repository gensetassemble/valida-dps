# Monitoring FOR/SCI-UMA/198 and shared notifications

Calibration XLSX exports use the native Rev.03 layout from the supplied PIK workbook. The sanitized template retains column widths, row heights, Arial styles, merged headers, yellow sections, print settings, revision notes and Sucofindo logo. Source equipment, signatures and personal names are excluded. Each portfolio has its own worksheet; multi-portfolio downloads use `ALL` in the filename.

Internal/external and significant yes/no report marks are complementary. Selecting either member updates its counterpart. Server validation rejects contradictory pairs; report ticks use `√` and negatives use `-`. Historical imported values are not rewritten in bulk.

Dashboard category controls respect existing account scopes. The priority list includes at most 20 recently expired and 20 upcoming records within 90 days. Lifetime and unknown dates remain excluded. Composition segments have white separators.

Inbox cards resolve the current workflow status shared by all authorized recipients. Event details retain the original historical stage. Scoped PTK recipients receive each request transition, including cancellation, as a new unread notification. The visible inbox refreshes every 30 seconds and on returning to the tab. Existing history-deletion archiving remains in force.

Validation: native XLSX round-trip and visual render, browser download of all seven populated portfolios, complementary form controls, dashboard category filtering, and transaction-only SQL tests for cancellation, unread delivery, event immutability and account/branch isolation.
