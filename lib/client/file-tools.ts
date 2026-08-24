"use client";

import { buildLatex, type ResumeDocument } from "../resume-engine";

const FONT_URLS = {
  regularLatin: "/fonts/noto-sans-devanagari-latin-400-normal.woff2",
  regularLatinExt: "/fonts/noto-sans-devanagari-latin-ext-400-normal.woff2",
  regularDevanagari: "/fonts/noto-sans-devanagari-devanagari-400-normal.woff2",
  boldLatin: "/fonts/noto-sans-devanagari-latin-700-normal.woff2",
  boldLatinExt: "/fonts/noto-sans-devanagari-latin-ext-700-normal.woff2",
  boldDevanagari: "/fonts/noto-sans-devanagari-devanagari-700-normal.woff2",
} as const;

const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

export type ParsedResumeFile = {
  text: string;
  format: "pdf" | "docx" | "tex";
};

type PdfFontLike = {
  encodeText: (text: string) => unknown;
  getCharacterSet: () => number[];
  widthOfTextAtSize: (text: string, size: number) => number;
};

type PdfFontStyle = {
  fonts: PdfFontLike[];
  supportedCodePoints: Set<number>[];
};

type PdfRun = { font: PdfFontLike; text: string };
type PdfLine = { runs: PdfRun[]; width: number };

const DANGEROUS_TEX_COMMANDS = new Set([
  "addbibresource",
  "bibliography",
  "catcode",
  "csname",
  "directlua",
  "documentclass",
  "endcsname",
  "immediate",
  "import",
  "include",
  "includegraphics",
  "includeonly",
  "includepdf",
  "input",
  "lstinputlisting",
  "luaexec",
  "luadirect",
  "newread",
  "newwrite",
  "openin",
  "openout",
  "pdfannot",
  "pdfcatalog",
  "pdffiledump",
  "pdfobj",
  "pdfximage",
  "read",
  "requirepackage",
  "shipout",
  "special",
  "subimport",
  "usepackage",
  "verbatiminput",
  "write",
  "write18",
]);

