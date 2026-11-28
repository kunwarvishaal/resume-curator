"use client";

import {
  AlertTriangle,
  ArrowUpRight,
  BriefcaseBusiness,
  Check,
  CheckCircle2,
  ChevronRight,
  Clipboard,
  Code2,
  Download,
  FileCheck2,
  FileText,
  Link2,
  LoaderCircle,
  LockKeyhole,
  PencilLine,
  RotateCcw,
  ShieldCheck,
  Sparkles,
  Target,
  UploadCloud,
  WandSparkles,
  X,
} from "lucide-react";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type CSSProperties,
  type DragEvent,
  type ReactNode,
} from "react";
import {
  DEMO_JD,
  DEMO_RESUME,
  analyzeAts,
  applySuggestion,
  buildLatex,
  createLocalSuggestions,
  hasUsableResumeText,
  parseResumeText,
  type ResumeDocument,
  type Suggestion,
} from "../lib/resume-engine";
import {
  downloadDocx,
  downloadLatex,
  downloadPdf,
  parseResumeFile,
} from "../lib/client/file-tools";
import { OceanResumeVisual } from "./components/ocean-resume-visual";

type ViewMode = "resume" | "latex";
type JdMode = "paste" | "url";
type Toast = { message: string; kind: "success" | "error" };
type CareerSnapshot = {
  name: string;
  medianAnnualUsd: number | null;
  payReferencePeriod: string | null;
  typicalEducation: string | null;
  outlookChangePct: number | null;
  annualOpenings: number | null;
  teleworkAbility: string | null;
  noPriorExperience: string | null;
  sourceUrl: string;
  attribution: string;
};
type CareerResult = { query: string; match: CareerSnapshot | null };

/** First short line of a pasted job description, used as a job-title guess. */
function guessTitleFromJd(jd: string) {
  const firstLine = jd.split("\n").map((line) => line.trim()).find(Boolean) ?? "";
  return firstLine.length <= 80 ? firstLine : "";
}

const scoreLabels = [
  ["Job alignment", "alignment", 35],
  ["Evidence & impact", "evidence", 25],
  ["ATS structure", "parseability", 20],
  ["Completeness", "completeness", 10],
  ["Language quality", "language", 10],
] as const;

function safeMessage(error: unknown) {
  const message = error instanceof Error ? error.message : "";
  if (
    /undefined is not a function|dynamically imported module|chunkloaderror|loading chunk|preload/i.test(
      message,
    )
  ) {
    return "The app was updated while this tab was open. Reload the page, then upload the CV again.";
  }
  return message || "Something went wrong. Please try again.";
}

