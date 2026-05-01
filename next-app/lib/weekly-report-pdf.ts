import "server-only";

type WeeklyReportInput = {
  companyName: string;
  projectTitle: string;
  periodLabel: string;
  reports: Array<{
    requesterRole: string;
    requesterName: string;
    reportDate: string | Date;
    workSummary: string;
    manpowerCount: number;
    materialsUsed?: string;
    blockers?: string;
    nextDayPlan?: string;
  }>;
};

function formatDate(date: string | Date) {
  return new Date(date).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export async function generateWeeklyReportPdf(input: WeeklyReportInput) {
  const manpower = input.reports.reduce(
    (total, report) => total + Number(report.manpowerCount || 0),
    0
  );
  const lines = [
    "BuildSync Weekly Project Report",
    `Company: ${input.companyName}`,
    `Project: ${input.projectTitle}`,
    `Period: ${input.periodLabel}`,
    "",
    `Total daily updates: ${input.reports.length}`,
    `Total manpower entries: ${manpower}`,
    "",
  ];

  if (input.reports.length === 0) {
    lines.push("No daily reports were submitted for this period.");
  }

  for (const report of input.reports) {
    lines.push(`${formatDate(report.reportDate)} - ${report.requesterName}`);
    lines.push(`${report.requesterRole} | Manpower: ${report.manpowerCount}`);
    lines.push("Work completed:");
    lines.push(...wrapLine(report.workSummary || "-", 92).map((line) => `  ${line}`));
    lines.push("Materials used:");
    lines.push(...wrapLine(report.materialsUsed || "-", 92).map((line) => `  ${line}`));
    lines.push("Blockers:");
    lines.push(...wrapLine(report.blockers || "-", 92).map((line) => `  ${line}`));
    lines.push("Next-day plan:");
    lines.push(...wrapLine(report.nextDayPlan || "-", 92).map((line) => `  ${line}`));
    lines.push("");
  }

  return buildSimplePdf(lines);
}

function wrapLine(value: string, maxLength: number) {
  const words = value.replace(/\s+/g, " ").trim().split(" ");
  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    if (!current) {
      current = word;
      continue;
    }
    if (`${current} ${word}`.length > maxLength) {
      lines.push(current);
      current = word;
    } else {
      current = `${current} ${word}`;
    }
  }

  if (current) lines.push(current);
  return lines.length > 0 ? lines : ["-"];
}

function escapePdfText(value: string) {
  return value
    .replace(/[^\x09\x0A\x0D\x20-\x7E]/g, "")
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)");
}

function buildSimplePdf(lines: string[]) {
  const pageLineCount = 44;
  const pages: string[][] = [];
  for (let index = 0; index < lines.length; index += pageLineCount) {
    pages.push(lines.slice(index, index + pageLineCount));
  }
  if (pages.length === 0) pages.push(["BuildSync Weekly Project Report"]);

  const objects: string[] = [];
  const addObject = (body: string) => {
    objects.push(body);
    return objects.length;
  };

  const catalogId = addObject("<< /Type /Catalog /Pages 2 0 R >>");
  const pagesId = addObject("PAGES_PLACEHOLDER");
  const fontId = addObject("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>");
  const pageIds: number[] = [];

  for (const pageLines of pages) {
    const content = [
      "BT",
      "/F1 10 Tf",
      "50 800 Td",
      "14 TL",
      ...pageLines.map((line, index) =>
        `${index === 0 ? "" : "T* "}${index === 0 ? "" : ""}(${escapePdfText(line)}) Tj`
      ),
      "ET",
    ].join("\n");
    const contentId = addObject(`<< /Length ${Buffer.byteLength(content)} >>\nstream\n${content}\nendstream`);
    const pageId = addObject(
      `<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 ${fontId} 0 R >> >> /Contents ${contentId} 0 R >>`
    );
    pageIds.push(pageId);
  }

  objects[pagesId - 1] =
    `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${pageIds.length} >>`;
  objects[catalogId - 1] = `<< /Type /Catalog /Pages ${pagesId} 0 R >>`;

  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  objects.forEach((body, index) => {
    offsets.push(Buffer.byteLength(pdf));
    pdf += `${index + 1} 0 obj\n${body}\nendobj\n`;
  });

  const xrefOffset = Buffer.byteLength(pdf);
  pdf += `xref\n0 ${objects.length + 1}\n`;
  pdf += "0000000000 65535 f \n";
  for (let index = 1; index < offsets.length; index += 1) {
    pdf += `${String(offsets[index]).padStart(10, "0")} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;

  return Buffer.from(pdf);
}
