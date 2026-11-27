"""Build a Charted Waters consultant CV (Word + PDF) from one candidate JSON file.

Usage:
    python build_cv.py candidates/manoj.json                # Word + PDF into ~/Downloads
    python build_cv.py candidates/manoj.json --no-pdf       # Word only
    python build_cv.py candidates/manoj.json --out-dir out  # somewhere else

The PDF is exported by Microsoft Word (via docx2pdf), so the PDF matches the Word file exactly.
See README.md for the JSON fields.
"""
from __future__ import annotations

import argparse
import copy
import json
import logging
import os
import re
import subprocess
import sys
import tempfile
from pathlib import Path

from docx import Document
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.opc.constants import RELATIONSHIP_TYPE as RT
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
from docx.shared import Cm, Pt, RGBColor

HERE = Path(__file__).resolve().parent
ASSETS = HERE / "assets"
log = logging.getLogger("cv-format")

# Brand constants, measured from the reference CV (CW CV Cheng Jaganath Sekar.pdf).
NAVY = "31389E"
LINK = RGBColor(0x05, 0x63, 0xC1)
BODY_FONT = "Verdana"
FOOTER_FONT = "Century Schoolbook"
CONTACT_EMAIL = "info@charted-waters.com"
CONTACT_PHONE = "+91 9880428949"
FOOTER_LINES = (
    "Charted Waters is a brand name of AP SHIPPING SOLUTIONS; CIN: U71200KA2025PTC197126",
    "Address: Prestige Atlanta, 80 Feet Main Road, Koramangala, KA – 560034",
)
SEA_HEADERS = ("Vessel", "Type", "Engine / Boiler", "Rank", "Sign On", "Sign Off")
RANK_KEY = ("Rank key: C/E Chief Engineer · 1AE/2AE/3AE First/Second/Third Assistant Engineer · "
            "2E/3E Second/Third Engineer")

# ---------------------------------------------------------------- input checks
TEXT_LIMITS = {"name": 80, "title": 160, "profile": 900, "experience": 500, "skills": 400}
LIST_LIMITS = {"capabilities": (1, 8, 90), "highlights": (1, 7, 140), "education": (0, 8, 140)}


class ContentError(ValueError):
    """The candidate file is missing something or has something the layout cannot hold."""


def load_content(path: Path) -> dict:
    """Read a candidate JSON file and check every field before anything is built."""
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except FileNotFoundError:
        raise ContentError(f"{path}: file not found") from None
    except (UnicodeDecodeError, json.JSONDecodeError) as exc:
        raise ContentError(f"{path}: not valid UTF-8 JSON ({exc})") from None
    if not isinstance(data, dict):
        raise ContentError(f"{path}: top level must be an object")

    allowed = set(TEXT_LIMITS) | set(LIST_LIMITS) | {"sea_service"}
    unknown = set(data) - allowed
    if unknown:
        raise ContentError(f"unknown field(s): {', '.join(sorted(unknown))}")

    for key, limit in TEXT_LIMITS.items():
        required = key in ("name", "title", "profile", "experience")
        value = data.get(key)
        if value is None and not required:
            continue
        if not isinstance(value, str) or not value.strip():
            raise ContentError(f"'{key}' must be non-empty text")
        if len(value) > limit:
            raise ContentError(f"'{key}' is {len(value)} characters; the page fits {limit}")

    for key, (lo, hi, item_limit) in LIST_LIMITS.items():
        value = data.get(key, [] if key == "education" else None)
        if not isinstance(value, list) or not all(isinstance(i, str) and i.strip() for i in value):
            raise ContentError(f"'{key}' must be a list of non-empty text items")
        if not lo <= len(value) <= hi:
            raise ContentError(f"'{key}' needs {lo}-{hi} items, got {len(value)}")
        long_items = [i for i in value if len(i) > item_limit]
        if long_items:
            raise ContentError(f"'{key}' item longer than {item_limit} characters: {long_items[0][:40]}...")

    sea = data.get("sea_service", [])
    if not isinstance(sea, list) or len(sea) > 30:
        raise ContentError("'sea_service' must be a list of at most 30 rows")
    for n, row in enumerate(sea, 1):
        if not (isinstance(row, list) and len(row) == 6 and all(isinstance(c, str) for c in row)):
            raise ContentError(f"'sea_service' row {n} must be 6 text cells: {', '.join(SEA_HEADERS)}")
    return data