export default function Home() {
  const [resume, setResume] = useState<ResumeDocument>(DEMO_RESUME);
  const [jd, setJd] = useState(DEMO_JD);
  const [jdUrl, setJdUrl] = useState("");
  const [jdMode, setJdMode] = useState<JdMode>("paste");
  const [fileName, setFileName] = useState("Maya_Rao_Master_CV.pdf");
  const [isDemo, setIsDemo] = useState(true);
  const [isDragging, setIsDragging] = useState(false);
  const [isReadingFile, setIsReadingFile] = useState(false);
  const [isFetchingJd, setIsFetchingJd] = useState(false);
  const [isCurating, setIsCurating] = useState(false);
  const [careerTitle, setCareerTitle] = useState("");
  const [career, setCareer] = useState<CareerResult | null>(null);
  const [isLookingUpCareer, setIsLookingUpCareer] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>("resume");
  const [isEditing, setIsEditing] = useState(false);
  const [suggestions, setSuggestions] = useState<Suggestion[]>(() =>
    createLocalSuggestions(DEMO_RESUME, DEMO_JD),
  );
  const [toast, setToast] = useState<Toast | null>(null);
  const [provider, setProvider] = useState<"AI" | "Smart analysis">("Smart analysis");
  const fileInput = useRef<HTMLInputElement>(null);
  const toastTimer = useRef<number | null>(null);

  const score = useMemo(() => analyzeAts(resume, jd), [resume, jd]);
  const roundedScore = Math.round(score.overall);
  const aiWritingNote = score.warnings.find((warning) => warning.includes("AI-written"));
  const latex = useMemo(() => buildLatex(resume), [resume]);

  useEffect(
    () => () => {
      if (toastTimer.current !== null) window.clearTimeout(toastTimer.current);
    },
    [],
  );

  useEffect(() => {
    const handlePreloadError = (event: Event) => {
      event.preventDefault();
      const reloadKey = "resume-curator-preload-reload";
      const lastReload = Number(window.sessionStorage.getItem(reloadKey) || 0);

      if (Date.now() - lastReload > 60_000) {
        window.sessionStorage.setItem(reloadKey, String(Date.now()));
        window.location.reload();
        return;
      }

      setToast({
        kind: "error",
        message: "A new app version is available. Reload the page, then upload the CV again.",
      });
    };

    window.addEventListener("vite:preloadError", handlePreloadError);
    window.addEventListener("unhandledrejection", handlePreloadError);
    return () => {
      window.removeEventListener("vite:preloadError", handlePreloadError);
      window.removeEventListener("unhandledrejection", handlePreloadError);
    };
  }, []);

  const showToast = (message: string, kind: Toast["kind"] = "success") => {
    if (toastTimer.current !== null) window.clearTimeout(toastTimer.current);
    setToast({ message, kind });
    toastTimer.current = window.setTimeout(() => {
      setToast(null);
      toastTimer.current = null;
    }, 3200);
  };

  const processFile = async (file?: File) => {
    if (!file) return;
    setIsReadingFile(true);
    try {
      const parsed = await parseResumeFile(file);
      if (!hasUsableResumeText(parsed.text)) {
        throw new Error(
          "No usable text was found. If this is a scanned PDF, run OCR first or upload a DOCX/LaTeX version.",
        );
      }
      const nextResume = parseResumeText(parsed.text);
      setResume(nextResume);
      setFileName(file.name);
      setIsDemo(false);
      setSuggestions(createLocalSuggestions(nextResume, jd));
      showToast(`${file.name} was read successfully.`);
    } catch (error) {
      console.error("Resume upload failed", {
        errorName: error instanceof Error ? error.name : typeof error,
        errorMessage: error instanceof Error ? error.message : "Unknown upload error",
        fileSize: file.size,
        fileType: file.type || "unknown",
      });
      showToast(safeMessage(error), "error");
    } finally {
      setIsReadingFile(false);
    }
  };

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    void processFile(event.target.files?.[0]);
    event.target.value = "";
  };

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragging(false);
    void processFile(event.dataTransfer.files?.[0]);
  };

  const fetchJobDescription = async () => {
    if (!jdUrl.trim()) {
      showToast("Add a public HTTPS job-posting URL first.", "error");
      return;
    }
    setIsFetchingJd(true);
    try {
      const response = await fetch("/api/jd/extract", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ url: jdUrl.trim() }),
      });
      const data = (await response.json()) as { text?: string; error?: string; title?: string };
      if (!response.ok || !data.text) throw new Error(data.error || "That page could not be read.");
      setJd(data.text);
      setJdMode("paste");
      setSuggestions(createLocalSuggestions(resume, data.text));
      if (data.title) setCareerTitle(data.title);
      showToast(data.title ? `Imported “${data.title}”.` : "Job description imported.");
    } catch (error) {
      showToast(`${safeMessage(error)} You can paste the job description instead.`, "error");
    } finally {
      setIsFetchingJd(false);
    }
  };

  const lookUpCareer = async () => {
    const title = (careerTitle || guessTitleFromJd(jd)).trim();
    if (title.length < 2) {
      showToast("Type the job title to look up, e.g. “Software Engineer”.", "error");
      return;
    }
    setIsLookingUpCareer(true);
    try {
      const response = await fetch("/api/career", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ title }),
      });
      const data = (await response.json()) as CareerResult & { error?: string };
      if (!response.ok) throw new Error(data.error || "Career data is unavailable right now.");
      setCareer(data);
      if (!careerTitle) setCareerTitle(title);
    } catch (error) {
      showToast(safeMessage(error), "error");
    } finally {
      setIsLookingUpCareer(false);
    }
  };

  const curateResume = async () => {
    if (jd.trim().length < 80) {
      showToast("Add a fuller job description so the match analysis is meaningful.", "error");
      return;
    }
    setIsCurating(true);
    try {
      const response = await fetch("/api/curate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ resume, jd, mode: "curate" }),
      });
      const data = (await response.json().catch(() => ({}))) as {
        suggestions?: Suggestion[];
        provider?: "openai" | "local";
        note?: string;
        error?: string;
      };
      if (!response.ok || !Array.isArray(data.suggestions)) {
        throw new Error(data.error || "The online curation pass could not finish.");
      }
      setSuggestions(data.suggestions);
      setProvider(data.provider === "openai" ? "AI" : "Smart analysis");
      showToast(
        data.provider === "openai"
          ? "AI review complete. Your facts were kept intact."
          : data.note || "Resume analysis refreshed.",
      );
    } catch (error) {
      const localSuggestions = createLocalSuggestions(resume, jd);
      setSuggestions(localSuggestions);
      setProvider("Smart analysis");
      showToast(
        localSuggestions.length > 0
          ? "Online AI was unavailable, so the private on-device review completed instead."
          : `${safeMessage(error)} No evidence-safe changes were found.`,
        localSuggestions.length > 0 ? "success" : "error",
      );
    } finally {
      setIsCurating(false);
    }
  };

  const acceptSuggestion = (suggestion: Suggestion) => {
    setResume((current) => applySuggestion(current, suggestion));
    setSuggestions((current) => current.filter((item) => item.id !== suggestion.id));
    showToast("Suggestion applied. You can keep editing before export.");
  };

  const dismissSuggestion = (id: string) => {
    setSuggestions((current) => current.filter((item) => item.id !== id));
  };

  const acceptAll = () => {
    setResume((current) => suggestions.reduce((draft, item) => applySuggestion(draft, item), current));
    setSuggestions([]);
    showToast("All reviewed suggestions were applied.");
  };

  const resetDemo = () => {
    setResume(DEMO_RESUME);
    setJd(DEMO_JD);
    setCareerTitle("");
    setCareer(null);
    setFileName("Maya_Rao_Master_CV.pdf");
    setSuggestions(createLocalSuggestions(DEMO_RESUME, DEMO_JD));
    setIsDemo(true);
    setProvider("Smart analysis");
    showToast("Demo workspace restored.");
  };

  const updateResume = <K extends keyof ResumeDocument>(key: K, value: ResumeDocument[K]) => {
    setResume((current) => ({ ...current, [key]: value }));
  };

  const updateBullet = (experienceId: string, bulletIndex: number, value: string) => {
    setResume((current) => ({
      ...current,
      experience: current.experience.map((item) =>
        item.id === experienceId
          ? { ...item, bullets: item.bullets.map((bullet, index) => (index === bulletIndex ? value : bullet)) }
          : item,
      ),
    }));
  };

  const copyLatex = async () => {
    await navigator.clipboard.writeText(latex);
    showToast("LaTeX copied to your clipboard.");
  };

  const exportFile = async (format: "tex" | "docx" | "pdf") => {
    try {
      if (format === "tex") downloadLatex(resume);
      if (format === "docx") await downloadDocx(resume);
      if (format === "pdf") await downloadPdf(resume);
      showToast(`${format.toUpperCase()} export created.`);
    } catch (error) {
      showToast(safeMessage(error), "error");
    }
  };

  return (
    <main className="app-shell">
      <header className="topbar">
        <a className="brand" href="#top" aria-label="Resume Curator home">
          <span className="brand-mark"><FileCheck2 size={18} strokeWidth={2.3} /></span>
          <span>Resume Curator</span>
          <span className="brand-beta">BETA</span>
        </a>
        <div className="topbar-center" aria-label="Workflow progress">
          <span className="progress-step is-complete"><Check size={13} /> Source CV</span>
          <ChevronRight size={14} />
          <span className="progress-step is-complete"><Check size={13} /> Target role</span>
          <ChevronRight size={14} />
          <span className="progress-step is-active">Curate</span>
          <ChevronRight size={14} />
          <span className="progress-step">Export</span>
        </div>
        <div className="topbar-actions">
          <span className="privacy-pill"><LockKeyhole size={13} /> Private workspace</span>
          <button className="icon-button" onClick={resetDemo} aria-label="Reset demo" title="Reset demo">
            <RotateCcw size={16} />
          </button>
        </div>
      </header>

      <section className="hero" id="top">
        <img
          src="/hero-wave.svg"
          alt=""
          aria-hidden="true"
          className="hero-wave"
        />
        <div className="hero-copy">
          <p className="eyebrow"><Sparkles size={14} /> One master CV · Every right role</p>
          <h1>Turn your experience into a resume that fits the role—and stays true to you.</h1>
          <p className="hero-description">
            Bring your parent CV and a job description. Resume Curator maps the evidence, improves the
            language, and builds a clean application pack from one factual source of truth.
          </p>
          <div className="hero-actions">
            <a className="hero-cta" href="#workspace">
              Curate my resume <ArrowUpRight size={17} aria-hidden="true" />
            </a>
            <span className="hero-trust"><ShieldCheck size={15} aria-hidden="true" /> Facts stay yours</span>
          </div>
          <div className="hero-metrics" aria-label="Resume Curator product highlights">
            <div><strong>95+</strong><span>Target on an explainable rubric</span></div>
            <div><strong>3</strong><span>ATS-safe export formats</span></div>
            <div><strong>0</strong><span>CV files stored by this version</span></div>
          </div>
        </div>
        <OceanResumeVisual />
      </section>

      <section className="workbench" id="workspace" aria-label="Resume curation workspace">
        <aside className="input-rail">
          <div className="rail-heading">
            <div>
              <span className="rail-kicker">01 · INPUTS</span>
              <h2>Source material</h2>
            </div>
            {isDemo && <span className="demo-badge">Demo data</span>}
          </div>

          <div
            className={`upload-zone ${isDragging ? "is-dragging" : ""}`}
            onDragOver={(event) => { event.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
          >
            <input
              ref={fileInput}
              className="visually-hidden"
              type="file"
              accept=".pdf,.docx,.tex,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              onChange={handleFileChange}
              aria-label="Upload parent CV"
            />
            <div className="upload-icon"><UploadCloud size={21} /></div>
            <div className="upload-copy">
              <strong>{isReadingFile ? "Reading your CV…" : "Upload parent CV"}</strong>
              <span>PDF, DOCX or LaTeX · up to 10 MB</span>
            </div>
            <button className="small-button" onClick={() => fileInput.current?.click()} disabled={isReadingFile}>
              {isReadingFile ? <LoaderCircle className="spin" size={15} /> : "Browse"}
            </button>
          </div>

          <div className="file-row">
            <span className="file-type"><FileText size={16} /></span>
            <span className="file-meta"><strong>{fileName}</strong><small>{isDemo ? "Example resume · ready" : "Parsed locally · ready"}</small></span>
            <CheckCircle2 className="success-icon" size={17} />
          </div>

          <div className="section-divider" />

          <div className="field-header">
            <label htmlFor={jdMode === "paste" ? "job-description" : "job-url"}>Target job</label>
            <div className="segmented mini" role="group" aria-label="Job input type">
              <button className={jdMode === "paste" ? "is-selected" : ""} onClick={() => setJdMode("paste")}><Clipboard size={13} /> Paste</button>
              <button className={jdMode === "url" ? "is-selected" : ""} onClick={() => setJdMode("url")}><Link2 size={13} /> URL</button>
            </div>
          </div>

          {jdMode === "paste" ? (
            <div className="textarea-wrap">
              <textarea
                id="job-description"
                value={jd}
                onChange={(event) => setJd(event.target.value)}
                placeholder="Paste the full job description here…"
                rows={10}
              />
              <span className="character-count">{jd.length.toLocaleString()} characters</span>
            </div>
          ) : (
            <div className="url-panel">
              <div className="url-input">
                <Link2 size={16} />
                <input
                  id="job-url"
                  type="url"
                  value={jdUrl}
                  onChange={(event) => setJdUrl(event.target.value)}
                  placeholder="https://company.com/jobs/…"
                />
              </div>
              <button className="secondary-button full" onClick={fetchJobDescription} disabled={isFetchingJd}>
                {isFetchingJd ? <LoaderCircle className="spin" size={16} /> : <ArrowUpRight size={16} />}
                Import job description
              </button>
              <p>Public HTTPS pages only. If a job board blocks access, paste the description instead.</p>
            </div>
          )}

          <details className="career-panel">
            <summary><BriefcaseBusiness size={14} /> Career snapshot <small>U.S. data</small></summary>
            <div className="url-input">
              <BriefcaseBusiness size={16} />
              <input
                aria-label="Job title for career snapshot"
                value={careerTitle}
                onChange={(event) => setCareerTitle(event.target.value)}
                placeholder={guessTitleFromJd(jd) || "Job title, e.g. Software Engineer"}
                maxLength={300}
              />
            </div>
            <button className="secondary-button full" onClick={lookUpCareer} disabled={isLookingUpCareer}>
              {isLookingUpCareer ? <LoaderCircle className="spin" size={16} /> : <ArrowUpRight size={16} />}
              Look up pay, education &amp; outlook
            </button>
            {career && !career.match && (
              <p>No career data found for “{career.query || careerTitle}”. Try a simpler title.</p>
            )}
            {career?.match && <CareerCard snapshot={career.match} />}
            <p>Only the job title is sent to TryHired. Your resume and the job description stay here.</p>
          </details>

          <button className="primary-button curate-button" onClick={curateResume} disabled={isCurating}>
            {isCurating ? <LoaderCircle className="spin" size={18} /> : <WandSparkles size={18} />}
            {isCurating ? "Reviewing your resume…" : "Curate toward 95+"}
            {!isCurating && <ChevronRight size={17} />}
          </button>
          <p className="score-disclaimer"><ShieldCheck size={13} /> 95+ is a target on our transparent rubric, not a guarantee from every ATS vendor.</p>
        </aside>

        <section className="document-stage">
          <div className="document-toolbar">
            <div>
              <span className="rail-kicker">02 · CURATED OUTPUT</span>
              <div className="title-row"><h2>Role-matched resume</h2><span className="saved-state"><span /> Saved locally</span></div>
            </div>
            <div className="toolbar-controls">
              <div className="segmented" role="group" aria-label="Output view">
                <button className={viewMode === "resume" ? "is-selected" : ""} onClick={() => setViewMode("resume")}><FileText size={14} /> Resume</button>
                <button className={viewMode === "latex" ? "is-selected" : ""} onClick={() => setViewMode("latex")}><Code2 size={14} /> LaTeX</button>
              </div>
              {viewMode === "resume" ? (
                <button className={`edit-button ${isEditing ? "is-active" : ""}`} onClick={() => setIsEditing((value) => !value)}>
                  {isEditing ? <Check size={15} /> : <PencilLine size={15} />}{isEditing ? "Done" : "Edit"}
                </button>
              ) : (
                <button className="edit-button" onClick={copyLatex}><Clipboard size={15} /> Copy</button>
              )}
            </div>
          </div>

          <div className="paper-shell">
            {viewMode === "resume" ? (
              <article className={`resume-paper ${isEditing ? "is-editing" : ""}`} aria-label="Curated resume preview">
                <div className="resume-accent" />
                <header className="resume-header">
                  {isEditing ? (
                    <input className="edit-name" value={resume.name} onChange={(e) => updateResume("name", e.target.value)} aria-label="Candidate name" />
                  ) : <h3>{resume.name}</h3>}
                  {isEditing ? (
                    <input className="edit-headline" value={resume.headline} onChange={(e) => updateResume("headline", e.target.value)} aria-label="Professional headline" />
                  ) : <p className="resume-headline">{resume.headline}</p>}
                  <p className="contact-line">{[resume.email, resume.phone, resume.location, ...resume.links].filter(Boolean).join("  •  ")}</p>
                </header>

                <ResumeSection title="Professional summary">
                  {isEditing ? (
                    <textarea className="inline-editor" value={resume.summary} onChange={(e) => updateResume("summary", e.target.value)} rows={4} aria-label="Professional summary" />
                  ) : <p>{resume.summary}</p>}
                </ResumeSection>

                <ResumeSection title="Core skills">
                  {isEditing ? (
                    <input className="inline-input" value={resume.skills.join(", ")} onChange={(e) => updateResume("skills", e.target.value.split(",").map((item) => item.trim()).filter(Boolean))} aria-label="Core skills" />
                  ) : <div className="skill-line">{resume.skills.join("  ·  ")}</div>}
                </ResumeSection>

                <ResumeSection title="Experience">
                  <div className="experience-list">
                    {resume.experience.map((item) => (
                      <div className="experience-item" key={item.id}>
                        <div className="experience-heading">
                          <div><strong>{item.role}</strong><span>{item.company}{item.location ? ` · ${item.location}` : ""}</span></div>
                          <time>{item.period}</time>
                        </div>
                        <ul>
                          {item.bullets.map((bullet, index) => (
                            <li key={`${item.id}-${index}`}>
                              {isEditing ? (
                                <textarea value={bullet} onChange={(e) => updateBullet(item.id, index, e.target.value)} rows={2} aria-label={`Bullet ${index + 1} for ${item.role}`} />
                              ) : bullet}
                            </li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                </ResumeSection>

                <ResumeSection title="Education">
                  {resume.education.map((item) => (
                    <div className="education-row" key={item.id}>
                      <div><strong>{item.degree}</strong><span>{item.school}</span></div><time>{item.period}</time>
                    </div>
                  ))}
                </ResumeSection>

                {(resume.additionalSections ?? []).map((section) => (
                  <ResumeSection title={section.title} key={section.id}>
                    <ul className="additional-section-list">
                      {section.items.map((item, index) => (
                        <li key={`${section.id}-${index}`}>{item}</li>
                      ))}
                    </ul>
                  </ResumeSection>
                ))}
              </article>
            ) : (
              <div className="code-paper">
                <div className="code-header"><span><Code2 size={15} /> ATS-safe LaTeX source</span><small>Escaped · single column · editable after download</small></div>
                <pre><code>{latex}</code></pre>
              </div>
            )}
          </div>

          <div className="export-bar">
            <div><Download size={17} /><span><strong>Export curated resume</strong><small>One factual source, three formats</small></span></div>
            <div className="export-actions">
              <button onClick={() => void exportFile("tex")}><Code2 size={14} /> .TEX</button>
              <button onClick={() => void exportFile("docx")}><FileText size={14} /> .DOCX</button>
              <button className="export-primary" onClick={() => void exportFile("pdf")}><Download size={14} /> PDF</button>
            </div>
          </div>
        </section>

        <aside className="insights-rail">
          <div className="rail-heading">
            <div><span className="rail-kicker">03 · QUALITY</span><h2>ATS readiness</h2></div>
            <span className="rubric-link" title="Scored on a transparent, deterministic rubric">v1.0 rubric</span>
          </div>

          <div className="score-card">
            <div className="score-ring" style={{ "--score": `${roundedScore * 3.6}deg` } as CSSProperties}>
              <div><strong>{roundedScore}</strong><span>/100</span></div>
            </div>
            <div className="score-copy">
              <span className={`readiness-label ${score.overall >= 90 ? "is-strong" : ""}`}><Target size={13} /> {score.overall >= 90 ? "Strong match" : "Optimization ready"}</span>
              <h3>Estimated readiness</h3>
              <p>{roundedScore >= 95 ? "This version clears the 95+ target on our rubric." : `${95 - roundedScore} points from the 95+ target.`}</p>
            </div>
          </div>

          <div className="breakdown" aria-label="ATS score breakdown">
            {scoreLabels.map(([label, key, max]) => (
              <div className="breakdown-row" key={key}>
                <div><span>{label}</span><strong>{score[key]}/{max}</strong></div>
                <div className="bar"><span style={{ width: `${(score[key] / max) * 100}%` }} /></div>
              </div>
            ))}
          </div>

          <div className="keyword-panel">
            <div className="panel-title"><span><CheckCircle2 size={15} /> Matched keywords</span><strong>{score.matchedKeywords.length}</strong></div>
            <div className="keyword-cloud">
              {score.matchedKeywords.slice(0, 7).map((keyword) => <span className="keyword matched" key={keyword}>{keyword}</span>)}
              {score.matchedKeywords.length === 0 && <small>Run the analysis to identify role keywords.</small>}
            </div>
            {score.missingKeywords.length > 0 && (
              <details>
                <summary><AlertTriangle size={13} /> {score.missingKeywords.length} relevant gaps</summary>
                <div className="keyword-cloud missing-cloud">
                  {score.missingKeywords.slice(0, 6).map((keyword) => <span className="keyword missing" key={keyword}>{keyword}</span>)}
                </div>
              </details>
            )}
          </div>

          {aiWritingNote && (
            <p className="ai-writing-note" role="note"><AlertTriangle size={13} /> {aiWritingNote}</p>
          )}

          <div className="suggestions-panel">
            <div className="suggestions-heading">
              <div><span><WandSparkles size={15} /> Fix suggestions</span><small>{provider} · facts preserved</small></div>
              {suggestions.length > 1 && <button onClick={acceptAll}>Accept all</button>}
            </div>
            <div className="suggestion-list">
              {suggestions.slice(0, 4).map((suggestion) => (
                <article className="suggestion-card" key={suggestion.id}>
                  <div className="suggestion-meta"><span className={`suggestion-type type-${suggestion.type.toLowerCase()}`}>{suggestion.type}</span><button onClick={() => dismissSuggestion(suggestion.id)} aria-label={`Dismiss ${suggestion.type} suggestion`}><X size={14} /></button></div>
                  <p className="before-text">{suggestion.before}</p>
                  <p className="after-text">{suggestion.after}</p>
                  <p className="rationale">{suggestion.rationale}</p>
                  <button className="accept-button" onClick={() => acceptSuggestion(suggestion)}><Check size={14} /> Apply change</button>
                </article>
              ))}
              {suggestions.length === 0 && (
                <div className="empty-suggestions"><CheckCircle2 size={25} /><strong>Review complete</strong><span>No pending language fixes.</span></div>
              )}
            </div>
          </div>
        </aside>
      </section>

      <footer className="footer-note">
        <span><ShieldCheck size={14} /> Your uploaded CV is parsed in the browser and is not stored by this version.</span>
        <span>Resume Curator never invents experience, education, employers or metrics.</span>
      </footer>

      {toast && (
        <div className={`toast toast-${toast.kind}`} role={toast.kind === "error" ? "alert" : "status"}>
          {toast.kind === "error" ? <AlertTriangle size={17} /> : <CheckCircle2 size={17} />}
          {toast.message}
        </div>
      )}
    </main>
  );
}

function CareerCard({ snapshot }: { snapshot: CareerSnapshot }) {
  const pay =
    snapshot.medianAnnualUsd === null
      ? null
      : `$${snapshot.medianAnnualUsd.toLocaleString("en-US")} / year${snapshot.payReferencePeriod ? ` (${snapshot.payReferencePeriod})` : ""}`;
  const growth =
    snapshot.outlookChangePct === null
      ? null
      : `${snapshot.outlookChangePct > 0 ? "+" : ""}${snapshot.outlookChangePct}%${snapshot.annualOpenings ? ` · ~${snapshot.annualOpenings.toLocaleString("en-US")} openings/yr` : ""}`;
  const rows: [string, string | null][] = [
    ["Median pay", pay],
    ["Typical education", snapshot.typicalEducation],
    ["Job growth 2025–35", growth],
    ["Can work remotely", snapshot.teleworkAbility],
    ["Need no prior experience", snapshot.noPriorExperience],
  ];
  return (
    <div className="career-card">
      <strong>{snapshot.name}</strong>
      <dl>
        {rows.map(([label, value]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd>{value ?? "Not published"}</dd>
          </div>
        ))}
      </dl>
      <a href={snapshot.sourceUrl} target="_blank" rel="noopener noreferrer">
        Source: {snapshot.attribution} <ArrowUpRight size={12} />
      </a>
    </div>
  );
}

function ResumeSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="resume-section">
      <h4>{title}</h4>
      <div className="resume-section-content">{children}</div>
    </section>
  );
}