function normalizeExtractedText(value: string): string {
  return value
    .replace(/\u0000/g, "")
    .replace(/\r\n?/g, "\n")
    .replace(/[\t\f\v ]+/g, " ")
    .replace(/ +\n/g, "\n")
    .replace(/\n +/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function getFileFormat(file: File): ParsedResumeFile["format"] {
  if (file.size > MAX_UPLOAD_BYTES) {
    throw new Error("The resume is larger than the 10 MB upload limit.");
  }

  const extension = file.name.trim().toLowerCase().match(/\.([^.]+)$/)?.[1];
  if (extension === "pdf" || extension === "docx" || extension === "tex") {
    return extension;
  }

  throw new Error("Unsupported resume format. Upload a .pdf, .docx, or .tex file.");
}

function stripTexComments(source: string): string {
  return source
    .split(/\r?\n/)
    .map((line) => {
      for (let index = 0; index < line.length; index += 1) {
        if (line[index] !== "%") continue;

        let slashCount = 0;
        for (let cursor = index - 1; cursor >= 0 && line[cursor] === "\\"; cursor -= 1) {
          slashCount += 1;
        }
        if (slashCount % 2 === 0) return line.slice(0, index);
      }
      return line;
    })
    .join("\n");
}

function skipBalancedGroup(source: string, start: number): number {
  const opening = source[start];
  const closing = opening === "{" ? "}" : "]";
  let depth = 0;

  for (let index = start; index < source.length; index += 1) {
    const character = source[index];
    if (character === "\\") {
      index += 1;
      continue;
    }
    if (character === opening) depth += 1;
    if (character === closing) {
      depth -= 1;
      if (depth === 0) return index + 1;
    }
  }

  return source.length;
}

/**
 * Removes file/network/shell-capable TeX primitives before converting the
 * source to plain text. The uploaded source is never compiled or executed.
 */
function stripDangerousTexCommands(source: string): string {
  let output = "";

  for (let index = 0; index < source.length; ) {
    if (source[index] !== "\\") {
      output += source[index];
      index += 1;
      continue;
    }

    let commandEnd = index + 1;
    while (commandEnd < source.length && /[A-Za-z@]/.test(source[commandEnd])) {
      commandEnd += 1;
    }
    while (commandEnd < source.length && /[0-9]/.test(source[commandEnd])) {
      commandEnd += 1;
    }

    const command = source
      .slice(index + 1, commandEnd)
      .toLowerCase()
      .replace(/\d+$/, "");
    if (!DANGEROUS_TEX_COMMANDS.has(command)) {
      output += source.slice(index, commandEnd);
      index = Math.max(commandEnd, index + 1);
      continue;
    }

    let cursor = commandEnd;
    if (source[cursor] === "*") cursor += 1;
    while (cursor < source.length && /[ \t\r]/.test(source[cursor])) cursor += 1;

    let removedGroup = false;
    for (let groupCount = 0; groupCount < 4; groupCount += 1) {
      if (source[cursor] !== "{" && source[cursor] !== "[") break;
      cursor = skipBalancedGroup(source, cursor);
      removedGroup = true;
      while (cursor < source.length && /[ \t\r]/.test(source[cursor])) cursor += 1;
    }

    if (!removedGroup) {
      while (cursor < source.length && source[cursor] !== "\n") cursor += 1;
    }

    output += " ";
    index = Math.max(cursor, commandEnd);
  }

  return output;
}

function extractTextFromTex(source: string): string {
  let text = stripTexComments(source);
  const documentBody = text.match(
    /\\begin\s*\{document\}([\s\S]*?)\\end\s*\{document\}/i,
  );
  if (documentBody) text = documentBody[1];
  text = stripDangerousTexCommands(text);

  text = text
    .replace(/\\href\s*\{[^{}]*\}\s*\{([^{}]*)\}/gi, "$1")
    .replace(/\\url\s*\{([^{}]*)\}/gi, "$1")
    .replace(
      /\\(?:part|chapter|section|subsection|subsubsection|paragraph)\*?(?:\s*\[[^\]]*\])?\s*\{([^{}]*)\}/gi,
      "\n$1\n",
    )
    .replace(/\\item(?:\s*\[[^\]]*\])?/gi, "\n- ")
    .replace(/\\(?:begin|end)\s*\{[^{}]*\}/gi, "\n")
    .replace(/\\(?:textbar|vert)\s*\{\s*\}/gi, "|")
    .replace(/\\textbackslash\s*\{\s*\}/gi, "\\")
    .replace(/\\textasciitilde\s*\{\s*\}/gi, "~")
    .replace(/\\textasciicircum\s*\{\s*\}/gi, "^")
    .replace(/\\(?:LaTeX|TeX)\b/g, "LaTeX")
    .replace(/\\([#$%&_{}])/g, "$1")
    .replace(/\\(?:qquad|quad|enspace|hfill|vfill|smallskip|medskip|bigskip)\b/gi, " ")
    .replace(/\\\\(?:\[[^\]]*\])?/g, "\n");

  // Unwrap common formatting commands from the inside out.
  for (let pass = 0; pass < 8; pass += 1) {
    const unwrapped = text.replace(
      /\\(?:textbf|textit|texttt|textsc|textrm|textsf|textnormal|emph|underline|mbox)\s*\{([^{}]*)\}/gi,
      "$1",
    );
    if (unwrapped === text) break;
    text = unwrapped;
  }

  text = text
    .replace(/\\["'`^~=.uvHckbdtr]\s*\{?([A-Za-z])\}?/g, "$1")
    .replace(/\\[A-Za-z@]+\*?(?:\s*\[[^\]]*\])?/g, " ")
    .replace(/[{}]/g, " ");

  return normalizeExtractedText(text);
}

async function extractTextFromPdf(file: File): Promise<string> {
  // Importing the worker module first registers PDF.js' in-process worker
  // handler. This keeps the parser lazy and avoids a hard-coded CDN worker URL.
  // The worker bundle intentionally has no declaration file in pdfjs-dist.
  // @ts-expect-error -- side-effect import registers globalThis.pdfjsWorker.
  await import("pdfjs-dist/legacy/build/pdf.worker.min.mjs");
  const { getDocument } = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const loadingTask = getDocument({
    data: new Uint8Array(await file.arrayBuffer()),
    isImageDecoderSupported: false,
    isOffscreenCanvasSupported: false,
    useWasm: false,
  });

  try {
    const pdf = await loadingTask.promise;
    const pages: string[] = [];

    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
      const page = await pdf.getPage(pageNumber);
      const content = await page.getTextContent();
      let pageText = "";

      for (const item of content.items) {
        if (!("str" in item)) continue;
        pageText += item.str.replace(/\u0000/g, "");
        pageText += item.hasEOL ? "\n" : " ";
      }

      pages.push(normalizeExtractedText(pageText));
      page.cleanup();
    }

    return normalizeExtractedText(pages.filter(Boolean).join("\n\n"));
  } finally {
    await loadingTask.destroy();
  }
}

async function extractTextFromDocx(file: File): Promise<string> {
  const mammoth = await import("mammoth");
  const result = await mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() });
  return normalizeExtractedText(result.value);
}

