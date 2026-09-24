/**
 * Default email templates. Seeded into `email_templates` on startup (missing
 * keys only — admin edits are never overwritten) and used by "Reset to
 * default" in the admin panel.
 *
 * Two layouts carry the two visual themes:
 *   layout_guest — the website's brand (navy header, orange CTAs) for guests
 *   layout_admin — the admin panel's look (indigo, compact) for staff
 * Every email names its audience, and is rendered inside that layout's
 * {{{content}}} slot. CSS in the layout's <style> is inlined at send time.
 *
 * Syntax: {{var}} (HTML-escaped), {{{var}}} (raw — only for trusted values
 * such as the layout's content slot), {{#if var}}…{{else}}…{{/if}}.
 * Every template can also use brand_name, site_url, admin_url, support_email,
 * year and subject (see globals() in ./service.js).
 */

const BOOKING_VARIABLES = [
  { name: 'guest_name', description: 'Lead guest’s name', sample: 'Aarav Mehta' },
  { name: 'booking_ref', description: 'Booking reference', sample: 'SF7K3Q9M' },
  { name: 'hotel_name', description: 'Hotel name', sample: 'Ginger Goa, Candolim' },
  { name: 'hotel_address', description: 'Hotel address', sample: 'Candolim Beach Road, Bardez, Goa 403515' },
  { name: 'hotel_phone', description: 'Hotel phone (may be empty)', sample: '+91 832 248 9000' },
  { name: 'room_summary', description: 'Rooms booked, e.g. “1 × Luxe Queen Room”', sample: '1 × Luxe Queen Room' },
  { name: 'rate_plan', description: 'Rate plan name', sample: 'Room with Breakfast' },
  { name: 'meal_plan', description: 'Meals included', sample: 'Breakfast included' },
  { name: 'check_in', description: 'Check-in date', sample: 'Sat, 10 Oct 2026' },
  { name: 'check_in_time', description: 'Check-in time', sample: '2:00 PM' },
  { name: 'check_out', description: 'Check-out date', sample: 'Mon, 12 Oct 2026' },
  { name: 'check_out_time', description: 'Check-out time', sample: '12:00 PM' },
  { name: 'nights', description: 'Number of nights', sample: '2' },
  { name: 'guests', description: 'Number of guests', sample: '2' },
  { name: 'room_price', description: 'Room charges', sample: '₹8,738.00' },
  { name: 'taxes', description: 'Taxes', sample: '₹436.90' },
  { name: 'fees', description: 'Service fees (may be ₹0)', sample: '₹0.00' },
  { name: 'has_fees', description: 'Set when there are service fees', sample: '' },
  { name: 'discount', description: 'Coupon discount', sample: '₹500.00' },
  { name: 'has_discount', description: 'Set when a coupon was applied', sample: 'yes' },
  { name: 'coupon_code', description: 'Coupon code used (may be empty)', sample: 'FLAT500' },
  { name: 'total', description: 'Total amount', sample: '₹8,674.90' },
  { name: 'payment_method', description: 'How the guest paid, e.g. UPI', sample: 'UPI' },
  { name: 'special_requests', description: 'Guest’s special requests (may be empty)', sample: 'Early check-in; High floor' },
  { name: 'cancellation_policy', description: 'Cancellation policy summary', sample: 'Free cancellation till 3 Oct 2026' },
  { name: 'voucher_url', description: 'Link to the booking voucher', sample: 'http://localhost:3000/bookings/42' },
  { name: 'map_url', description: 'Google Maps link (may be empty)', sample: 'https://www.google.com/maps?q=15.51,73.76' },
];

const pick = (names) => BOOKING_VARIABLES.filter((v) => names.includes(v.name));