def output_stem(name: str) -> str:
    """'MR. MANOJ H CHAUDHARI' -> 'CW CV Manoj H Chaudhari' (safe as a file name)."""
    bare = re.sub(r"^(MR|MRS|MS|DR|CAPT)\.?\s+", "", name.strip(), flags=re.I)
    bare = re.sub(r"[^\w .-]", "", bare).strip()
    return "CW CV " + " ".join(w.capitalize() for w in bare.split())


# ---------------------------------------------------------------- Word helpers
def set_font(run, size, bold=False, name=BODY_FONT, color=None):
    run.font.name = name
    run.font.size = Pt(size)
    run.font.bold = bold
    rfonts = run._element.get_or_add_rPr().find(qn("w:rFonts"))
    for attr in ("w:ascii", "w:hAnsi", "w:cs", "w:eastAsia"):
        rfonts.set(qn(attr), name)
    if color is not None:
        run.font.color.rgb = color


def set_spacing(p, before=0, after=0, line=None):
    pf = p.paragraph_format
    pf.space_before, pf.space_after = Pt(before), Pt(after)
    if line:
        pf.line_spacing = line


def add_border(p, side, size_eighths=18, space=1):
    """Navy rule above/below a paragraph. size is in eighths of a point (18 = 2.25 pt)."""
    ppr = p._p.get_or_add_pPr()
    pbdr = ppr.find(qn("w:pBdr"))
    if pbdr is None:
        pbdr = OxmlElement("w:pBdr")
        ppr.append(pbdr)
    el = OxmlElement(f"w:{side}")
    for k, v in (("w:val", "single"), ("w:sz", str(size_eighths)), ("w:space", str(space)), ("w:color", NAVY)):
        el.set(qn(k), v)
    pbdr.append(el)


def float_behind_text(run, x_pt, y_pt):
    """Turn the run's inline picture into a picture pinned to the page, behind the text."""
    drawing = run._element.find(qn("w:drawing"))
    inline = drawing.find(qn("wp:inline"))
    anchor = OxmlElement("wp:anchor")
    for k, v in dict(distT="0", distB="0", distL="0", distR="0", simplePos="0", relativeHeight="0",
                     behindDoc="1", locked="0", layoutInCell="1", allowOverlap="1").items():
        anchor.set(k, v)
    sp = OxmlElement("wp:simplePos"); sp.set("x", "0"); sp.set("y", "0"); anchor.append(sp)
    for tag, val in (("wp:positionH", x_pt), ("wp:positionV", y_pt)):
        pos = OxmlElement(tag); pos.set("relativeFrom", "page")
        off = OxmlElement("wp:posOffset"); off.text = str(int(val * 12700))  # points -> EMU
        pos.append(off); anchor.append(pos)
    anchor.append(copy.deepcopy(inline.find(qn("wp:extent"))))
    ee = OxmlElement("wp:effectExtent")
    for a in ("l", "t", "r", "b"):
        ee.set(a, "0")
    anchor.append(ee)
    anchor.append(OxmlElement("wp:wrapNone"))
    for tag in ("wp:docPr", "wp:cNvGraphicFramePr", "a:graphic"):
        el = inline.find(qn(tag))
        if el is not None:
            anchor.append(copy.deepcopy(el))
    drawing.remove(inline)
    drawing.append(anchor)


def shade_cell(cell, fill):
    shd = OxmlElement("w:shd")
    shd.set(qn("w:val"), "clear"); shd.set(qn("w:color"), "auto"); shd.set(qn("w:fill"), fill)
    cell._tc.get_or_add_tcPr().append(shd)