export async function parseResumeFile(file: File): Promise<ParsedResumeFile> {
  const format = getFileFormat(file);

  if (format === "pdf") {
    return { format, text: await extractTextFromPdf(file) };
  }
  if (format === "docx") {
    return { format, text: await extractTextFromDocx(file) };
  }

  return { format, text: extractTextFromTex(await file.text()) };
}

function cleanDocumentText(value: string): string {
  return value
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function sanitizedResumeStem(name: string): string {
  const safeName = name
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Za-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 72)
    .toLowerCase();
  return `${safeName || "candidate"}-resume`;
}

function triggerDownload(blob: Blob, filename: string): void {
  if (typeof document === "undefined" || typeof URL === "undefined") {
    throw new Error("Resume downloads are only available in a browser.");
  }

  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.style.display = "none";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
}

export function downloadLatex(resume: ResumeDocument): void {
  const latex = buildLatex(resume);
  const filename = `${sanitizedResumeStem(resume.name)}.tex`;
  triggerDownload(new Blob([latex], { type: "application/x-tex;charset=utf-8" }), filename);
}

export async function downloadDocx(resume: ResumeDocument): Promise<void> {
  const { AlignmentType, Document, HeadingLevel, Packer, Paragraph, TextRun } =
    await import("docx");
  const children: import("docx").Paragraph[] = [];
  const text = cleanDocumentText;

  children.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      heading: HeadingLevel.TITLE,
      spacing: { after: 80 },
      text: text(resume.name) || "Resume",
    }),
  );

  if (text(resume.headline)) {
    children.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [new TextRun({ bold: true, text: text(resume.headline) })],
        spacing: { after: 60 },
      }),
    );
  }

  const contact = [resume.location, resume.email, resume.phone].map(text).filter(Boolean);
  if (contact.length) {
    children.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 40 },
        text: contact.join(" | "),
      }),
    );
  }

  const links = resume.links.map(text).filter(Boolean);
  if (links.length) {
    children.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 100 },
        text: links.join(" | "),
      }),
    );
  }

  const addHeading = (label: string) => {
    children.push(
      new Paragraph({
        heading: HeadingLevel.HEADING_1,
        keepNext: true,
        spacing: { after: 60, before: 160 },
        text: label,
      }),
    );
  };

  if (text(resume.summary)) {
    addHeading("Professional Summary");
    children.push(new Paragraph({ spacing: { after: 80 }, text: text(resume.summary) }));
  }

  const skills = resume.skills.map(text).filter(Boolean);
  if (skills.length) {
    addHeading("Skills");
    children.push(new Paragraph({ spacing: { after: 80 }, text: skills.join(" | ") }));
  }

  if (resume.experience.length) {
    addHeading("Experience");
    for (const entry of resume.experience) {
      const title = [entry.role, entry.company].map(text).filter(Boolean).join(" | ");
      if (title) {
        children.push(
          new Paragraph({
            heading: HeadingLevel.HEADING_2,
            keepNext: true,
            spacing: { after: 20, before: 100 },
            text: title,
          }),
        );
      }

      const metadata = [entry.period, entry.location].map(text).filter(Boolean);
      if (metadata.length) {
        children.push(
          new Paragraph({
            children: [new TextRun({ italics: true, text: metadata.join(" | ") })],
            keepNext: entry.bullets.some((bullet) => Boolean(text(bullet))),
            spacing: { after: 40 },
          }),
        );
      }

      for (const bullet of entry.bullets.map(text).filter(Boolean)) {
        children.push(
          new Paragraph({
            bullet: { level: 0 },
            spacing: { after: 30 },
            text: bullet,
          }),
        );
      }
    }
  }

  for (const section of resume.additionalSections ?? []) {
    const items = section.items.map(text).filter(Boolean);
    if (!items.length) continue;
    addHeading(section.title);
    for (const item of items) {
      children.push(
        new Paragraph({
          bullet: { level: 0 },
          spacing: { after: 30 },
          text: item,
        }),
      );
    }
  }

  if (resume.education.length) {
    addHeading("Education");
    for (const entry of resume.education) {
      const title = [entry.degree, entry.school].map(text).filter(Boolean).join(" | ");
      if (title) {
        children.push(
          new Paragraph({
            heading: HeadingLevel.HEADING_2,
            keepNext: true,
            spacing: { after: 20, before: 80 },
            text: title,
          }),
        );
      }
      if (text(entry.period)) {
        children.push(
          new Paragraph({
            children: [new TextRun({ italics: true, text: text(entry.period) })],
            spacing: { after: 60 },
          }),
        );
      }
    }
  }

  const documentFile = new Document({
    creator: "Resume Curator",
    description: "ATS-friendly resume exported from Resume Curator",
    sections: [
      {
        children,
        properties: {
          page: {
            margin: { bottom: 720, left: 720, right: 720, top: 720 },
          },
        },
      },
    ],
    styles: {
      default: {
        document: {
          paragraph: { spacing: { after: 80, line: 240 } },
          run: { color: "000000", font: "Arial", size: 20 },
        },
        heading1: {
          paragraph: { keepNext: true, spacing: { after: 60, before: 160 } },
          run: { bold: true, color: "000000", font: "Arial", size: 24 },
        },
        heading2: {
          paragraph: { keepNext: true, spacing: { after: 30, before: 100 } },
          run: { bold: true, color: "000000", font: "Arial", size: 21 },
        },
        title: {
          paragraph: { keepNext: true, spacing: { after: 80 } },
          run: { bold: true, color: "000000", font: "Arial", size: 32 },
        },
      },
    },
    subject: "Resume",
    title: `${text(resume.name) || "Candidate"} Resume`,
  });

  const blob = await Packer.toBlob(documentFile);
  triggerDownload(blob, `${sanitizedResumeStem(resume.name)}.docx`);
}

