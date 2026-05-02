import "server-only";

import nodemailer from "nodemailer";

type MailTransport = ReturnType<typeof nodemailer.createTransport>;

let cachedTransport: MailTransport | null = null;

const REQUIRED_ENV = [
  "SMTP_HOST",
  "SMTP_PORT",
  "SMTP_USER",
  "SMTP_PASS",
  "REPORT_FROM_EMAIL",
  "REPORT_TEST_EMAIL",
] as const;

function requireReportMailEnv() {
  const missing = REQUIRED_ENV.filter((key) => !process.env[key]);
  if (missing.length > 0) {
    throw new Error(`Missing report mail environment: ${missing.join(", ")}`);
  }

  const port = Number(process.env.SMTP_PORT);
  if (!Number.isFinite(port) || port <= 0) {
    throw new Error("Invalid report mail environment: SMTP_PORT must be a number");
  }

  return {
    host: process.env.SMTP_HOST!,
    port,
    secure: process.env.SMTP_SECURE === "true",
    user: process.env.SMTP_USER!,
    pass: process.env.SMTP_PASS!,
    from: process.env.REPORT_FROM_EMAIL!,
    testTo: process.env.REPORT_TEST_EMAIL!,
  };
}

export function getReportMailTransport() {
  if (cachedTransport) return cachedTransport;

  const config = requireReportMailEnv();
  cachedTransport = nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: {
      user: config.user,
      pass: config.pass,
    },
  });

  return cachedTransport;
}

export async function sendReportTestMail(companyName: string) {
  const config = requireReportMailEnv();
  const transport = getReportMailTransport();
  const sentAt = new Date();

  await transport.sendMail({
    from: `"InfraSaathi Reports" <${config.from}>`,
    to: config.testTo,
    subject: "InfraSaathi report mail test",
    text: [
      "InfraSaathi report mail is configured correctly.",
      `Company: ${companyName || "Company"}`,
      `Sent at: ${sentAt.toISOString()}`,
    ].join("\n"),
    html: `
      <div style="font-family:Arial,sans-serif;line-height:1.5;color:#111827">
        <h2 style="margin:0 0 12px">InfraSaathi report mail test</h2>
        <p>InfraSaathi report mail is configured correctly.</p>
        <p><strong>Company:</strong> ${companyName || "Company"}</p>
        <p><strong>Sent at:</strong> ${sentAt.toISOString()}</p>
      </div>
    `,
  });

  return { recipient: config.testTo, sentAt };
}

export async function sendWeeklyProjectReportMail({
  companyName,
  projectTitle,
  recipients,
  pdfBuffer,
  fileName,
  periodLabel,
}: {
  companyName: string;
  projectTitle: string;
  recipients: string[];
  pdfBuffer: Buffer;
  fileName: string;
  periodLabel: string;
}) {
  const config = requireReportMailEnv();
  const transport = getReportMailTransport();
  const sentAt = new Date();

  await transport.sendMail({
    from: `"InfraSaathi Reports" <${config.from}>`,
    to: recipients,
    subject: `Weekly progress report - ${projectTitle}`,
    text: [
      `Weekly progress report for ${projectTitle}.`,
      `Company: ${companyName || "Company"}`,
      `Period: ${periodLabel}`,
      `Sent at: ${sentAt.toISOString()}`,
    ].join("\n"),
    html: `
      <div style="font-family:Arial,sans-serif;line-height:1.5;color:#111827">
        <h2 style="margin:0 0 12px">Weekly progress report</h2>
        <p><strong>Project:</strong> ${projectTitle}</p>
        <p><strong>Company:</strong> ${companyName || "Company"}</p>
        <p><strong>Period:</strong> ${periodLabel}</p>
        <p>The PDF report is attached.</p>
      </div>
    `,
    attachments: [
      {
        filename: fileName,
        content: pdfBuffer,
        contentType: "application/pdf",
      },
    ],
  });

  return { recipients, sentAt };
}