# ---------------------------------------------------------------- document
class CV:
    def __init__(self):
        self.doc = Document()
        sec = self.doc.sections[0]
        sec.page_width, sec.page_height = Cm(21.0), Cm(29.7)  # A4, like the reference
        sec.left_margin = sec.right_margin = Pt(36)
        sec.top_margin, sec.bottom_margin = Pt(108), Pt(64)
        sec.header_distance, sec.footer_distance = Pt(4), Pt(26)
        normal = self.doc.styles["Normal"]
        normal.font.name, normal.font.size = BODY_FONT, Pt(11)
        normal.element.rPr.rFonts.set(qn("w:eastAsia"), BODY_FONT)
        self._header(sec.header)
        self._footer(sec.footer)

    def _header(self, hdr):
        p = hdr.paragraphs[0]
        set_spacing(p, 0, 0, 1.0)
        p.paragraph_format.left_indent = Pt(-33)
        p.add_run().add_picture(str(ASSETS / "logo.png"), width=Pt(254))
        wm = p.add_run()  # watermark lives in the header so it repeats on every page
        wm.add_picture(str(ASSETS / "watermark.png"), width=Pt(293))
        float_behind_text(wm, 152.5, 299)
        t = hdr.add_paragraph()
        set_spacing(t, 0, 0, 1.0)
        t.alignment = WD_ALIGN_PARAGRAPH.CENTER
        t.paragraph_format.left_indent = t.paragraph_format.right_indent = Pt(-33)
        set_font(t.add_run("Resume of a Consultant"), 12, True)
        add_border(t, "bottom", 18, 4)

    def _footer(self, ftr):
        p = ftr.paragraphs[0]
        set_spacing(p, 0, 0, 1.0)
        p.paragraph_format.left_indent, p.paragraph_format.right_indent = Pt(-16), Pt(-22)
        add_border(p, "top", 18, 1)
        for i, line in enumerate(FOOTER_LINES):
            if i:
                p.add_run().add_break()
            set_font(p.add_run("    " + line), 10, name=FOOTER_FONT)

    def para(self, text="", size=11, bold=False, before=0, after=0, line=1.3):
        p = self.doc.add_paragraph()
        set_spacing(p, before, after, line)
        if text:
            set_font(p.add_run(text), size, bold)
        return p

    def heading(self, text):
        return self.para(text, 12, True, before=8, after=4, line=1.0)

    def bullets(self, items):
        for item in items:
            p = self.para()
            pf = p.paragraph_format
            pf.left_indent, pf.first_line_indent = Pt(28), Pt(-18)
            pf.tab_stops.add_tab_stop(Pt(28))
            set_font(p.add_run("•\t" + item), 11)

    def contact(self):
        p = self.para(line=1.0)
        rid = self.doc.part.relate_to(f"mailto:{CONTACT_EMAIL}", RT.HYPERLINK, is_external=True)
        link = OxmlElement("w:hyperlink"); link.set(qn("r:id"), rid)
        r = p.add_run(CONTACT_EMAIL); set_font(r, 11, color=LINK); r.font.underline = True
        link.append(r._element); p._p.append(link)
        set_font(p.add_run(f"  | {CONTACT_PHONE}"), 11)

    def sea_table(self, rows):
        widths = [Pt(v) for v in (108, 76, 168, 42, 65, 65)]
        tbl = self.doc.add_table(rows=1, cols=6)
        tbl.autofit = False
        borders = OxmlElement("w:tblBorders")
        for side in ("top", "left", "bottom", "right", "insideH", "insideV"):
            e = OxmlElement(f"w:{side}")
            for k, v in (("w:val", "single"), ("w:sz", "4"), ("w:space", "0"), ("w:color", "9AA0D0")):
                e.set(qn(k), v)
            borders.append(e)
        tbl._tbl.tblPr.append(borders)

        def fill(cell, text, header=False, shade=None):
            cell.text = ""
            p = cell.paragraphs[0]
            set_spacing(p, 2, 2, 1.0)
            set_font(p.add_run(text), 9, header, color=RGBColor(0xFF, 0xFF, 0xFF) if header else None)
            if shade:
                shade_cell(cell, shade)

        for i, h in enumerate(SEA_HEADERS):
            fill(tbl.rows[0].cells[i], h, header=True, shade=NAVY)
        th = OxmlElement("w:tblHeader"); th.set(qn("w:val"), "true")  # repeat header on a new page
        tbl.rows[0]._tr.get_or_add_trPr().append(th)
        for n, row in enumerate(rows):
            cells = tbl.add_row().cells
            for i, v in enumerate(row):
                fill(cells[i], v, shade="EEF0FA" if n % 2 else None)
        for i, w in enumerate(widths):
            tbl.columns[i].width = w
            for row in tbl.rows:
                row.cells[i].width = w