function createPdfFontStyle(fonts: PdfFontLike[]): PdfFontStyle {
  return {
    fonts,
    supportedCodePoints: fonts.map((font) => new Set(font.getCharacterSet())),
  };
}

function graphemes(value: string): string[] {
  if (typeof Intl.Segmenter === "function") {
    const segmenter = new Intl.Segmenter(undefined, { granularity: "grapheme" });
    return Array.from(segmenter.segment(value), ({ segment }) => segment);
  }
  return Array.from(value);
}

function pdfRuns(value: string, style: PdfFontStyle): PdfRun[] {
  const runs: PdfRun[] = [];

  for (const grapheme of graphemes(cleanDocumentText(value))) {
    const codePoints = Array.from(grapheme, (character) => character.codePointAt(0) ?? 0);
    const fontIndex = /^\s+$/.test(grapheme)
      ? 0
      : style.supportedCodePoints.findIndex((supported) =>
          codePoints.every((codePoint) => supported.has(codePoint)),
        );

    if (fontIndex < 0) {
      throw new Error(
        `PDF export cannot safely render “${grapheme}”. Use DOCX or LaTeX for this writing system.`,
      );
    }

    const font = style.fonts[fontIndex];
    const previous = runs.at(-1);
    if (previous?.font === font) previous.text += grapheme;
    else runs.push({ font, text: grapheme });
  }

  return runs;
}

function pdfRunsWidth(runs: PdfRun[], size: number): number {
  return runs.reduce((width, run) => width + run.font.widthOfTextAtSize(run.text, size), 0);
}

function appendPdfRuns(line: PdfLine, runs: PdfRun[], size: number): void {
  for (const run of runs) {
    const previous = line.runs.at(-1);
    if (previous?.font === run.font) previous.text += run.text;
    else line.runs.push({ ...run });
  }
  line.width += pdfRunsWidth(runs, size);
}

