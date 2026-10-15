import {
  TicketDeliveryEmailOptions,
  RegistrationConfirmationEmailOptions,
  StaffInvitationEmailOptions,
  EventAnnouncementEmailOptions,
} from '../interfaces/email.interface';

function baseLayout(title: string, contentHtml: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <style>
    body {
      margin: 0;
      padding: 0;
      background-color: #fafaf9;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      color: #18181b;
      -webkit-font-smoothing: antialiased;
    }
    .wrapper {
      width: 100%;
      background-color: #fafaf9;
      padding: 32px 16px;
    }
    .container {
      max-width: 580px;
      margin: 0 auto;
      background-color: #ffffff;
      border: 1px solid #e7e5e4;
      border-radius: 16px;
      overflow: hidden;
      box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);
    }
    .header {
      background-color: #18181b;
      padding: 24px 32px;
      text-align: left;
    }
    .header h1 {
      margin: 0;
      font-size: 18px;
      font-weight: 800;
      letter-spacing: -0.02em;
      color: #ffffff;
    }
    .header span {
      display: inline-block;
      font-size: 10px;
      font-weight: 600;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: #10b981;
      font-family: monospace;
    }
    .content {
      padding: 32px;
    }
    .footer {
      padding: 24px 32px;
      background-color: #f5f5f4;
      border-top: 1px solid #e7e5e4;
      text-align: center;
      font-size: 12px;
      color: #78716c;
    }
    .btn {
      display: inline-block;
      background-color: #18181b;
      color: #ffffff !important;
      font-size: 13px;
      font-weight: 600;
      text-decoration: none;
      padding: 12px 24px;
      border-radius: 8px;
      margin: 16px 0;
    }
    .badge {
      display: inline-block;
      font-family: monospace;
      font-size: 12px;
      font-weight: 700;
      padding: 4px 10px;
      background-color: #f4f4f5;
      color: #18181b;
      border: 1px solid #e4e4e7;
      border-radius: 6px;
    }
    .meta-box {
      background-color: #fbfbfb;
      border: 1px solid #f0f0f0;
      border-radius: 10px;
      padding: 16px 20px;
      margin: 20px 0;
    }
    .meta-item {
      margin-bottom: 8px;
      font-size: 13px;
    }
    .meta-item:last-child {
      margin-bottom: 0;
    }
    .meta-label {
      color: #71717a;
      font-weight: 500;
      width: 100px;
      display: inline-block;
    }
    .meta-value {
      color: #18181b;
      font-weight: 600;
    }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="container">
      <div class="header">
        <h1>Ticketification</h1>
        <span>Event Operating System</span>
      </div>
      <div class="content">
        ${contentHtml}
      </div>
      <div class="footer">
        <p style="margin: 0 0 6px 0;">This email was sent by Ticketification Event Platform.</p>
        <p style="margin: 0;">Secured with dynamic tamper-proof verification tokens.</p>
      </div>
    </div>
  </div>
</body>
</html>`;
}

export function buildTicketDeliveryTemplate(options: TicketDeliveryEmailOptions): { html: string; text: string } {
  const terminology = options.credentialTerminology || 'Pass';
  const verificationUrl = options.verificationUrl || `https://ticketification.app/verify/${options.verificationToken}`;

  const html = baseLayout(
    `Your ${terminology} for ${options.eventName}`,
    `
    <h2 style="font-size: 20px; font-weight: 700; margin-top: 0; color: #18181b;">Your ${terminology} is Ready!</h2>
    <p style="font-size: 14px; line-height: 1.6; color: #3f3f46;">
      Hello <strong>${options.attendeeName}</strong>,<br>
      Your official digital credential for <strong>${options.eventName}</strong> has been issued and is confirmed for entry.
    </p>

    <div class="meta-box">
      <div class="meta-item">
        <span class="meta-label">Event:</span>
        <span class="meta-value">${options.eventName}</span>
      </div>
      <div class="meta-item">
        <span class="meta-label">${terminology} ID:</span>
        <span class="badge">${options.formattedId}</span>
      </div>
      ${options.eventDate ? `
      <div class="meta-item">
        <span class="meta-label">Date:</span>
        <span class="meta-value">${options.eventDate}</span>
      </div>` : ''}
      ${options.venueName ? `
      <div class="meta-item">
        <span class="meta-label">Venue:</span>
        <span class="meta-value">${options.venueName}</span>
      </div>` : ''}
    </div>

    <p style="font-size: 13px; color: #52525b; line-height: 1.5;">
      Your high-resolution pass with your dynamic verification QR code is attached to this email. You can also view and verify your credential online:
    </p>

    <div style="text-align: center; margin: 24px 0;">
      <a href="${verificationUrl}" class="btn" target="_blank">View & Download ${terminology}</a>
    </div>

    <p style="font-size: 12px; color: #71717a; border-top: 1px dashed #e4e4e7; padding-top: 16px; margin-top: 24px;">
      Gate Check-in Tip: Please present this QR code at the entrance turnstiles. Brighten your phone screen for instant scan verification.
    </p>
    `
  );

  const text = `Your ${terminology} for ${options.eventName}

Hello ${options.attendeeName},
Your official digital credential for ${options.eventName} has been issued.

- Event: ${options.eventName}
- ${terminology} ID: ${options.formattedId}
${options.eventDate ? `- Date: ${options.eventDate}\n` : ''}${options.venueName ? `- Venue: ${options.venueName}\n` : ''}
View your pass online: ${verificationUrl}

Please present the attached pass or QR code at entrance turnstiles.
`;

  return { html, text };
}

