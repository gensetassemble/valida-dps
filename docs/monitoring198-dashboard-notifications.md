# Monitoring FOR/SCI-UMA/198 and shared notifications

Calibration XLSX exports use the native Rev.03 layout from the supplied PIK workbook. The sanitized template retains column widths, row heights, Arial styles, merged headers, yellow sections, print settings, revision notes and Sucofindo logo. Source equipment, signatures and personal names are excluded. Each portfolio has its own worksheet; multi-portfolio downloads use `ALL` in the filename.

Monitoring footer names are resolved at export time from the active, nonarchived employee directory in the selected branch: Kepala Cabang / Kepala Unit Kerja for acknowledgement, and Kepala Bidang Inspeksi dan Pengujian for preparation. Names are not hardcoded or cached. The date is the export date in WITA, formatted with the branch location and a full Indonesian month. Missing or ambiguous office holders return a clear export error. No handwritten signature is inserted.

Personnel export filenames use `Status Kompetensi Personil - Cabang {location}_{month} {year}.xlsx`, based on the same export date.

All Excel exports enable Wrap Text and remove Shrink to Fit. Export-time layout calculates row heights using column widths, fonts and merged-cell spans; native report fonts, borders, logos and print setup remain intact. Monitoring text columns are wider. Oversized table text continues on additional rows to respect Excel's row-height limit. UMA cover and annex, client/personnel exports and import templates use the same readability pass.

The login screen displays the original generated VALIDA identity together with the supplied Sucofindo identity. Both assets are stored under `public/branding` and served through Next.js image optimization.

Internal/external and significant yes/no report marks are complementary. Selecting either member updates its counterpart. Server validation rejects contradictory pairs; report ticks use `√` and negatives use `-`. Historical imported values are not rewritten in bulk.

Dashboard category controls respect existing account scopes. The priority list includes at most 20 recently expired and 20 upcoming records within 90 days. Lifetime and unknown dates remain excluded. Composition segments have white separators.

Inbox cards resolve the current workflow status shared by all authorized recipients. Event details retain the original historical stage. Scoped PTK recipients receive each request transition, including cancellation, as a new unread notification. The visible inbox refreshes every 30 seconds and on returning to the tab. Existing history-deletion archiving remains in force.

Validation: native XLSX round-trip and visual render, browser download of all seven populated portfolios, complementary form controls, dashboard category filtering, and transaction-only SQL tests for cancellation, unread delivery, event immutability and account/branch isolation.