function wrapPdfText(
  value: string,
  style: PdfFontStyle,
  size: number,
  maxWidth: number,
): PdfLine[] {
  const words = cleanDocumentText(value).split(" ").filter(Boolean);
  if (!words.length) return [];

  const lines: PdfLine[] = [];
  let line: PdfLine = { runs: [], width: 0 };
  const spaceRuns = pdfRuns(" ", style);
  const spaceWidth = pdfRunsWidth(spaceRuns, size);

  const pushLine = () => {
    if (line.runs.length) lines.push(line);
    line = { runs: [], width: 0 };
  };

  const appendLongWord = (word: string) => {
    for (const grapheme of graphemes(word)) {
      const characterRuns = pdfRuns(grapheme, style);
      const characterWidth = pdfRunsWidth(characterRuns, size);
      if (line.runs.length && line.width + characterWidth > maxWidth) pushLine();
      appendPdfRuns(line, characterRuns, size);
    }
  };

  for (const word of words) {
    const wordRuns = pdfRuns(word, style);
    const wordWidth = pdfRunsWidth(wordRuns, size);
    const candidateWidth = line.width + (line.runs.length ? spaceWidth : 0) + wordWidth;

    if (candidateWidth <= maxWidth) {
      if (line.runs.length) appendPdfRuns(line, spaceRuns, size);
      appendPdfRuns(line, wordRuns, size);
      continue;
    }

    pushLine();
    if (wordWidth > maxWidth) appendLongWord(word);
    else appendPdfRuns(line, wordRuns, size);
  }

  pushLine();
  return lines;
}

