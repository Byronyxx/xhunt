import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

const FROM = process.env.EMAIL_FROM ?? 'X-Hunt <noreply@xhunt.app>';
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://xhunt.app';

export type EmailTemplate =
  | 'welcome'
  | 'trial_expiry'
  | 'payment_failed'
  | 'mission_complete'
  | 'contact_confirmation';

interface SendEmailOpts {
  to: string;
  template: EmailTemplate;
  data?: Record<string, string | number>;
}

function buildHtml(template: EmailTemplate, data: Record<string, string | number>): string {
  const base = (title: string, body: string) => `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${title}</title>
</head>
<body style="margin:0;padding:0;background:#050816;font-family:system-ui,sans-serif;color:#F0F4FF;">
  <div style="max-width:560px;margin:40px auto;padding:0 20px;">
    <div style="margin-bottom:32px;">
      <span style="font-size:20px;font-weight:900;color:#22FFAA;letter-spacing:-0.02em;">X-Hunt</span>
    </div>
    ${body}
    <hr style="border:none;border-top:1px solid rgba(255,255,255,0.07);margin:40px 0 24px;">
    <p style="font-size:12px;color:#4A5578;line-height:1.5;">
      X-Hunt · AI Mission Experiences<br>
      <a href="${APP_URL}" style="color:#22FFAA;text-decoration:none;">${APP_URL}</a>
    </p>
  </div>
</body>
</html>`;

  switch (template) {
    case 'welcome':
      return base('Welcome to X-Hunt', `
        <h1 style="font-size:28px;font-weight:900;color:#F0F4FF;margin:0 0 8px;letter-spacing:-0.03em;">
          Welcome, ${data.name ?? 'Explorer'} 👋
        </h1>
        <p style="font-size:15px;color:#8B9CC0;line-height:1.6;margin:0 0 28px;">
          Your X-Hunt account is ready. Our AI is learning your skills and interests
          so it can match you with missions that actually matter to you.
        </p>
        <a href="${APP_URL}/get-started"
           style="display:inline-block;padding:13px 28px;background:#22FFAA;color:#050816;
                  font-weight:700;border-radius:12px;text-decoration:none;font-size:15px;">
          Complete your profile →
        </a>
      `);

    case 'trial_expiry':
      return base('Your trial ends soon', `
        <h1 style="font-size:24px;font-weight:900;color:#F0F4FF;margin:0 0 8px;">
          Your free trial ends in ${data.daysLeft ?? 3} days
        </h1>
        <p style="font-size:15px;color:#8B9CC0;line-height:1.6;margin:0 0 28px;">
          Upgrade to Pro to keep unlimited AI missions, premium rewards, and live sessions.
        </p>
        <a href="${APP_URL}/upgrade"
           style="display:inline-block;padding:13px 28px;background:#22FFAA;color:#050816;
                  font-weight:700;border-radius:12px;text-decoration:none;font-size:15px;">
          Upgrade to Pro →
        </a>
      `);

    case 'payment_failed':
      return base('Payment issue — action needed', `
        <h1 style="font-size:24px;font-weight:900;color:#FF5C7A;margin:0 0 8px;">
          Payment failed
        </h1>
        <p style="font-size:15px;color:#8B9CC0;line-height:1.6;margin:0 0 28px;">
          We couldn't process your payment. Please update your billing info to keep Pro access.
        </p>
        <a href="${APP_URL}/workspace/billing"
           style="display:inline-block;padding:13px 28px;background:#FF5C7A;color:#fff;
                  font-weight:700;border-radius:12px;text-decoration:none;font-size:15px;">
          Update billing →
        </a>
      `);

    case 'mission_complete':
      return base('Mission completed!', `
        <h1 style="font-size:24px;font-weight:900;color:#22FFAA;margin:0 0 8px;">
          Mission complete! 🎯
        </h1>
        <p style="font-size:15px;color:#8B9CC0;line-height:1.6;margin:0 0 12px;">
          You've completed <strong style="color:#F0F4FF;">${data.missionTitle ?? 'your mission'}</strong>.
        </p>
        <p style="font-size:15px;color:#8B9CC0;line-height:1.6;margin:0 0 28px;">
          Rewards: <strong style="color:#FFB84D;">${data.reward ?? '—'}</strong>
        </p>
        <a href="${APP_URL}/profile"
           style="display:inline-block;padding:13px 28px;background:#22FFAA;color:#050816;
                  font-weight:700;border-radius:12px;text-decoration:none;font-size:15px;">
          View your profile →
        </a>
      `);

    case 'contact_confirmation':
      return base('We received your message', `
        <h1 style="font-size:24px;font-weight:900;color:#F0F4FF;margin:0 0 8px;">
          Thanks for getting in touch
        </h1>
        <p style="font-size:15px;color:#8B9CC0;line-height:1.6;margin:0 0 28px;">
          We'll get back to you within 1-2 business days.
          In the meantime, feel free to explore X-Hunt.
        </p>
        <a href="${APP_URL}"
           style="display:inline-block;padding:13px 28px;background:#22FFAA;color:#050816;
                  font-weight:700;border-radius:12px;text-decoration:none;font-size:15px;">
          Explore X-Hunt →
        </a>
      `);
  }
}

const SUBJECTS: Record<EmailTemplate, string> = {
  welcome:               'Welcome to X-Hunt 🎯',
  trial_expiry:          'Your X-Hunt trial ends soon',
  payment_failed:        'Payment issue on your X-Hunt account',
  mission_complete:      'Mission complete! Your rewards are ready',
  contact_confirmation:  'We got your message — X-Hunt',
};

export async function sendEmail({ to, template, data = {} }: SendEmailOpts) {
  if (!process.env.RESEND_API_KEY) {
    console.warn('[email] RESEND_API_KEY not set — skipping email to', to);
    return;
  }

  const html = buildHtml(template, data);
  const subject = SUBJECTS[template];

  const { error } = await resend.emails.send({ from: FROM, to, subject, html });
  if (error) console.error('[email] send failed:', error);
}
