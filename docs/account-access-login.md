# Account access and login

An active Auth account and profile still need an active branch role assignment. Accounts without recognized active roles are redirected to login with an explicit assignment notice, rather than loading a dashboard outside their scope. Role validation and RLS remain unchanged.

Creating a profile does not automatically grant a role. After creation the administrator is directed to the profile detail and its role assignments. This keeps role selection explicit.

The app sidebar uses the VALIDA logo in expanded, collapsed and mobile navigation. The login panel introduces the equipment, personnel and client modules through accessible tabs with arrow/Home/End navigation. Decorative CSS animation stops when reduced motion is requested. The panel is hidden below the desktop breakpoint; login remains available on mobile.

Validation includes unassigned/unknown-role session guards, a valid tester session, per-account authenticated database read scopes, keyboard/click tab interactions, and sidebar logo variants.
# Super Admin notification delivery

Calibration workflow notifications also go to active Super Admin accounts in the
request's branch. Coordinators and assigned PTK recipients keep their existing
scope. Each recipient retains an independent unread count and read status; inbox
RLS is unchanged. Deleted workflow histories remain archived.

The migration restores missing deliveries for the latest event of retained
calibration requests. The shared workflow database regression verifies Super
Admin submission/cancellation delivery, shared current status, separate read
state, and branch isolation in a rolled-back transaction.