export async function downloadPdf(resume: ResumeDocument): Promise<void> {
  const [{ PDFDocument, rgb }, fontkitModule] = await Promise.all([
    import("pdf-lib"),
    import("@pdf-lib/fontkit"),
  ]);
  const pdf = await PDFDocument.create();
  pdf.registerFontkit(fontkitModule.default);

  const loadFont = async (url: string) => {
    const response = await fetch(url);
    if (!response.ok) throw new Error("The PDF font resources could not be loaded.");
    return pdf.embedFont(await response.arrayBuffer(), { subset: true });
  };
  const [regularLatin, regularLatinExt, regularDevanagari, boldLatin, boldLatinExt, boldDevanagari] =
    await Promise.all([
      loadFont(FONT_URLS.regularLatin),
      loadFont(FONT_URLS.regularLatinExt),
      loadFont(FONT_URLS.regularDevanagari),
      loadFont(FONT_URLS.boldLatin),
      loadFont(FONT_URLS.boldLatinExt),
      loadFont(FONT_URLS.boldDevanagari),
    ]);
  const regular = createPdfFontStyle([regularLatin, regularLatinExt, regularDevanagari]);
  const bold = createPdfFontStyle([boldLatin, boldLatinExt, boldDevanagari]);
  const pageWidth = 612;
  const pageHeight = 792;
  const margin = 46;
  const bottomMargin = 42;
  const contentWidth = pageWidth - margin * 2;
  let page = pdf.addPage([pageWidth, pageHeight]);
  let y = pageHeight - margin;

  pdf.setAuthor(cleanDocumentText(resume.name) || "Candidate");
  pdf.setCreator("Resume Curator");
  pdf.setSubject("ATS-friendly resume");
  pdf.setTitle(`${cleanDocumentText(resume.name) || "Candidate"} Resume`);

  const addPage = () => {
    page = pdf.addPage([pageWidth, pageHeight]);
    y = pageHeight - margin;
  };

  const ensureSpace = (height: number) => {
    if (y - height < bottomMargin) addPage();
  };

  const drawWrapped = (
    rawValue: string,
    options: {
      after?: number;
      bold?: boolean;
      center?: boolean;
      indent?: number;
      lineHeight?: number;
      prefix?: string;
      size?: number;
    } = {},
  ) => {
    const chosenStyle = options.bold ? bold : regular;
    const size = options.size ?? 10;
    const lineHeight = options.lineHeight ?? size * 1.3;
    const indent = options.indent ?? 0;
    const prefix = options.prefix ?? "";
    const prefixRuns = prefix ? pdfRuns(prefix, chosenStyle) : [];
    const prefixWidth = pdfRunsWidth(prefixRuns, size);
    const availableWidth = contentWidth - indent - prefixWidth;
    const lines = wrapPdfText(rawValue, chosenStyle, size, availableWidth);

    lines.forEach((line, lineIndex) => {
      ensureSpace(lineHeight);
      const currentPrefixRuns = lineIndex === 0 ? prefixRuns : [];
      const lineWidth = line.width + (lineIndex === 0 ? prefixWidth : 0);
      let x = options.center
        ? Math.max(margin, (pageWidth - lineWidth) / 2)
        : margin + indent + (lineIndex ? prefixWidth : 0);

      for (const run of [...currentPrefixRuns, ...line.runs]) {
        page.drawText(run.text, {
          color: rgb(0.08, 0.1, 0.13),
          font: run.font as import("pdf-lib").PDFFont,
          size,
          x,
          y,
        });
        x += run.font.widthOfTextAtSize(run.text, size);
      }
      y -= lineHeight;
    });

    y -= options.after ?? 0;
  };

  const drawSection = (label: string) => {
    ensureSpace(30);
    y -= 5;
    drawWrapped(label.toUpperCase(), { after: 4, bold: true, lineHeight: 15, size: 11.5 });
    page.drawLine({
      color: rgb(0.52, 0.57, 0.64),
      end: { x: pageWidth - margin, y: y + 4 },
      start: { x: margin, y: y + 4 },
      thickness: 0.6,
    });
    y -= 5;
  };

  drawWrapped(resume.name || "Resume", {
    after: 2,
    bold: true,
    center: true,
    lineHeight: 23,
    size: 19,
  });
  if (cleanDocumentText(resume.headline)) {
    drawWrapped(resume.headline, { after: 3, bold: true, center: true, lineHeight: 15, size: 10.5 });
  }

  const contact = [resume.location, resume.email, resume.phone]
    .map(cleanDocumentText)
    .filter(Boolean)
    .join(" | ");
  if (contact) drawWrapped(contact, { after: 1, center: true, lineHeight: 13, size: 9 });

  const links = resume.links.map(cleanDocumentText).filter(Boolean).join(" | ");
  if (links) drawWrapped(links, { after: 4, center: true, lineHeight: 13, size: 9 });

  if (cleanDocumentText(resume.summary)) {
    drawSection("Professional Summary");
    drawWrapped(resume.summary, { after: 3, lineHeight: 13.5, size: 9.5 });
  }

  const skills = resume.skills.map(cleanDocumentText).filter(Boolean);
  if (skills.length) {
    drawSection("Skills");
    drawWrapped(skills.join(" | "), { after: 3, lineHeight: 13.5, size: 9.5 });
  }

  if (resume.experience.length) {
    drawSection("Experience");
    for (const entry of resume.experience) {
      ensureSpace(42);
      const title = [entry.role, entry.company]
        .map(cleanDocumentText)
        .filter(Boolean)
        .join(" | ");
      if (title) drawWrapped(title, { after: 1, bold: true, lineHeight: 14, size: 10.5 });

      const metadata = [entry.period, entry.location]
        .map(cleanDocumentText)
        .filter(Boolean)
        .join(" | ");
      if (metadata) drawWrapped(metadata, { after: 2, lineHeight: 12.5, size: 9 });

      for (const bullet of entry.bullets.map(cleanDocumentText).filter(Boolean)) {
        drawWrapped(bullet, {
          after: 1,
          indent: 10,
          lineHeight: 13.2,
          prefix: "- ",
          size: 9.4,
        });
      }
      y -= 3;
    }
  }

  for (const section of resume.additionalSections ?? []) {
    const items = section.items.map(cleanDocumentText).filter(Boolean);
    if (!items.length) continue;
    drawSection(section.title);
    for (const item of items) {
      drawWrapped(item, {
        after: 1,
        indent: 10,
        lineHeight: 13.2,
        prefix: "- ",
        size: 9.4,
      });
    }
  }

  if (resume.education.length) {
    drawSection("Education");
    for (const entry of resume.education) {
      ensureSpace(31);
      const title = [entry.degree, entry.school]
        .map(cleanDocumentText)
        .filter(Boolean)
        .join(" | ");
      if (title) drawWrapped(title, { after: 1, bold: true, lineHeight: 14, size: 10.2 });
      if (cleanDocumentText(entry.period)) {
        drawWrapped(entry.period, { after: 4, lineHeight: 12.5, size: 9 });
      }
    }
  }

  const bytes = await pdf.save();
  const blob = new Blob([new Uint8Array(bytes)], { type: "application/pdf" });
  triggerDownload(blob, `${sanitizedResumeStem(resume.name)}.pdf`);
}
