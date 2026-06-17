import { NextRequest, NextResponse } from 'next/server';
import { sendEmail, EmailTemplate } from '@/lib/email/resend';
import { getSession } from '@/lib/auth/server';

// Internal-only endpoint: caller must be authenticated as platform_admin
// or call from server-side with the CRON_SECRET header (for worker tasks).
export async function POST(req: NextRequest) {
  const cronSecret = req.headers.get('x-cron-secret');
  const isInternalCron = cronSecret && cronSecret === process.env.CRON_SECRET;

  if (!isInternalCron) {
    const session = await getSession(req as never);
    if (!session || session.role !== 'platform_admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  const body = await req.json();
  const { to, template, data } = body as {
    to: string;
    template: EmailTemplate;
    data?: Record<string, string | number>;
  };

  if (!to || !template) {
    return NextResponse.json({ error: 'Missing required fields: to, template' }, { status: 400 });
  }

  await sendEmail({ to, template, data });
  return NextResponse.json({ sent: true });
}