const LAYOUT_GUEST = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light only">
<title>{{subject}}</title>
<style>
  body { margin: 0; padding: 0; background: #f2f4f8; font-family: Inter, 'Segoe UI', Helvetica, Arial, sans-serif; color: #16202e; }
  .wrapper { width: 100%; background: #f2f4f8; }
  .container { width: 100%; max-width: 600px; }
  .header { background: #0c2350; border-radius: 16px 16px 0 0; padding: 22px 28px; }
  .brand { font-size: 22px; font-weight: 800; color: #ffffff; text-decoration: none; letter-spacing: -0.3px; }
  .brand-accent { color: #f2682f; }
  .card { background: #ffffff; padding: 32px 28px; border-radius: 0 0 16px 16px; }
  h1 { font-size: 22px; line-height: 1.3; margin: 0 0 12px; color: #16202e; }
  h2 { font-size: 16px; margin: 24px 0 8px; color: #16202e; }
  p { font-size: 15px; line-height: 1.6; margin: 0 0 14px; color: #334155; }
  a { color: #1f58c4; }
  .muted { color: #64748b; font-size: 13px; }
  .btn { display: inline-block; background: #f2682f; color: #ffffff; text-decoration: none; font-weight: 700; font-size: 15px; padding: 13px 26px; border-radius: 10px; }
  .btn-secondary { display: inline-block; color: #1f58c4; text-decoration: none; font-weight: 700; font-size: 14px; padding: 12px 4px; }
  .panel { background: #f2f4f8; border-radius: 12px; padding: 16px 18px; margin: 18px 0; }
  .kv { width: 100%; }
  .kv td { padding: 6px 0; font-size: 14px; color: #475569; vertical-align: top; }
  .kv td.v { text-align: right; font-weight: 600; color: #16202e; }
  .kv tr.total td { border-top: 1px dashed #cbd5e1; padding-top: 12px; font-size: 16px; font-weight: 800; color: #16202e; }
  .kv tr.save td { color: #0a6e48; }
  .ref-label { font-size: 11px; font-weight: 700; letter-spacing: 1.5px; text-transform: uppercase; color: #64748b; }
  .ref { font-family: 'SFMono-Regular', Menlo, Consolas, monospace; font-size: 22px; font-weight: 800; letter-spacing: 2px; color: #0c2350; }
  .tag { display: inline-block; background: #e9f7f0; color: #0a6e48; font-size: 12px; font-weight: 700; padding: 4px 10px; border-radius: 999px; }
  .tag-warn { display: inline-block; background: #fff4e5; color: #9a4a00; font-size: 12px; font-weight: 700; padding: 4px 10px; border-radius: 999px; }
  .footer { padding: 20px 28px; text-align: center; }
  .footer p { font-size: 12px; color: #64748b; margin: 0 0 6px; }
  @media (max-width: 620px) {
    .card { padding: 24px 18px !important; }
    .header { padding: 18px !important; }
    h1 { font-size: 20px !important; }
  }
</style>
</head>
<body>
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">{{subject}}</div>
<table role="presentation" class="wrapper" width="100%" cellpadding="0" cellspacing="0">
  <tr>
    <td align="center" style="padding: 24px 12px;">
      <table role="presentation" class="container" width="600" cellpadding="0" cellspacing="0">
        <tr><td class="header"><a class="brand" href="{{site_url}}">Stay<span class="brand-accent">Farer</span></a></td></tr>
        <tr><td class="card">{{{content}}}</td></tr>
        <tr>
          <td class="footer">
            <p>Need help? Write to <a href="mailto:{{support_email}}">{{support_email}}</a> — we reply 24×7.</p>
            <p>© {{year}} {{brand_name}} · Hand-picked stays across India</p>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>
</body>
</html>`;

const LAYOUT_ADMIN = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light only">
<title>{{subject}}</title>
<style>
  body { margin: 0; padding: 0; background: #eef0f6; font-family: -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #111827; }
  .wrapper { width: 100%; background: #eef0f6; }
  .container { width: 100%; max-width: 560px; }
  .header { background: #111827; border-radius: 12px 12px 0 0; padding: 16px 22px; border-bottom: 3px solid #4f46e5; }
  .logo { display: inline-block; width: 28px; height: 28px; line-height: 28px; text-align: center; background: #4f46e5; color: #ffffff; font-weight: 800; font-size: 12px; border-radius: 7px; }
  .title { color: #ffffff; font-size: 14px; font-weight: 700; padding-left: 10px; }
  .subtitle { color: #9ca3af; font-size: 12px; padding-left: 10px; }
  .pill { display: inline-block; background: #312e81; color: #c7d2fe; font-size: 10px; font-weight: 700; letter-spacing: 1px; text-transform: uppercase; padding: 3px 8px; border-radius: 999px; }
  .card { background: #ffffff; padding: 26px 22px; border-radius: 0 0 12px 12px; }
  h1 { font-size: 18px; line-height: 1.35; margin: 0 0 10px; color: #111827; }
  p { font-size: 14px; line-height: 1.6; margin: 0 0 12px; color: #374151; }
  a { color: #4f46e5; }
  .muted { color: #6b7280; font-size: 12px; }
  .btn { display: inline-block; background: #4f46e5; color: #ffffff; text-decoration: none; font-weight: 600; font-size: 14px; padding: 10px 18px; border-radius: 8px; }
  .kv { width: 100%; border: 1px solid #e5e7eb; border-radius: 8px; }
  .kv td { padding: 8px 12px; font-size: 13px; border-bottom: 1px solid #f3f4f6; color: #6b7280; vertical-align: top; }
  .kv td.v { color: #111827; font-weight: 600; text-align: right; }
  .code { font-family: 'SFMono-Regular', Menlo, Consolas, monospace; font-size: 30px; font-weight: 800; letter-spacing: 8px; color: #111827; background: #eef2ff; border: 1px dashed #818cf8; border-radius: 10px; padding: 14px 0; text-align: center; }
  .alert { background: #fef3c7; border: 1px solid #fcd34d; color: #92400e; border-radius: 8px; padding: 10px 12px; font-size: 13px; }
  .footer { padding: 16px 22px; text-align: center; }
  .footer p { font-size: 11px; color: #6b7280; margin: 0 0 4px; }
</style>
</head>
<body>
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">{{subject}}</div>
<table role="presentation" class="wrapper" width="100%" cellpadding="0" cellspacing="0">
  <tr>
    <td align="center" style="padding: 24px 12px;">
      <table role="presentation" class="container" width="560" cellpadding="0" cellspacing="0">
        <tr>
          <td class="header">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td width="28"><span class="logo">SF</span></td>
                <td><div class="title">Stayfarer</div><div class="subtitle">Admin Panel</div></td>
                <td align="right"><span class="pill">Internal</span></td>
              </tr>
            </table>
          </td>
        </tr>
        <tr><td class="card">{{{content}}}</td></tr>
        <tr>
          <td class="footer">
            <p>You’re receiving this because you’re an administrator of {{brand_name}}.</p>
            <p><a href="{{admin_url}}">Open admin panel</a> · © {{year}} {{brand_name}}</p>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>
</body>
</html>`;

const TEMPLATES = [
  {
    key: 'layout_guest',
    kind: 'layout',
    audience: 'guest',
    name: 'Guest layout (website theme)',
    description: 'Wraps every guest email: header, footer and shared styles in the website’s navy & orange brand. Keep {{{content}}} where the email body goes.',
    subject: null,
    html: LAYOUT_GUEST,
    variables: [{ name: 'content', description: 'The email body (required, keep as {{{content}}})', sample: '' }],
  },
  {
    key: 'layout_admin',
    kind: 'layout',
    audience: 'admin',
    name: 'Admin layout (admin panel theme)',
    description: 'Wraps every staff email in the admin panel’s indigo theme. Keep {{{content}}} where the email body goes.',
    subject: null,
    html: LAYOUT_ADMIN,
    variables: [{ name: 'content', description: 'The email body (required, keep as {{{content}}})', sample: '' }],
  },

  // ---------------------------------------------------------------- guest
  {
    key: 'welcome',
    kind: 'email',
    audience: 'guest',
    name: 'Welcome',
    description: 'Sent when a guest creates an account on the website.',
    subject: 'Welcome to {{brand_name}}, {{guest_name}}!',
    variables: [
      { name: 'guest_name', description: 'Guest’s first name', sample: 'Aarav' },
      { name: 'search_url', description: 'Link to hotel search', sample: 'http://localhost:3000/hotels' },
      { name: 'offers_url', description: 'Link to the offers page', sample: 'http://localhost:3000/offers' },
    ],
    html: `<h1>Welcome aboard, {{guest_name}} 👋</h1>
<p>Your {{brand_name}} account is ready. Book hand-picked hotels, resorts and villas across India with real-time availability and instant confirmation.</p>
<div class="panel">
  <p style="margin:0 0 6px;"><strong>What you get</strong></p>
  <p style="margin:0;">✓ Transparent prices — taxes shown before you pay<br>✓ Free cancellation on most stays<br>✓ Secure payments by Razorpay<br>✓ All your vouchers in one place under My Trips</p>
</div>
<p style="text-align:center;margin:24px 0 8px;"><a class="btn" href="{{search_url}}">Find your first stay</a></p>
<p style="text-align:center;"><a class="btn-secondary" href="{{offers_url}}">See today’s offers →</a></p>`,
  },
  {
    key: 'booking_confirmed',
    kind: 'email',
    audience: 'guest',
    name: 'Booking confirmed',
    description: 'Sent the moment a guest’s online payment is confirmed. Acts as the booking voucher.',
    subject: 'Booking confirmed · {{hotel_name}} · {{booking_ref}}',
    variables: BOOKING_VARIABLES,
    html: `<p><span class="tag">✓ Confirmed</span></p>
<h1>You’re all set, {{guest_name}}!</h1>
<p>Your stay at <strong>{{hotel_name}}</strong> is confirmed and paid. Show this email or your booking reference at check-in.</p>
<div class="panel" style="text-align:center;">
  <div class="ref-label">Booking reference</div>
  <div class="ref">{{booking_ref}}</div>
</div>
<table role="presentation" class="kv" cellpadding="0" cellspacing="0">
  <tr><td>Hotel</td><td class="v">{{hotel_name}}</td></tr>
  <tr><td>Check-in</td><td class="v">{{check_in}} · from {{check_in_time}}</td></tr>
  <tr><td>Check-out</td><td class="v">{{check_out}} · until {{check_out_time}}</td></tr>
  <tr><td>Room</td><td class="v">{{room_summary}}</td></tr>
  <tr><td>Rate plan</td><td class="v">{{rate_plan}} · {{meal_plan}}</td></tr>
  <tr><td>Guests</td><td class="v">{{guests}} · {{nights}} night(s)</td></tr>
  {{#if special_requests}}<tr><td>Requests</td><td class="v">{{special_requests}}</td></tr>{{/if}}
</table>
<h2>Payment</h2>
<table role="presentation" class="kv" cellpadding="0" cellspacing="0">
  <tr><td>Room charges</td><td class="v">{{room_price}}</td></tr>
  {{#if has_discount}}<tr class="save"><td>Discount ({{coupon_code}})</td><td class="v">−{{discount}}</td></tr>{{/if}}
  <tr><td>Taxes</td><td class="v">{{taxes}}</td></tr>
  {{#if has_fees}}<tr><td>Fees</td><td class="v">{{fees}}</td></tr>{{/if}}
  <tr class="total"><td>Paid via {{payment_method}}</td><td class="v">{{total}}</td></tr>
</table>
<div class="panel">
  <p style="margin:0;"><strong>Cancellation:</strong> {{cancellation_policy}}</p>
  <p class="muted" style="margin:6px 0 0;">To cancel, write to {{support_email}} with your booking reference.</p>
</div>
<p style="text-align:center;margin:24px 0 8px;"><a class="btn" href="{{voucher_url}}">View voucher</a></p>
{{#if map_url}}<p style="text-align:center;"><a class="btn-secondary" href="{{map_url}}">Get directions →</a></p>{{/if}}
<p class="muted">{{hotel_address}}{{#if hotel_phone}} · {{hotel_phone}}{{/if}}</p>`,
  },
  {
    key: 'checkin_reminder',
    kind: 'email',
    audience: 'guest',
    name: 'Check-in reminder',
    description: 'Sent automatically the day before check-in for confirmed bookings.',
    subject: 'See you tomorrow at {{hotel_name}}!',
    variables: pick(['guest_name', 'booking_ref', 'hotel_name', 'hotel_address', 'hotel_phone', 'check_in', 'check_in_time', 'check_out', 'nights', 'voucher_url', 'map_url']),
    html: `<h1>Your stay starts tomorrow 🧳</h1>
<p>Hi {{guest_name}}, just a friendly reminder that you check in at <strong>{{hotel_name}}</strong> tomorrow.</p>
<table role="presentation" class="kv" cellpadding="0" cellspacing="0">
  <tr><td>Check-in</td><td class="v">{{check_in}} · from {{check_in_time}}</td></tr>
  <tr><td>Check-out</td><td class="v">{{check_out}}</td></tr>
  <tr><td>Booking reference</td><td class="v">{{booking_ref}}</td></tr>
  <tr><td>Address</td><td class="v">{{hotel_address}}</td></tr>
  {{#if hotel_phone}}<tr><td>Hotel phone</td><td class="v">{{hotel_phone}}</td></tr>{{/if}}
</table>
<div class="panel"><p style="margin:0;">🪪 Please carry a valid government photo ID for every adult guest.</p></div>
<p style="text-align:center;margin:24px 0 8px;"><a class="btn" href="{{voucher_url}}">Open voucher</a></p>
{{#if map_url}}<p style="text-align:center;"><a class="btn-secondary" href="{{map_url}}">Get directions →</a></p>{{/if}}`,
  },
  {
    key: 'booking_hold_expired',
    kind: 'email',
    audience: 'guest',
    name: 'Payment not completed',
    description: 'Sent when a guest started checkout but didn’t pay before the room hold ran out. No money was taken.',
    subject: 'Your booking at {{hotel_name}} wasn’t completed',
    variables: [
      ...pick(['guest_name', 'hotel_name', 'check_in', 'check_out', 'room_summary', 'total']),
      { name: 'rebook_url', description: 'Link back to the hotel with the same dates', sample: 'http://localhost:3000/hotels/3?checkIn=2026-10-10&checkOut=2026-10-12' },
    ],
    html: `<p><span class="tag-warn">Payment not completed</span></p>
<h1>Still planning your trip, {{guest_name}}?</h1>
<p>We held <strong>{{room_summary}}</strong> at <strong>{{hotel_name}}</strong> for you, but the payment wasn’t completed in time, so the room has been released. <strong>You have not been charged.</strong></p>
<table role="presentation" class="kv" cellpadding="0" cellspacing="0">
  <tr><td>Dates</td><td class="v">{{check_in}} → {{check_out}}</td></tr>
  <tr><td>Price you saw</td><td class="v">{{total}}</td></tr>
</table>
<p style="text-align:center;margin:24px 0 8px;"><a class="btn" href="{{rebook_url}}">Check availability again</a></p>
<p class="muted">Prices and availability may have changed since your last visit.</p>`,
  },
  {
    key: 'booking_cancelled',
    kind: 'email',
    audience: 'guest',
    name: 'Booking cancelled',
    description: 'Sent when an admin cancels a booking. Mentions the refund when one was issued.',
    subject: 'Booking {{booking_ref}} cancelled',
    variables: [
      ...pick(['guest_name', 'booking_ref', 'hotel_name', 'check_in', 'check_out', 'room_summary', 'total', 'voucher_url']),
      { name: 'cancellation_reason', description: 'Reason entered by the admin', sample: 'Guest requested cancellation over phone' },
      { name: 'refund_amount', description: 'Refund amount', sample: '₹8,674.90' },
      { name: 'has_refund', description: 'Set when a refund was issued', sample: 'yes' },
    ],
    html: `<h1>Your booking has been cancelled</h1>
<p>Hi {{guest_name}}, your booking <strong>{{booking_ref}}</strong> at <strong>{{hotel_name}}</strong> ({{check_in}} → {{check_out}}) has been cancelled.</p>
{{#if cancellation_reason}}<div class="panel"><p style="margin:0;"><strong>Reason:</strong> {{cancellation_reason}}</p></div>{{/if}}
{{#if has_refund}}
<table role="presentation" class="kv" cellpadding="0" cellspacing="0">
  <tr><td>Amount paid</td><td class="v">{{total}}</td></tr>
  <tr class="total"><td>Refund</td><td class="v">{{refund_amount}}</td></tr>
</table>
<p style="margin-top:14px;">Your refund is on its way to your original payment method. It usually reflects within <strong>5–7 working days</strong>, depending on your bank.</p>
{{else}}
<p>No refund is due for this booking under its cancellation policy.</p>
{{/if}}
<p style="text-align:center;margin:24px 0 8px;"><a class="btn" href="{{voucher_url}}">View booking</a></p>`,
  },
  {
    key: 'refund_processed',
    kind: 'email',
    audience: 'guest',
    name: 'Refund processed',
    description: 'Sent when Razorpay confirms a refund has been processed.',
    subject: 'Refund of {{refund_amount}} processed · {{booking_ref}}',
    variables: [
      ...pick(['guest_name', 'booking_ref', 'hotel_name', 'voucher_url', 'payment_method']),
      { name: 'refund_amount', description: 'Refunded amount', sample: '₹8,674.90' },
      { name: 'refund_id', description: 'Gateway refund reference', sample: 'rfnd_Nc9kPzTq1' },
    ],
    html: `<p><span class="tag">✓ Refund processed</span></p>
<h1>Your refund is on its way</h1>
<p>Hi {{guest_name}}, we’ve processed a refund of <strong>{{refund_amount}}</strong> for booking <strong>{{booking_ref}}</strong> at {{hotel_name}}.</p>
<table role="presentation" class="kv" cellpadding="0" cellspacing="0">
  <tr><td>Refund amount</td><td class="v">{{refund_amount}}</td></tr>
  <tr><td>Refunded to</td><td class="v">Original payment method ({{payment_method}})</td></tr>
  <tr><td>Reference</td><td class="v">{{refund_id}}</td></tr>
</table>
<p style="margin-top:14px;">Banks usually take <strong>5–7 working days</strong> to show the credit. If you don’t see it after that, share the reference above with your bank.</p>
<p style="text-align:center;margin:24px 0 8px;"><a class="btn" href="{{voucher_url}}">View booking</a></p>`,
  },

  // ---------------------------------------------------------------- admin
  {
    key: 'admin_login_otp',
    kind: 'email',
    audience: 'admin',
    name: 'Admin login code (OTP)',
    description: 'One-time code for signing in to the admin panel. Always sent — it can’t be switched off.',
    required: true,
    subject: 'Your {{brand_name}} admin login code: {{otp}}',
    variables: [
      { name: 'admin_name', description: 'Admin’s name', sample: 'Anish' },
      { name: 'otp', description: 'The one-time code', sample: '482915' },
      { name: 'expires_minutes', description: 'Minutes until the code expires', sample: '5' },
    ],
    html: `<h1>Your login code</h1>
<p>Hi {{admin_name}}, use this code to finish signing in to the admin panel:</p>
<div class="code">{{otp}}</div>
<p class="muted" style="margin-top:14px;">It expires in {{expires_minutes}} minutes. If you didn’t try to sign in, ignore this email and consider changing your password.</p>`,
  },
  {
    key: 'admin_new_booking',
    kind: 'email',
    audience: 'admin',
    name: 'New booking alert',
    description: 'Sent to the admin alert recipients whenever a guest pays for a booking online.',
    subject: '🛎️ New booking {{booking_ref}} · {{hotel_name}} · {{total}}',
    variables: [
      ...pick(['booking_ref', 'hotel_name', 'guest_name', 'room_summary', 'check_in', 'check_out', 'nights', 'guests', 'total', 'payment_method', 'special_requests']),
      { name: 'guest_email', description: 'Guest’s email', sample: 'aarav@example.com' },
      { name: 'guest_phone', description: 'Guest’s mobile', sample: '+91 98765 43210' },
      { name: 'admin_booking_url', description: 'Link to the booking in the admin panel', sample: 'http://localhost:4200/bookings/42' },
    ],
    html: `<h1>New booking · {{total}}</h1>
<p>{{guest_name}} just paid online for a stay at <strong>{{hotel_name}}</strong>.</p>
<table role="presentation" class="kv" cellpadding="0" cellspacing="0">
  <tr><td>Reference</td><td class="v">{{booking_ref}}</td></tr>
  <tr><td>Stay</td><td class="v">{{check_in}} → {{check_out}} ({{nights}}N)</td></tr>
  <tr><td>Room</td><td class="v">{{room_summary}} · {{guests}} guest(s)</td></tr>
  <tr><td>Guest</td><td class="v">{{guest_name}}<br>{{guest_email}}<br>{{guest_phone}}</td></tr>
  <tr><td>Paid</td><td class="v">{{total}} via {{payment_method}}</td></tr>
  {{#if special_requests}}<tr><td>Requests</td><td class="v">{{special_requests}}</td></tr>{{/if}}
</table>
<p style="margin-top:18px;"><a class="btn" href="{{admin_booking_url}}">Open booking</a></p>`,
  },
  {
    key: 'admin_refund_required',
    kind: 'email',
    audience: 'admin',
    name: 'Refund needed alert',
    description: 'Sent when a payment arrives after the room hold lapsed and the room was no longer available — the money must be refunded.',
    subject: '⚠️ Refund needed for {{booking_ref}} ({{amount}})',
    variables: [
      ...pick(['booking_ref', 'hotel_name', 'guest_name']),
      { name: 'amount', description: 'Amount to refund', sample: '₹8,674.90' },
      { name: 'payment_id', description: 'Razorpay payment ID', sample: 'pay_Nc9kPzTq1' },
      { name: 'admin_booking_url', description: 'Link to the booking in the admin panel', sample: 'http://localhost:4200/bookings/42' },
    ],
    html: `<h1>Refund needed</h1>
<div class="alert">A payment was captured after the room hold expired, and the room had already been taken. The guest has been charged but has no booking.</div>
<table role="presentation" class="kv" cellpadding="0" cellspacing="0" style="margin-top:14px;">
  <tr><td>Reference</td><td class="v">{{booking_ref}}</td></tr>
  <tr><td>Hotel</td><td class="v">{{hotel_name}}</td></tr>
  <tr><td>Guest</td><td class="v">{{guest_name}}</td></tr>
  <tr><td>Amount</td><td class="v">{{amount}}</td></tr>
  <tr><td>Payment</td><td class="v">{{payment_id}}</td></tr>
</table>
<p style="margin-top:18px;"><a class="btn" href="{{admin_booking_url}}">Issue refund</a></p>`,
  },
];

const TEMPLATE_BY_KEY = Object.fromEntries(TEMPLATES.map((t) => [t.key, t]));

module.exports = { TEMPLATES, TEMPLATE_BY_KEY, BOOKING_VARIABLES };
