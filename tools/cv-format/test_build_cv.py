"""Tests for the CV builder: input checks, file naming and the Word layout (no Word app needed)."""
import json
import tempfile
import unittest
from pathlib import Path

import build_cv
from docx import Document

EXAMPLE = Path(__file__).parent / "candidates" / "example.json"


def write(tmp, data):
    p = Path(tmp) / "c.json"
    p.write_text(json.dumps(data), encoding="utf-8")
    return p


class LoadContent(unittest.TestCase):
    def setUp(self):
        self.good = json.loads(EXAMPLE.read_text(encoding="utf-8"))

    def test_example_is_valid(self):
        self.assertEqual(build_cv.load_content(EXAMPLE)["name"], self.good["name"])

    def test_missing_required_field(self):
        del self.good["profile"]
        with tempfile.TemporaryDirectory() as tmp, self.assertRaisesRegex(build_cv.ContentError, "profile"):
            build_cv.load_content(write(tmp, self.good))

    def test_unknown_field_rejected(self):
        self.good["phone"] = "+91 00000"
        with tempfile.TemporaryDirectory() as tmp, self.assertRaisesRegex(build_cv.ContentError, "unknown"):
            build_cv.load_content(write(tmp, self.good))

    def test_text_too_long(self):
        self.good["profile"] = "x" * 2000
        with tempfile.TemporaryDirectory() as tmp, self.assertRaisesRegex(build_cv.ContentError, "fits"):
            build_cv.load_content(write(tmp, self.good))

    def test_bad_sea_row(self):
        self.good["sea_service"] = [["only", "three", "cells"]]
        with tempfile.TemporaryDirectory() as tmp, self.assertRaisesRegex(build_cv.ContentError, "row 1"):
            build_cv.load_content(write(tmp, self.good))

    def test_not_json(self):
        with tempfile.TemporaryDirectory() as tmp:
            p = Path(tmp) / "c.json"
            p.write_text("{oops", encoding="utf-8")
            with self.assertRaisesRegex(build_cv.ContentError, "JSON"):
                build_cv.load_content(p)


class Naming(unittest.TestCase):
    def test_strips_title_and_capitalises(self):
        self.assertEqual(build_cv.output_stem("MR. MANOJ H CHAUDHARI"), "CW CV Manoj H Chaudhari")

    def test_removes_path_characters(self):
        self.assertEqual(build_cv.output_stem("MR. A/B ..\\C"), "CW CV Ab ..c")


class Build(unittest.TestCase):
    def test_builds_and_overwrites_cleanly(self):
        with tempfile.TemporaryDirectory() as tmp:
            for _ in range(2):  # running twice must give the same single file
                self.assertEqual(build_cv.main([str(EXAMPLE), "--out-dir", tmp, "--no-pdf"]), 0)
            files = sorted(p.name for p in Path(tmp).iterdir())
            self.assertEqual(files, ["CW CV Firstname Lastname.docx"])
            mode = (Path(tmp) / files[0]).stat().st_mode & 0o777
            self.assertTrue(mode & 0o044, f"file should be readable like any normal file, got {oct(mode)}")
            doc = Document(Path(tmp) / files[0])
            texts = [p.text for p in doc.paragraphs]
            self.assertIn("PROFESSIONAL PROFILE", texts)
            self.assertIn("SEA SERVICE RECORD – LNG/LPG TANKERS", texts)
            self.assertEqual(len(doc.tables), 1)
            header = " ".join(p.text for p in doc.sections[0].header.paragraphs)
            self.assertIn("Resume of a Consultant", header)

    def test_no_sea_service_means_one_page_layout(self):
        data = json.loads(EXAMPLE.read_text(encoding="utf-8"))
        data.pop("sea_service")
        with tempfile.TemporaryDirectory() as tmp:
            doc = build_cv.build_docx(build_cv.load_content(write(tmp, data)))
            self.assertEqual(len(doc.tables), 0)
            self.assertNotIn("EDUCATION & CERTIFICATIONS", [p.text for p in doc.paragraphs])

    def test_invalid_content_exits_2(self):
        with tempfile.TemporaryDirectory() as tmp:
            self.assertEqual(build_cv.main([str(Path(tmp) / "missing.json"), "--out-dir", tmp]), 2)


if __name__ == "__main__":
    unittest.main()
