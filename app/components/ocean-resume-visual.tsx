import {
  CheckCircle2,
  Code2,
  Download,
  FileCheck2,
  FileText,
  Sparkles,
  Target,
  WandSparkles,
} from "lucide-react";

const matchedKeywords = ["Product strategy", "B2B SaaS", "SQL", "Experimentation"];
const exportFormats = [
  { label: "PDF", icon: FileText },
  { label: "DOCX", icon: FileCheck2 },
  { label: "TEX", icon: Code2 },
];

export function OceanResumeVisual() {
  return (
    <figure
      className="ocean-resume-visual"
      role="img"
      aria-label="Resume Curator preview showing a resume matched to a job description with a 96 ATS-readiness score, AI writing review, matched keywords, and PDF, DOCX, and LaTeX export options."
    >
      <figcaption className="visually-hidden">
        Resume Curator analyzes a resume, explains its ATS readiness, improves the writing, and prepares
        polished exports.
      </figcaption>

      <div className="ocean-resume-visual__ambient" aria-hidden="true">
        <span className="ocean-resume-visual__glow ocean-resume-visual__glow--cyan" />
        <span className="ocean-resume-visual__glow ocean-resume-visual__glow--blue" />
        <span className="ocean-resume-visual__orbit ocean-resume-visual__orbit--outer" />
        <span className="ocean-resume-visual__orbit ocean-resume-visual__orbit--inner" />
        <span className="ocean-resume-visual__data-point ocean-resume-visual__data-point--one" />
        <span className="ocean-resume-visual__data-point ocean-resume-visual__data-point--two" />
        <span className="ocean-resume-visual__data-point ocean-resume-visual__data-point--three" />
      </div>

      <article className="ocean-resume-visual__resume-card">
        <header className="ocean-resume-visual__resume-header">
          <span className="ocean-resume-visual__document-mark" aria-hidden="true">
            <FileText size={22} strokeWidth={1.8} />
          </span>
          <div className="ocean-resume-visual__identity">
            <strong>Maya Rao</strong>
            <span>Senior Product Manager</span>
          </div>
          <span className="ocean-resume-visual__ready-badge">
            <CheckCircle2 size={13} strokeWidth={2.4} aria-hidden="true" />
            ATS ready
          </span>
        </header>

        <div className="ocean-resume-visual__resume-body">
          <section className="ocean-resume-visual__resume-section" aria-label="Professional summary">
            <div className="ocean-resume-visual__section-heading">
              <span>Profile</span>
              <span className="ocean-resume-visual__section-rule" />
            </div>
            <div className="ocean-resume-visual__copy-lines" aria-hidden="true">
              <span className="ocean-resume-visual__copy-line ocean-resume-visual__copy-line--long" />
              <span className="ocean-resume-visual__copy-line ocean-resume-visual__copy-line--medium" />
            </div>
          </section>

          <section className="ocean-resume-visual__resume-section" aria-label="Experience highlights">
            <div className="ocean-resume-visual__section-heading">
              <span>Experience</span>
              <span className="ocean-resume-visual__section-rule" />
            </div>
            <div className="ocean-resume-visual__role-line">
              <strong>Senior Product Manager</strong>
              <span>2022 — Present</span>
            </div>
            <ul className="ocean-resume-visual__impact-list">
              <li>
                <CheckCircle2 size={13} strokeWidth={2.2} aria-hidden="true" />
                <span>Lifted activation by 31% through onboarding experiments</span>
              </li>
              <li>
                <CheckCircle2 size={13} strokeWidth={2.2} aria-hidden="true" />
                <span>Led cross-functional roadmap for a B2B SaaS platform</span>
              </li>
              <li>
                <CheckCircle2 size={13} strokeWidth={2.2} aria-hidden="true" />
                <span>Translated SQL insights into measurable product outcomes</span>
              </li>
            </ul>
          </section>

          <section className="ocean-resume-visual__keyword-section" aria-label="Matched keywords">
            <div className="ocean-resume-visual__keyword-heading">
              <Target size={14} strokeWidth={2.2} aria-hidden="true" />
              <span>Matched keywords</span>
            </div>
            <ul className="ocean-resume-visual__keyword-list">
              {matchedKeywords.map((keyword) => (
                <li key={keyword}>{keyword}</li>
              ))}
            </ul>
          </section>
        </div>
      </article>

      <aside className="ocean-resume-visual__score-card" aria-label="ATS-readiness score: 96 out of 100">
        <div className="ocean-resume-visual__score-topline">
          <span className="ocean-resume-visual__score-icon" aria-hidden="true">
            <Target size={17} strokeWidth={2.1} />
          </span>
          <span>ATS readiness</span>
        </div>
        <div className="ocean-resume-visual__score-meter" aria-hidden="true">
          <span className="ocean-resume-visual__score-value">96</span>
          <span className="ocean-resume-visual__score-total">/100</span>
        </div>
        <div className="ocean-resume-visual__score-delta">
          <Sparkles size={13} strokeWidth={2.2} aria-hidden="true" />
          <span>+18 after curation</span>
        </div>
      </aside>

      <aside className="ocean-resume-visual__ai-card" aria-label="AI writing review complete">
        <span className="ocean-resume-visual__ai-icon" aria-hidden="true">
          <WandSparkles size={19} strokeWidth={1.9} />
        </span>
        <div className="ocean-resume-visual__ai-copy">
          <span>AI review complete</span>
          <strong>3 high-impact fixes ready</strong>
        </div>
        <span className="ocean-resume-visual__ai-status" aria-hidden="true">
          <CheckCircle2 size={16} strokeWidth={2.3} />
        </span>
      </aside>

      <aside className="ocean-resume-visual__export-card" aria-label="Export formats">
        <div className="ocean-resume-visual__export-heading">
          <span className="ocean-resume-visual__export-icon" aria-hidden="true">
            <Download size={16} strokeWidth={2.1} />
          </span>
          <span>Export ready</span>
        </div>
        <ul className="ocean-resume-visual__format-list">
          {exportFormats.map(({ label, icon: Icon }) => (
            <li key={label}>
              <Icon size={13} strokeWidth={2} aria-hidden="true" />
              <span>{label}</span>
            </li>
          ))}
        </ul>
      </aside>

      <div className="ocean-resume-visual__match-pill" aria-label="Job match verified">
        <FileCheck2 size={15} strokeWidth={2.2} aria-hidden="true" />
        <span>Job match verified</span>
      </div>

      <div className="ocean-resume-visual__connector ocean-resume-visual__connector--score" aria-hidden="true" />
      <div className="ocean-resume-visual__connector ocean-resume-visual__connector--ai" aria-hidden="true" />
      <div className="ocean-resume-visual__connector ocean-resume-visual__connector--export" aria-hidden="true" />
    </figure>
  );
}