def build_docx(c: dict):
    """Lay out page 1 (always) and page 2 (only when there is a sea-service table)."""
    cv = CV()
    p = cv.para(c["name"], 18, True, before=6, after=6, line=1.0)
    cv.para(c["title"], after=4)
    cv.heading("PROFESSIONAL PROFILE"); cv.para(c["profile"])
    cv.heading("Sea/Industry Experience"); cv.para(c["experience"])
    cv.heading("AUDIT & INSPECTION CAPABILITY")
    cv.para("Extensive experience supporting and managing:", 10.5, True, after=3, line=1.0)
    for item in c["capabilities"]:
        cv.para("• " + item, after=3, line=1.15)
    cv.heading("Key Highlights"); cv.bullets(c["highlights"])
    cv.heading("CONTACT"); cv.contact()

    if c.get("sea_service"):
        p = cv.para("SEA SERVICE RECORD – LNG/LPG TANKERS", 12, True, after=6, line=1.0)
        p.paragraph_format.page_break_before = True
        cv.sea_table(c["sea_service"])
        cv.para(RANK_KEY, 8.5, before=3, line=1.0)
        if c.get("education"):
            cv.heading("EDUCATION & CERTIFICATIONS"); cv.bullets(c["education"])
        if c.get("skills"):
            cv.heading("TECHNICAL & SOFTWARE SKILLS"); cv.para(c["skills"])
    return cv.doc


# ---------------------------------------------------------------- saving
def save_atomic(doc, target: Path):
    """Write to a temp file in the same folder, then rename: a crash never leaves half a file."""
    fd, tmp = tempfile.mkstemp(suffix=".docx", dir=target.parent)
    os.close(fd)
    try:
        doc.save(tmp)
        umask = os.umask(0)
        os.umask(umask)
        os.chmod(tmp, 0o666 & ~umask)  # mkstemp makes owner-only files; give normal permissions
        os.replace(tmp, target)
    finally:
        if os.path.exists(tmp):
            os.remove(tmp)


def export_pdf(docx_path: Path, pdf_path: Path, timeout_s: int):
    """Ask Microsoft Word to export the PDF, in a child process with a time limit."""
    code = "import sys; from docx2pdf import convert; convert(sys.argv[1], sys.argv[2])"
    tmp_pdf = pdf_path.with_name(pdf_path.stem + ".partial.pdf")
    try:
        proc = subprocess.run([sys.executable, "-c", code, str(docx_path), str(tmp_pdf)],
                              timeout=timeout_s, capture_output=True, text=True)
        if proc.returncode != 0 or not tmp_pdf.exists() or tmp_pdf.stat().st_size == 0:
            # docx2pdf prints Word's own error on stdout as {... 'error': '...'}
            found = re.search(r"'error': '([^']*)'", proc.stdout or "")
            reason = found.group(1) if found else (proc.stderr or proc.stdout or "no PDF written").strip()[-300:]
            raise RuntimeError(f"Word export failed: {reason.rstrip('.')}. If Word shows a dialog "
                               "(e.g. 'Grant File Access'), answer it and run again")
        os.replace(tmp_pdf, pdf_path)
    except subprocess.TimeoutExpired:
        raise RuntimeError(f"Word did not finish the PDF within {timeout_s} s; check Word for a dialog") from None
    finally:
        tmp_pdf.unlink(missing_ok=True)


def main(argv=None) -> int:
    ap = argparse.ArgumentParser(description="Build a Charted Waters consultant CV.")
    ap.add_argument("content", type=Path, help="candidate JSON file")
    ap.add_argument("--out-dir", type=Path, default=Path.home() / "Downloads")
    ap.add_argument("--no-pdf", action="store_true", help="write the Word file only")
    ap.add_argument("--pdf-timeout", type=int, default=240, help="seconds to wait for Word")
    args = ap.parse_args(argv)
    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")

    try:
        content = load_content(args.content)
    except ContentError as exc:
        log.error("content.invalid %s", exc)
        return 2
    if not args.out_dir.is_dir():
        log.error("output.missing_dir %s", args.out_dir)
        return 2

    stem = output_stem(content["name"])
    docx_path = args.out_dir / f"{stem}.docx"
    save_atomic(build_docx(content), docx_path)
    log.info("docx.saved %s", docx_path)
    if args.no_pdf:
        return 0
    try:
        export_pdf(docx_path, args.out_dir / f"{stem}.pdf", args.pdf_timeout)
    except RuntimeError as exc:
        log.error("pdf.failed %s (the Word file is fine; export it from Word by hand)", exc)
        return 1
    log.info("pdf.saved %s", args.out_dir / f"{stem}.pdf")
    return 0


if __name__ == "__main__":
    sys.exit(main())
