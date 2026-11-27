# Charted Waters CV formatter

Turns a candidate's CV into the Charted Waters "Resume of a Consultant" layout, as a Word
file and a PDF. The layout copies the reference CV (`CW CV Cheng Jaganath Sekar.pdf`):
logo header, navy rules, watermark, Verdana text, company footer and Charted Waters contact
details, never the candidate's own.

## One-time setup (macOS)

```bash
cd ~/Projects/resume-curator/tools/cv-format
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt
```

The PDF is exported by **Microsoft Word**, which must be installed. The first time, macOS
asks you to let Terminal control Word. Click OK.

## Formatting a new CV

1. Copy `candidates/example.json` to `candidates/<firstname>.json` and fill it in from the
   candidate's CV. These files are git-ignored because they hold personal data.
2. Run the builder:

```bash
cd ~/Projects/resume-curator/tools/cv-format && .venv/bin/python build_cv.py candidates/<firstname>.json
```

The files land in `~/Downloads` as `CW CV <Name>.docx` and `.pdf`. Running the builder again
overwrites them cleanly. Add `--no-pdf` for Word only, or `--out-dir <folder>` to save elsewhere.

## Fields

| Field | Required | Shown as |
| --- | --- | --- |
| `name` | yes | Large bold name, e.g. `MR. MANOJ H CHAUDHARI` |
| `title` | yes | One line under the name, parts separated by ` \| ` |
| `profile` | yes | PROFESSIONAL PROFILE paragraph |
| `experience` | yes | Sea/Industry Experience timeline, `YYYY-YYYY Role \| ...` |
| `capabilities` | yes, 1-8 | AUDIT & INSPECTION CAPABILITY bullets |
| `highlights` | yes, 1-7 | Key Highlights bullets |
| `sea_service` | no | Page 2 table: rows of `[vessel, type, engine, rank, sign on, sign off]` |
| `education` | no | Page 2 bullets (only when there is a sea-service table) |
| `skills` | no | Page 2 single line (only when there is a sea-service table) |

The builder checks the file before building and says what is wrong, such as a missing field or
text too long for the page. If Word hangs, it stops after 240 s and keeps the Word file.

## Tests

```bash
cd ~/Projects/resume-curator/tools/cv-format && .venv/bin/python -m unittest -v
```