export function buildRegistrationConfirmationTemplate(options: RegistrationConfirmationEmailOptions): { html: string; text: string } {
  const terminology = options.credentialTerminology || 'Pass';
  const verificationUrl = options.verificationUrl || `https://ticketification.app/wallet`;

  const html = baseLayout(
    `Registration Confirmed: ${options.eventName}`,
    `
    <h2 style="font-size: 20px; font-weight: 700; margin-top: 0; color: #18181b;">Registration Confirmed</h2>
    <p style="font-size: 14px; line-height: 1.6; color: #3f3f46;">
      Hello <strong>${options.attendeeName}</strong>,<br>
      You are confirmed to attend <strong>${options.eventName}</strong>. We're excited to have you join us!
    </p>

    <div class="meta-box">
      <div class="meta-item">
        <span class="meta-label">Event:</span>
        <span class="meta-value">${options.eventName}</span>
      </div>
      <div class="meta-item">
        <span class="meta-label">Pass ID:</span>
        <span class="badge">${options.formattedId}</span>
      </div>
      ${options.eventDate ? `
      <div class="meta-item">
        <span class="meta-label">Date:</span>
        <span class="meta-value">${options.eventDate}</span>
      </div>` : ''}
      ${options.venueName ? `
      <div class="meta-item">
        <span class="meta-label">Venue:</span>
        <span class="meta-value">${options.venueName}</span>
      </div>` : ''}
    </div>

    <div style="text-align: center; margin: 24px 0;">
      <a href="${verificationUrl}" class="btn" target="_blank">Access Your Pass Wallet</a>
    </div>

    <p style="font-size: 12px; color: #71717a; border-top: 1px dashed #e4e4e7; padding-top: 16px; margin-top: 24px;">
      You can access all your active event credentials anytime by logging into your Ticketification Wallet.
    </p>
    `
  );

  const text = `Registration Confirmed: ${options.eventName}

Hello ${options.attendeeName},
You are confirmed to attend ${options.eventName}.

- Event: ${options.eventName}
- Pass ID: ${options.formattedId}
${options.eventDate ? `- Date: ${options.eventDate}\n` : ''}${options.venueName ? `- Venue: ${options.venueName}\n` : ''}
Access your attendee wallet: ${verificationUrl}
`;

  return { html, text };
}

export function buildStaffInvitationTemplate(options: StaffInvitationEmailOptions): { html: string; text: string } {
  const html = baseLayout(
    `Invitation to join staff for ${options.eventName}`,
    `
    <h2 style="font-size: 20px; font-weight: 700; margin-top: 0; color: #18181b;">Staff Invitation</h2>
    <p style="font-size: 14px; line-height: 1.6; color: #3f3f46;">
      Hello <strong>${options.inviteeName}</strong>,<br>
      ${options.hostName ? `<strong>${options.hostName}</strong> has` : 'You have been'} invited to join the event operations team for <strong>${options.eventName}</strong> as a <strong>${options.role}</strong>.
    </p>

    ${options.customMessage ? `
    <div style="background-color: #f4f4f5; border-left: 3px solid #18181b; padding: 12px 16px; margin: 16px 0; font-size: 13px; font-style: italic; color: #27272a;">
      "${options.customMessage}"
    </div>` : ''}

    <div class="meta-box">
      <div class="meta-item">
        <span class="meta-label">Event:</span>
        <span class="meta-value">${options.eventName}</span>
      </div>
      <div class="meta-item">
        <span class="meta-label">Assigned Role:</span>
        <span class="badge">${options.role}</span>
      </div>
    </div>

    <div style="text-align: center; margin: 24px 0;">
      <a href="${options.invitationUrl}" class="btn" target="_blank">Accept Invitation</a>
    </div>

    <p style="font-size: 12px; color: #71717a;">
      If you did not expect this invitation, you can safely ignore this email.
    </p>
    `
  );

  const text = `Staff Invitation for ${options.eventName}

Hello ${options.inviteeName},
You have been invited to join ${options.eventName} as ${options.role}.

Accept your invitation here: ${options.invitationUrl}
`;

  return { html, text };
}

export function buildEventAnnouncementTemplate(options: EventAnnouncementEmailOptions): { html: string; text: string } {
  const html = baseLayout(
    options.announcementTitle,
    `
    <h2 style="font-size: 20px; font-weight: 700; margin-top: 0; color: #18181b;">${options.announcementTitle}</h2>
    ${options.attendeeName ? `<p style="font-size: 14px; color: #71717a; margin-bottom: 16px;">Hello ${options.attendeeName},</p>` : ''}
    
    <div style="font-size: 14px; line-height: 1.7; color: #27272a;">
      ${options.announcementBody}
    </div>

    <div class="meta-box" style="margin-top: 24px;">
      <div class="meta-item">
        <span class="meta-label">Event:</span>
        <span class="meta-value">${options.eventName}</span>
      </div>
    </div>
    `
  );

  const text = `${options.announcementTitle}
Event: ${options.eventName}

${options.announcementBody}
`;

  return { html, text };
}
