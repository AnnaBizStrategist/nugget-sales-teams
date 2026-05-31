import { useState, useCallback, useRef, useEffect } from "react";
import Papa from "papaparse";
import JSZip from "jszip";

// ── Design tokens ─────────────────────────────────────────────────────────────
const BLUE_DEEP   = "#0d2d6b";
const BLUE_MID    = "#1149ac";
const BLUE_BRIGHT = "#41a1e8";
const BLUE_LIGHT  = "#7ec8f5";
const DARK        = "#0a1628";
const DARK_CARD   = "#0f2040";
const WHITE       = "#e8f0fe";
const MUTED       = "#9fc4e8";
const BORDER      = "#1e4080";

// ── Report definitions ────────────────────────────────────────────────────────
const REPORTS = [
  {
    id: "warm",
    name: "The Warm 25",
    tag: "INCLUDED",
    subtitle: "Your ranked prospect list — ready to work",
    description: "Your top 25 warmest prospects ranked by relationship strength, grouped by seniority, and loaded with buying signals. Plus targeted Navigator filter sets to find more prospects just like your best ones.",
    files: ["Connections", "Messages", "Invitations", "Reactions"],
    free: true,
  },
  {
    id: "inner",
    name: "The Inner Circle",
    tag: "INCLUDED",
    subtitle: "Your referral engine",
    description: "The champions and referral partners already in your corner who you're not activating. Ranked by relationship strength with a tailored ask framework for each one.",
    files: ["Connections", "Messages", "Invitations", "Recommendations_Received"],
    free: true,
  },
];

// ── AI Prompts ────────────────────────────────────────────────────────────────
const PROMPTS = {
  warm: `You are a senior B2B sales intelligence analyst. Generate "The Warm 25" — a ranked, actionable prospect list for a sales professional based on their LinkedIn network data.

Do not include a title or heading at the start of your response. Begin directly with the first section.

WARMTH SCORING — use these signals, weighted in order:
1. Message frequency and recency (heaviest weight — active conversation = hot)
2. Inbound connection (they invited the user, not the other way around — moderate warmth boost)
3. Reactions to content (lighter weight — engagement signal)
4. Connection recency (context only — not a warmth indicator on its own)

GROUP THE 25 LEADS BY SENIORITY — this determines how the salesperson approaches each person:

## Decision Makers — Engage Directly
(C-Suite, VP, Owner, President, Managing Director — Budget and Authority live here)
List up to 10 people. For each:
**Name** | Title | Company | Warmth signal | Buying signal | Best opening move

## Influencers — Nurture and Path Through
(Director, Senior Manager, Head of — they influence decisions but rarely own budget)
List up to 10 people. For each:
**Name** | Title | Company | Warmth signal | Relationship context | How to use them as a path to the decision maker

## Connectors — Activate for Referrals
(Consultants, Advisors, Coaches, other salespeople — high referral multiplier potential)
List up to 5 people. For each:
**Name** | Title | Company | Why they're a valuable connector | Best referral ask

## Pipeline Reality Check
One honest observation about the quality of this warm pipeline. What's the strongest signal in the data? What's missing? Keep it direct and useful.

## LinkedIn Sales Navigator Filter Sets
Based on the patterns in this warm lead list, generate 3-4 targeted filter sets the salesperson can use in Navigator to find more prospects like their best ones.

**Filter Set 1 — Your Sweet Spot** (the profile that shows up most in warm leads):
- Industry:
- Seniority:
- Company size:
- Geography:
- Job titles:

**Filter Set 2 — Referral Multipliers** (people who look like your best connectors):
- Industry:
- Seniority:
- Company size:
- Geography:
- Job titles:

**Filter Set 3 — Emerging Opportunity** (a smaller but promising pattern in the data):
- Industry:
- Seniority:
- Company size:
- Geography:
- Job titles:

**Filter Set 4 — Decision Maker Expansion** (find more people like your top Decision Makers):
- Industry:
- Seniority:
- Company size:
- Geography:
- Job titles:

## This Week's Outreach — 3 Ready-to-Send Messages
Personalised opening messages based on real relationship context from the data. Not templates — actual messages they can send today.

1. **[Name] — Decision Maker outreach:**
[Message using real context — 2-3 sentences max]

2. **[Name] — Warm reactivation:**
[Message using real context — 2-3 sentences max]

3. **[Name] — Referral ask:**
[Message using real context — 2-3 sentences max]

Use real names throughout. Every line should be immediately actionable. Speak directly to the salesperson — use "you" and "your". Sales language: buying signals, relationship capital, pipeline, warm outreach, revenue generating activities.`,

  inner: `You are a B2B sales relationship analyst. Generate "The Inner Circle" — identifying the champions and referral partners already in this salesperson's LinkedIn network who they're not fully activating.

Do not include a title or heading at the start of your response. Begin directly with the first section.

Look for: people who wrote recommendations, consistent high-volume messagers, inbound connections (they reached out first), patterns of support and responsiveness. These are the people already in their corner.

WARMTH SIGNALS to weight:
1. Wrote a recommendation — strongest advocate signal
2. Consistent messaging history — relationship depth
3. Inbound connection — they came to the salesperson first
4. Engagement patterns — showing up repeatedly

## Your Champions — Already In Your Corner
8-12 people ranked by advocacy strength and referral potential. For each:
**Name** | Title | Company | Why they're already an advocate | Relationship depth | Best ask: (referral / warm introduction / co-sell opportunity)

## The 3 You're Definitely Not Activating
Name 3 specific people the data shows are clearly supportive but almost certainly never asked for anything. Be specific about why they're underutilised.

## Your Referral Ask Framework
**Who to ask first:** [The profile of your strongest advocates based on the data — be specific]
**When to ask:** [The right moment in the relationship to make the ask]
**How to ask:** A natural, non-awkward way to make the ask — 2-3 sentences they can adapt directly

## Ask Templates by Type

**For a warm introduction:**
[2-sentence message they can send today — personalised to their context]

**For a direct referral:**
[2-sentence message — specific and natural, not salesy]

**For a co-sell or collaboration:**
[2-sentence message — positioned as mutual value]

## Stakeholder Mapping Insight
Based on the Inner Circle data — who in this network has the widest reach into target accounts? Who should they be co-selling with? Who can open doors that cold outreach never will?

## This Week's 3 Actions
Specific, named actions. Who to contact, what to ask, what to say. No vague advice.

Use real names. Speak directly to the salesperson. Every recommendation should be immediately usable in a sales context.`,
};

// ── Report Intros ─────────────────────────────────────────────────────────────
const INTROS = {
  warm: `Your Warm 25 isn't a list — it's a ranked pipeline of your most conversion-ready prospects.\n\nEvery person here is grouped by seniority so you know exactly how to approach them: engage Decision Makers directly, use Influencers to path your way in, and activate Connectors for referrals that multiply your reach.\n\nAt the bottom you'll find your Navigator filter sets — built from the patterns in your own warm network. Use those to find 50 more prospects who look exactly like your best ones. That's your warm outreach strategy, start to finish.`,

  inner: `These aren't just connections — these are people who've already shown up for you. A recommendation written, a conversation started, a consistent pattern of showing up in your corner.\n\nThe Inner Circle is your referral engine. One warm introduction from the right person beats 50 cold calls. This report tells you who your strongest advocates are, what to ask each one for, and gives you the exact words to do it.\n\nRead the Referral Ask Framework carefully. The ask itself is often the only thing standing between you and your next closed deal.`,
};

// ── CSV / ZIP helpers ─────────────────────────────────────────────────────────
function parseLinkedInCSV(file, onComplete) {
  const isConnections = file.name.toLowerCase().includes("connection");
  if (isConnections) {
    const reader = new FileReader();
    reader.onload = (e) => {
      const lines = e.target.result.split("\n");
      Papa.parse(lines.slice(3).join("\n"), { header: true, skipEmptyLines: true, complete: onComplete });
    };
    reader.readAsText(file);
  } else {
    Papa.parse(file, { header: true, skipEmptyLines: true, complete: onComplete });
  }
}

function getFileKey(name) {
  const lower = name.toLowerCase().replace(/[-_ ]/g, "");
  if (lower.includes("connection"))  return "Connections";
  if (lower.includes("message"))     return "Messages";
  if (lower.includes("recommendation_received")) return "Recommendations_Received";
  if (lower.includes("recommendation_given")) return "Recommendations_Given";
  if (lower.includes("recommendation")) return "Recommendations_Received";
  if (lower.includes("endorsement")) return "Endorsements";
  if (lower.includes("skill"))       return "Skills";
  if (lower.includes("profile") && !lower.includes("summary")) return "Profile";
  if (lower.includes("comment"))     return "Comments";
  if (lower.includes("reaction"))    return "Reactions";
  if (lower.includes("share"))       return "Shares";
  if (lower.includes("invitation"))  return "Invitations";
  return name.replace(".csv", "");
}

// ── API call ──────────────────────────────────────────────────────────────────
async function callClaude(systemPrompt, data, retries = 3, onRetry = null) {
  const apiKey = import.meta.env.VITE_ANTHROPIC_API_KEY;
  const body = JSON.stringify({
    model: "claude-sonnet-4-20250514",
    max_tokens: 1800,
    system: systemPrompt,
    messages: [{ role: "user", content: `Here is the LinkedIn export data to analyse:\n\n${JSON.stringify(data, null, 2)}\n\nGenerate the report now. Use real names from the data. Make every insight immediately actionable for a sales professional.` }],
  });
  for (let attempt = 0; attempt < retries; attempt++) {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "anthropic-dangerous-direct-browser-access": "true",
      },
      body,
    });
    if (response.ok) return (await response.json()).content[0].text;
    const err = await response.json();
    if (response.status === 429 && attempt < retries - 1) {
      const waitMs = Math.pow(2, attempt + 1) * 10000;
      if (onRetry) onRetry(waitMs / 1000);
      await new Promise((res) => setTimeout(res, waitMs));
      continue;
    }
    throw new Error(err.error?.message || `API error ${response.status}`);
  }
}

function categorizeSeniority(title = "") {
  const t = title.toLowerCase();
  if (/founder|co-founder|owner|ceo|president|managing director|chief executive/.test(t)) return "Decision Maker";
  if (/coo|cfo|cto|cmo|cso|chief/.test(t)) return "Decision Maker";
  if (/vp|vice president|svp|evp/.test(t)) return "Decision Maker";
  if (/director|head of/.test(t)) return "Influencer";
  if (/manager|senior manager|lead/.test(t)) return "Influencer";
  if (/consultant|advisor|strategist|coach|partner/.test(t)) return "Connector";
  return "Other";
}

function slimConnection(c) {
  return {
    name: `${c["First Name"] || ""} ${c["Last Name"] || ""}`.trim(),
    company: c["Company"] || "",
    position: c["Position"] || "",
    connected: c["Connected On"] || "",
  };
}

function prepareData(parsedData, fileKeys) {
  const out  = {};
  const meta = {};

  fileKeys.forEach((k) => {
    if (!parsedData[k]) {
      if (["Connections", "Messages"].includes(k)) {
        meta[`${k}_missing`] = `${k} data not found. User may have uploaded Basic export. Do not fabricate — acknowledge this gap.`;
      }
      return;
    }
    const total = parsedData[k].length;
    meta[`${k}_total`] = total;

    if (k === "Connections") {
      const seniorityDist = {};
      parsedData[k].forEach((c) => {
        const s = categorizeSeniority(c["Position"] || "");
        seniorityDist[s] = (seniorityDist[s] || 0) + 1;
      });
      out[k] = {
        _summary: { total, seniority_distribution: seniorityDist },
        all_connections: parsedData[k].slice(0, 60).map(slimConnection),
      };
    } else if (k === "Messages") {
      out[k] = parsedData[k].slice(0, 60).map((m) => ({
        FROM:    m.FROM    || m.From    || "",
        TO:      m.TO      || m.To      || "",
        DATE:    m.DATE    || m.Date    || "",
        SUBJECT: (m.SUBJECT || m.Subject || "").substring(0, 80),
        CONTENT: (m.CONTENT || m.Content || "").substring(0, 120),
      }));
      meta[`${k}_shown`] = Math.min(60, total);
    } else if (k === "Invitations") {
      out[k] = parsedData[k].slice(0, 40).map((inv) => ({
        From:      inv.From      || inv.from      || "",
        To:        inv.To        || inv.to        || "",
        SentAt:    inv.SentAt    || inv["Sent At"] || "",
        Direction: inv.Direction || inv.direction || "",
        Message:   (inv.Message || inv.message || "").substring(0, 100),
      }));
      meta[`${k}_shown`] = Math.min(40, total);
    } else if (k === "Reactions") {
      out[k] = parsedData[k].slice(0, 20);
      meta[`${k}_shown`] = Math.min(20, total);
    } else {
      out[k] = parsedData[k].slice(0, 50);
      meta[`${k}_shown`] = Math.min(50, total);
    }
  });

  if (Object.keys(out).length === 0) out["_note"] = "No matching files found. User may have uploaded Basic export.";
  if (Object.keys(meta).length > 0)  out["_meta"] = meta;
  return out;
}

// ── Intro Block ───────────────────────────────────────────────────────────────
function IntroBlock({ reportId }) {
  const text = INTROS[reportId];
  if (!text) return null;
  return (
    <div style={{ background: `linear-gradient(135deg, ${BLUE_DEEP}88, ${DARK_CARD})`, border: `1px solid ${BLUE_BRIGHT}33`, borderRadius: 10, padding: "20px 24px", marginBottom: 28 }}>
      {text.split("\n\n").map((para, i) => (
        <p key={i} style={{ fontSize: 14, color: MUTED, lineHeight: 1.8, margin: i > 0 ? "12px 0 0" : 0 }}>{para}</p>
      ))}
    </div>
  );
}

// ── Report content renderer ───────────────────────────────────────────────────
function ReportContent({ text }) {
  return (
    <div style={{ lineHeight: 1.85 }}>
      {text.split("\n").map((line, i) => {
        if (line.startsWith("## ")) return <h3 key={i} style={{ color: BLUE_BRIGHT, fontSize: 13, fontWeight: 700, marginTop: 28, marginBottom: 10, letterSpacing: "0.08em", textTransform: "uppercase", borderLeft: "3px solid #41a1e8", paddingLeft: 10, paddingBottom: 4 }}>{line.replace("## ", "")}</h3>;
        const bold = line.replace(/\*\*(.*?)\*\*/g, `<strong style="color:${BLUE_LIGHT}">$1</strong>`);
        if (line.match(/^\d+\./)) return <div key={i} style={{ display: "flex", gap: 12, margin: "8px 0", paddingLeft: 8 }}><span style={{ color: BLUE_BRIGHT, fontWeight: 700, minWidth: 20, fontSize: 13 }}>{line.match(/^\d+/)[0]}.</span><p style={{ color: WHITE, margin: 0, fontSize: 14, flex: 1 }} dangerouslySetInnerHTML={{ __html: bold.replace(/^\d+\./, "") }} /></div>;
        if (line.startsWith("- ") || line.startsWith("• ")) return <div key={i} style={{ display: "flex", gap: 10, margin: "6px 0", paddingLeft: 8 }}><span style={{ color: BLUE_BRIGHT, marginTop: 8, width: 5, height: 5, borderRadius: "50%", background: BLUE_BRIGHT, flexShrink: 0, display: "block" }} /><p style={{ color: WHITE, margin: 0, fontSize: 14 }} dangerouslySetInnerHTML={{ __html: bold.replace(/^[-•]\s/, "") }} /></div>;
        if (line.trim() === "") return <div key={i} style={{ height: 6 }} />;
        return <p key={i} style={{ fontSize: 15, margin: "6px 0", color: WHITE, lineHeight: 1.85 }} dangerouslySetInnerHTML={{ __html: bold }} />;
      })}
    </div>
  );
}

// ── Laptop Frame ──────────────────────────────────────────────────────────────
function LaptopFrame({ children }) {
  return (
    <div className="scroll-reveal" style={{ marginBottom: 20 }}>
      <div style={{ background: "#1a1a2e", borderRadius: "12px 12px 0 0", padding: "10px 10px 0", border: "2px solid #2a2a4a", borderBottom: "none" }}>
        <div style={{ background: "#0f0f1e", borderRadius: "8px 8px 0 0", padding: "8px 12px", display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ display: "flex", gap: 5 }}>
            <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#ff5f57" }} />
            <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#febc2e" }} />
            <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#28c840" }} />
          </div>
          <div style={{ flex: 1, background: "#1a1a2e", borderRadius: 4, padding: "3px 10px", fontSize: 10, color: "#4a6a8a", textAlign: "center" }}>nugget for sales teams</div>
        </div>
        <div style={{ borderRadius: "0 0 4px 4px", overflow: "hidden", maxHeight: 480, overflowY: "hidden" }}>
          {children}
        </div>
      </div>
      <div style={{ background: "#2a2a4a", height: 14, borderRadius: "0 0 4px 4px", border: "2px solid #2a2a4a", borderTop: "none" }} />
      <div style={{ background: "#1e1e3a", height: 8, width: "60%", margin: "0 auto", borderRadius: "0 0 8px 8px" }} />
    </div>
  );
}

// ── Divider ───────────────────────────────────────────────────────────────────
function Divider() {
  return <div style={{ height: 1, background: `linear-gradient(90deg, transparent, ${BORDER}, transparent)`, margin: "56px 0" }} />;
}

// ── Main App ──────────────────────────────────────────────────────────────────
export default function App() {
  const [step,            setStep]           = useState("upload");
  const [uploadedFiles,   setUploadedFiles]  = useState({});
  const [parsedData,      setParsedData]     = useState({});
  const [reports,         setReports]        = useState({});
  const [generating,      setGenerating]     = useState(null);
  const [activeReport,    setActiveReport]   = useState("warm");
  const [dragOver,        setDragOver]       = useState(false);
  const [error,           setError]          = useState(null);
  const [retryMessage,    setRetryMessage]   = useState(null);
  const [showModal,       setShowModal]      = useState(false);
  const [pendingReportId, setPendingReportId]= useState(null);
  const [userName,        setUserName]       = useState("");
  const [userCompany,     setUserCompany]    = useState("");
  const [userEmail,       setUserEmail]      = useState("");
  const [modalSubmitting, setModalSubmitting]= useState(false);
  const [modalSubmitted,  setModalSubmitted] = useState(false);
  const fileInputRef = useRef(null);
  const uploadRef    = useRef(null);
  const [loadingMsg,  setLoadingMsg]   = useState("");
  const loadingMsgsWarm  = [
    "Analysing your connection warmth...",
    "Grouping prospects by seniority...",
    "Identifying buying signals...",
    "Building your Navigator filter sets...",
    "Writing your outreach messages...",
    "Almost there — finalising your Warm 25...",
  ];
  const loadingMsgsInner = [
    "Identifying your strongest advocates...",
    "Analysing recommendation patterns...",
    "Finding your untapped champions...",
    "Building your referral ask framework...",
    "Writing your outreach templates...",
    "Almost there — finalising your Inner Circle...",
  ];

  const hasFiles           = Object.keys(uploadedFiles).length > 0;
  const connCount          = parsedData["Connections"]?._summary?.total || parsedData["Connections"]?.length || 0;
  const msgCount           = parsedData["Messages"]?.length || 0;
  const reportsReady       = Object.keys(reports).length;
  const activeReportMeta   = REPORTS.find(r => r.id === activeReport);
  const isMissingCriticalFiles = hasFiles && !parsedData["Connections"];

  const handleFiles = useCallback((fileList) => {
    Array.from(fileList).forEach((file) => {
      if (file.name.endsWith(".zip")) {
        JSZip.loadAsync(file).then(zip => {
          zip.forEach((relativePath, zipEntry) => {
            const fileName = relativePath.split("/").pop();
            if (!fileName.endsWith(".csv")) return;
            const key = getFileKey(fileName);
            zipEntry.async("string").then(csvText => {
              const isConn = fileName.toLowerCase().includes("connection");
              const text   = isConn ? csvText.split("\n").slice(3).join("\n") : csvText;
              Papa.parse(text, { header: true, skipEmptyLines: true, complete: results => {
                if (results.data.length > 0) {
                  setUploadedFiles(prev => ({ ...prev, [key]: fileName }));
                  setParsedData(prev => ({ ...prev, [key]: results.data }));
                }
              }});
            });
          });
        });
      } else if (file.name.endsWith(".csv")) {
        const key = getFileKey(file.name);
        setUploadedFiles(prev => ({ ...prev, [key]: file.name }));
        parseLinkedInCSV(file, results => setParsedData(prev => ({ ...prev, [key]: results.data })));
      }
    });
  }, []);

  const handleDrop = useCallback((e) => {
    e.preventDefault(); setDragOver(false); handleFiles(e.dataTransfer.files);
  }, [handleFiles]);

  const initiateReport = (reportId) => {
    if (generating) return;
    if (!modalSubmitted) {
      setPendingReportId(reportId);
      setShowModal(true);
    } else {
      runReport(reportId);
    }
  };

  const runReport = async (reportId) => {
    const report = REPORTS.find(r => r.id === reportId);
    if (!report || generating) return;
    setGenerating(reportId); setActiveReport(reportId); setStep("reports"); setError(null); setRetryMessage(null);
    try {
      const result = await callClaude(
        PROMPTS[reportId],
        prepareData(parsedData, report.files),
        3,
        (secs) => setRetryMessage(`The hamster's catching its breath — back in ~${Math.round(secs)}s! 🐹`)
      );
      setReports(prev => ({ ...prev, [reportId]: result }));
    } catch (err) { setError(err.message); }
    finally { setGenerating(null); setRetryMessage(null); }
  };

  const submitModal = async () => {
    if (!userName.trim() || !userEmail.trim()) return;
    setModalSubmitting(true);
    const pending = pendingReportId;
    setPendingReportId(null);
    fetch("https://hook.us2.make.com/xu7d06pva2t2hhyccr86ddar7msqm4zl", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: userName.trim(), company: userCompany.trim(), email: userEmail.trim(), source: "nugget-sales-teams" }),
    }).catch(err => console.log("Webhook error:", err));
    setModalSubmitted(true);
    setModalSubmitting(false);
    setShowModal(false);
    if (pending) runReport(pending);
  };

  const loadingIntervalRef = useRef(null);
  useEffect(() => {
    if (generating) {
      const msgs = generating === "warm" ? loadingMsgsWarm : loadingMsgsInner;
      let i = 0;
      setLoadingMsg(msgs[0]);
      loadingIntervalRef.current = setInterval(() => {
        i = (i + 1) % msgs.length;
        setLoadingMsg(msgs[i]);
      }, 2800);
    } else {
      clearInterval(loadingIntervalRef.current);
      setLoadingMsg("");
    }
    return () => clearInterval(loadingIntervalRef.current);
  }, [generating]);

  const observerRef = useRef(null);
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => entries.forEach(e => { if (e.isIntersecting) e.target.classList.add("visible"); }),
      { threshold: 0.12 }
    );
    observerRef.current = observer;
    setTimeout(() => {
      document.querySelectorAll(".scroll-reveal").forEach(el => observer.observe(el));
    }, 100);
    return () => observer.disconnect();
  });

  const scrollToUpload = () => uploadRef.current?.scrollIntoView({ behavior: "smooth" });

  const primaryBtn = {
    padding: "13px 32px",
    background: `linear-gradient(135deg, ${BLUE_MID}, ${BLUE_BRIGHT})`,
    color: WHITE,
    border: "none",
    borderRadius: 9,
    fontWeight: 700,
    fontSize: 15,
    cursor: "pointer",
    fontFamily: "Georgia, serif",
    letterSpacing: "0.02em",
  };

  return (
    <div style={{ minHeight: "100vh", background: DARK, fontFamily: "'DM Sans', -apple-system, sans-serif", color: WHITE }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&display=swap');
        html, body { margin: 0; padding: 0; background: #0a1628; overflow-x: hidden; }
        input { outline: none !important; }
        input::placeholder { color: #4a6a8a; }
        ::-webkit-scrollbar { width: 6px; }
        ::-webkit-scrollbar-track { background: #0a1628; }
        ::-webkit-scrollbar-thumb { background: #1e4080; border-radius: 3px; }
        @keyframes spin        { to { transform: rotate(360deg); } }
        @keyframes fadeIn      { from { opacity: 0; transform: scale(0.96); } to { opacity: 1; transform: scale(1); } }
        @keyframes fadeSlideUp { from { opacity: 0; transform: translateY(24px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes pulseCTA    { 0%,100% { box-shadow: 0 0 0 0 rgba(65,161,232,0.4); } 70% { box-shadow: 0 0 0 14px rgba(65,161,232,0); } }
        .scroll-reveal         { opacity: 0; transform: translateY(32px); transition: opacity 0.65s ease, transform 0.65s ease; }
        .scroll-reveal.visible { opacity: 1; transform: translateY(0); }
        * { box-sizing: border-box; margin: 0; padding: 0; }
      `}</style>

      {/* ── Header ── */}
      <header style={{ borderBottom: `1px solid ${BORDER}`, padding: "16px 40px", display: "flex", alignItems: "center", background: DARK_CARD, position: "sticky", top: 0, zIndex: 100 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div style={{ fontSize: 24, fontFamily: "Georgia, serif", fontWeight: 700, letterSpacing: "-0.5px", background: `linear-gradient(90deg, ${BLUE_BRIGHT}, ${BLUE_LIGHT})`, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", whiteSpace: "nowrap", lineHeight: 1.2 }}>Nugget<span style={{ fontSize: 13, verticalAlign: "super", marginLeft: 1 }}>™</span> <span style={{ fontSize: 14, fontFamily: "'DM Sans', sans-serif", fontWeight: 600 }}>for Sales Teams</span></div>
          <div style={{ width: 1, height: 28, background: BORDER, flexShrink: 0 }} />
          <div style={{ fontSize: 13, color: MUTED, letterSpacing: "0.03em", lineHeight: 1, marginTop: 2 }}>A sale starts with a warm conversation.</div>
        </div>
        <nav style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
          {step === "upload" ? (
            <button style={{ ...primaryBtn, padding: "8px 20px", fontSize: 13 }} onClick={scrollToUpload}>Get My Warm 25 →</button>
          ) : (
            <>
              <button style={{ padding: "6px 16px", borderRadius: 6, border: `1px solid ${BORDER}`, background: "transparent", color: MUTED, cursor: "pointer", fontSize: 13 }} onClick={() => setStep("upload")}>Home</button>
              <button style={{ padding: "6px 16px", borderRadius: 6, border: `1px solid ${step === "reports" ? BLUE_BRIGHT : BORDER}`, background: step === "reports" ? BLUE_MID + "44" : "transparent", color: step === "reports" ? BLUE_BRIGHT : MUTED, cursor: "pointer", fontSize: 13 }} onClick={() => reportsReady > 0 && setStep("reports")}>
                Reports {reportsReady > 0 && `(${reportsReady})`}
              </button>
            </>
          )}
        </nav>
      </header>

      <main style={{ maxWidth: 980, margin: "0 auto", padding: "0 24px 80px" }}>

        {/* ══ UPLOAD / HOME ══ */}
        {step === "upload" && (
          <>
            {/* Hero */}
            <div style={{ background: `linear-gradient(160deg, #061022 0%, #0d2d6b 40%, #1149ac 70%, #41a1e8 100%)`, padding: "80px 24px 72px", borderRadius: "0 0 24px 24px", textAlign: "center", marginBottom: 0 }}>
              <div style={{ fontSize: 13, color: "rgba(255,255,255,0.6)", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 20, animation: "fadeSlideUp 0.7s ease-out 0.05s both" }}>Nugget™ for Sales Teams</div>
              <h1 style={{ fontSize: 48, fontFamily: "Georgia, serif", fontWeight: 700, color: "#ffffff", marginBottom: 28, lineHeight: 1.1, animation: "fadeSlideUp 0.7s ease-out 0.1s both" }}>
                Your warmest prospects<br />are already<br />
                <span style={{ background: `linear-gradient(90deg, ${BLUE_BRIGHT}, ${BLUE_LIGHT})`, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>in your network.</span>
              </h1>
              <p style={{ fontSize: 18, color: "rgba(255,255,255,0.85)", maxWidth: 580, margin: "0 auto 44px", lineHeight: 1.75, animation: "fadeSlideUp 0.7s ease-out 0.2s both" }}>
                Nugget shows your sales team exactly who to prioritise, what to say, and where the warm opportunities are hiding.
              </p>
              <div style={{ display: "flex", gap: 8, justifyContent: "center", flexWrap: "wrap", marginBottom: 44, animation: "fadeSlideUp 0.7s ease-out 0.4s both" }}>
                <button style={{ ...primaryBtn, fontSize: 16, padding: "14px 36px" }} onClick={scrollToUpload}>Get My Warm 25 →</button>
              </div>
              <p style={{ fontSize: 28, fontFamily: "Georgia, serif", fontWeight: 700, color: "rgba(255,255,255,0.85)", letterSpacing: "-0.3px", marginTop: 20, animation: "fadeSlideUp 0.7s ease-out 0.5s both" }}>
                NO scraping.&nbsp;&nbsp;NO wasted calls.&nbsp;&nbsp;NO guessing.
              </p>
            </div>

            <div style={{ padding: "56px 0 0" }}>

              {/* The Problem */}
              <div className="scroll-reveal" style={{ background: DARK_CARD, border: `1px solid ${BORDER}`, borderRadius: 16, padding: "64px 48px", marginBottom: 0, textAlign: "center" }}>
                <div style={{ fontSize: 14, color: MUTED, letterSpacing: "0.06em", textTransform: "uppercase", fontWeight: 700, marginBottom: 20 }}>Sound familiar?</div>
                <p style={{ fontSize: 19, color: WHITE, lineHeight: 1.8, maxWidth: 600, margin: "0 auto", fontFamily: "Georgia, serif" }}>
                  Every sales team knows the frustration. Marketing delivers the MQLs, Sales works through them, and too many don't qualify — wrong budget, wrong authority, wrong timing. The pipeline looks full but conversion tells a different story.
                </p>
                <p style={{ fontSize: 19, color: WHITE, lineHeight: 1.8, maxWidth: 680, margin: "24px auto 0", fontFamily: "Georgia, serif" }}>
                  What nobody's looking at is the warm relationship capital already sitting in your team's LinkedIn networks. The prospects who'd actually take the call. The referral partners who haven't been asked. The dormant connections who are one warm introduction away from becoming your next closed deal.
                </p>
                <p style={{ fontSize: 19, color: BLUE_BRIGHT, lineHeight: 1.8, maxWidth: 680, margin: "24px auto 0", fontFamily: "Georgia, serif", fontWeight: 600 }}>
                  The problem isn't lead volume. It's lead quality. And the highest quality leads are the ones where a relationship already exists. Nugget finds them, ranks them, and tells your team exactly who to call first.
                </p>
              </div>

              {/* The Solution */}
              <div className="scroll-reveal" style={{ background: `linear-gradient(135deg, ${BLUE_DEEP}, ${DARK_CARD})`, border: `1px solid ${BLUE_BRIGHT}44`, borderRadius: 16, padding: "64px 48px", marginBottom: 0, marginTop: 40, textAlign: "center" }}>
                <div style={{ fontSize: 14, color: BLUE_BRIGHT, letterSpacing: "0.06em", textTransform: "uppercase", fontWeight: 700, marginBottom: 20 }}>Enter Nugget™ for Sales Teams</div>
                <p style={{ fontSize: 19, color: WHITE, lineHeight: 1.8, maxWidth: 660, margin: "0 auto", fontFamily: "Georgia, serif" }}>
                  Your team's LinkedIn networks are full of untapped relationship capital. Nugget turns that data into a ranked, prioritised warm lead list — complete with buying signals, relationship context, and the exact Navigator filters to find more prospects just like your best ones.
                </p>
              </div>

              <Divider />

              {/* Mockups */}
              <div style={{ marginBottom: 40 }}>
                <div style={{ textAlign: "center", marginBottom: 40 }}>
                  <div style={{ fontSize: 14, color: BLUE_BRIGHT, letterSpacing: "0.06em", textTransform: "uppercase", fontWeight: 700, marginBottom: 18 }}>See It In Action</div>
                  <h2 style={{ fontSize: 32, fontFamily: "Georgia, serif", fontWeight: 700, color: WHITE, marginBottom: 12 }}>Real intelligence. Real names. Real pipeline.</h2>
                  <p style={{ fontSize: 15, color: MUTED, maxWidth: 500, margin: "0 auto" }}>Here's a sample of what your reports actually look like.</p>
                </div>

                {/* Mockup 1 — Warm 25 */}
                <LaptopFrame>
                  <div style={{ background: DARK_CARD, padding: "28px 32px", position: "relative", overflow: "hidden" }}>
                    <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 3, background: `linear-gradient(90deg, ${BLUE_BRIGHT}, ${BLUE_MID})` }} />
                    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 24 }}>
                      <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.06em", background: BLUE_MID + "33", color: BLUE_BRIGHT, padding: "3px 10px", borderRadius: 4 }}>INCLUDED</div>
                      <div style={{ fontSize: 16, fontWeight: 700, color: WHITE, fontFamily: "Georgia, serif" }}>The Warm 25</div>
                      <div style={{ fontSize: 11, color: MUTED, textTransform: "uppercase", letterSpacing: "0.05em" }}>— Decision Makers</div>
                    </div>
                    <div style={{ borderLeft: `3px solid ${BLUE_BRIGHT}`, paddingLeft: 12, marginBottom: 20 }}>
                      <div style={{ fontSize: 11, color: BLUE_BRIGHT, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 10 }}>Engage Directly — Budget & Authority Live Here</div>
                    </div>
                    {[
                      { name: "Chad Learmond", title: "VP Sales", company: "Amplify Solutions", signal: "Exchanged 6 messages this month — actively discussing pipeline strategy", move: "\"Chad — your point about MQL quality resonated. I've got something that surfaces the warm leads before they even hit qualification. Worth 15 minutes?\"" },
                      { name: "Sarah Okafor", title: "CEO", company: "Vertex Growth Co.", signal: "Inbound connection — she requested you, strong buying signal", move: "\"Sarah — you connected with me last month and I've been meaning to follow up. What's the biggest growth challenge on your plate right now?\"" },
                      { name: "Marcus Webb", title: "VP Revenue", company: "ScaleWorks Inc.", signal: "Reacted to your last 3 posts, commented on your pipeline post", move: "\"Marcus — noticed you've been engaging with the pipeline content. Are you dealing with the warm-vs-cold lead quality problem I was writing about?\"" },
                    ].map((p, i) => (
                      <div key={i} style={{ background: DARK, borderRadius: 10, padding: "16px 18px", marginBottom: 10, border: `1px solid ${BORDER}` }}>
                        <div style={{ display: "flex", gap: 8, alignItems: "baseline", marginBottom: 4 }}>
                          <span style={{ fontSize: 13, fontWeight: 700, color: BLUE_BRIGHT }}>{p.name}</span>
                          <span style={{ fontSize: 11, color: MUTED }}>| {p.title} | {p.company}</span>
                        </div>
                        <div style={{ fontSize: 12, color: MUTED, lineHeight: 1.5, marginBottom: 8 }}>📊 {p.signal}</div>
                        <div style={{ fontSize: 12, color: WHITE, lineHeight: 1.65, background: BLUE_MID + "22", padding: "10px 14px", borderRadius: 8, borderLeft: `3px solid ${BLUE_BRIGHT}` }}>
                          <span style={{ color: BLUE_BRIGHT, fontWeight: 700 }}>Opening move: </span>{p.move}
                        </div>
                      </div>
                    ))}
                    <div style={{ marginTop: 12, fontSize: 12, color: MUTED, fontStyle: "italic", textAlign: "center" }}>+ Navigator filter sets at the bottom of your full report</div>
                  </div>
                </LaptopFrame>

                {/* Mockup 2 — Inner Circle */}
                <LaptopFrame>
                  <div style={{ background: DARK_CARD, padding: "28px 32px", position: "relative", overflow: "hidden" }}>
                    <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 3, background: `linear-gradient(90deg, #4ade80, ${BLUE_BRIGHT})` }} />
                    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 24 }}>
                      <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.06em", background: "#4ade8022", color: "#4ade80", padding: "3px 10px", borderRadius: 4 }}>INCLUDED</div>
                      <div style={{ fontSize: 16, fontWeight: 700, color: WHITE, fontFamily: "Georgia, serif" }}>The Inner Circle</div>
                      <div style={{ fontSize: 11, color: MUTED, textTransform: "uppercase", letterSpacing: "0.05em" }}>— Your Champions</div>
                    </div>
                    <div style={{ borderLeft: `3px solid #4ade80`, paddingLeft: 12, marginBottom: 20 }}>
                      <div style={{ fontSize: 11, color: "#4ade80", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 10 }}>Already In Your Corner — You Just Haven't Asked</div>
                    </div>
                    {[
                      { name: "James Pham", title: "Marketing Director", company: "Amplify Solutions", why: "Wrote you a LinkedIn recommendation 6 months ago. Has referred 2 clients to contacts in his network this year. Never been asked for a referral by you.", ask: "Referral ask", msg: "\"James — I've been thinking about that recommendation you wrote me. I'm actively growing my pipeline right now and you know exactly who I help. Would you be open to making a few intros?\"" },
                      { name: "Rina Kapoor", title: "Founder & Advisor", company: "Kapoor Ventures", why: "Sent you the connection request. Messages you every 3-4 weeks. Has a network of 2,400 founders — exactly your ICP.", ask: "Warm introduction", msg: "\"Rina — I always enjoy our conversations. I'm looking to connect with a few more founders navigating growth-stage challenges. Would you feel comfortable making an intro or two?\"" },
                    ].map((p, i) => (
                      <div key={i} style={{ background: DARK, borderRadius: 10, padding: "16px 18px", marginBottom: 10, border: `1px solid ${BORDER}` }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 4 }}>
                          <div style={{ display: "flex", gap: 8, alignItems: "baseline" }}>
                            <span style={{ fontSize: 13, fontWeight: 700, color: "#4ade80" }}>{p.name}</span>
                            <span style={{ fontSize: 11, color: MUTED }}>| {p.title} | {p.company}</span>
                          </div>
                          <span style={{ fontSize: 10, background: "#4ade8022", color: "#4ade80", padding: "2px 8px", borderRadius: 4, fontWeight: 700, flexShrink: 0 }}>{p.ask}</span>
                        </div>
                        <div style={{ fontSize: 12, color: MUTED, lineHeight: 1.5, marginBottom: 8 }}>{p.why}</div>
                        <div style={{ fontSize: 12, color: WHITE, lineHeight: 1.65, background: "#4ade8011", padding: "10px 14px", borderRadius: 8, borderLeft: `3px solid #4ade80` }}>
                          <span style={{ color: "#4ade80", fontWeight: 700 }}>Say this: </span>{p.msg}
                        </div>
                      </div>
                    ))}
                  </div>
                </LaptopFrame>
              </div>

              <Divider />

              {/* How It Works */}
              <div style={{ background: DARK_CARD, border: `1px solid ${BORDER}`, borderRadius: 16, padding: "64px 40px", marginBottom: 0 }}>
                <p style={{ fontSize: 22, color: WHITE, fontWeight: 700, textAlign: "center", marginBottom: 32, fontFamily: "Georgia, serif", letterSpacing: "-0.3px" }}>
                  Your Warm 25 is waiting — 3 steps to find them
                </p>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1px 1fr 1px 1fr", gap: 0, alignItems: "start" }}>
                  {[
                    { step: "01", title: "Request your LinkedIn data", desc: "On LinkedIn: Me → Settings & Privacy → Data Privacy → Request a copy of your data. Select Complete — not Basic — and click Request archive. Basic won't include the data Nugget needs. If you get stuck, search LinkedIn Help for 'download your data'." },
                    { step: "02", title: "Download your file", desc: "Wait for LinkedIn to email your data file — usually within 24 hours. Click the link in that email and download the zip file to your computer." },
                    { step: "03", title: "Drop it in below", desc: "Drag and drop the zip file into Nugget — no need to unzip it. Nugget opens it automatically and generates your Warm 25 and Inner Circle reports." },
                  ].reduce((acc, s, i) => {
                    acc.push(
                      <div key={s.step} style={{ display: "flex", flexDirection: "column", gap: 8, padding: "0 24px" }}>
                        <div style={{ fontSize: 20, fontWeight: 700, color: BLUE_BRIGHT, fontFamily: "Georgia, serif", opacity: 0.5, lineHeight: 1, marginBottom: 4 }}>Step {s.step}</div>
                        <div style={{ fontSize: 15, fontWeight: 700, color: WHITE, marginBottom: 4 }}>{s.title}</div>
                        <div style={{ fontSize: 13, color: MUTED, lineHeight: 1.7 }}>{s.desc}</div>
                      </div>
                    );
                    if (i < 2) acc.push(<div key={`div-${i}`} style={{ width: 1, background: BORDER, alignSelf: "stretch" }} />);
                    return acc;
                  }, [])}
                </div>
              </div>

              {/* Upload Zone */}
              <div ref={uploadRef} style={{ marginTop: 40 }}>
                <div
                  style={{ border: `2px dashed ${dragOver ? BLUE_BRIGHT : BORDER}`, borderRadius: 16, padding: "44px 32px", textAlign: "center", cursor: "pointer", background: dragOver ? BLUE_MID + "11" : DARK_CARD, transition: "all 0.2s", marginBottom: 28 }}
                  onDragOver={e => { e.preventDefault(); setDragOver(true); }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                >
                  <div style={{ fontSize: 36, marginBottom: 14 }}>📂</div>
                  <div style={{ fontSize: 17, color: WHITE, fontWeight: 600, marginBottom: 8 }}>Drop your LinkedIn file here</div>
                  <div style={{ fontSize: 13, color: MUTED, marginBottom: 18, lineHeight: 1.5 }}>
                    Drop the zip file LinkedIn sent you — don't unzip it. Nugget handles everything inside automatically.<br />Or upload individual CSV files if you prefer.
                  </div>
                  <button style={{ padding: "10px 28px", background: `linear-gradient(135deg, ${BLUE_MID}, ${BLUE_BRIGHT})`, color: WHITE, border: "none", borderRadius: 8, fontWeight: 700, fontSize: 14, cursor: "pointer" }}
                    onClick={e => { e.stopPropagation(); fileInputRef.current?.click(); }}>Choose Files</button>
                  <input ref={fileInputRef} type="file" multiple accept=".csv,.zip" style={{ display: "none" }} onChange={e => handleFiles(e.target.files)} />
                  {hasFiles && (
                    <div style={{ marginTop: 20, display: "flex", flexWrap: "wrap", gap: 8, justifyContent: "center" }}>
                      {Object.keys(uploadedFiles).map(k => (
                        <span key={k} style={{ padding: "4px 12px", background: BLUE_MID + "33", border: `1px solid ${BLUE_BRIGHT}44`, borderRadius: 20, fontSize: 12, color: BLUE_BRIGHT }}>✓ {k}</span>
                      ))}
                    </div>
                  )}
                </div>

                {isMissingCriticalFiles && (
                  <div style={{ background: "#1a0e00", border: "1px solid #E8A000", borderRadius: 10, padding: "16px 20px", marginBottom: 20, display: "flex", gap: 14, alignItems: "flex-start" }}>
                    <div style={{ fontSize: 20, flexShrink: 0 }}>⚠️</div>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 700, color: "#E8A000", marginBottom: 6 }}>Looks like you uploaded the Basic export</div>
                      <div style={{ fontSize: 13, color: MUTED, lineHeight: 1.65 }}>Nugget needs your <strong style={{ color: WHITE }}>Complete</strong> LinkedIn export. On LinkedIn: <strong style={{ color: WHITE }}>Me → Settings & Privacy → Data Privacy → Request a copy → select Complete → Request archive.</strong> LinkedIn emails it within 24 hours.</div>
                    </div>
                  </div>
                )}

                {connCount > 0 && (
                  <div style={{ display: "flex", gap: 14, marginBottom: 24 }}>
                    {[
                      { num: connCount.toLocaleString(), label: "Connections loaded" },
                      { num: msgCount.toLocaleString(), label: "Messages loaded" },
                      { num: Object.keys(uploadedFiles).length, label: "Files ready" },
                    ].map((s, i) => (
                      <div key={i} style={{ flex: 1, background: `linear-gradient(135deg, ${BLUE_DEEP}, ${DARK_CARD})`, border: `1px solid ${BORDER}`, borderRadius: 10, padding: "16px 20px", textAlign: "center" }}>
                        <div style={{ fontSize: 26, fontWeight: 700, color: BLUE_BRIGHT, fontFamily: "Georgia, serif" }}>{s.num}</div>
                        <div style={{ fontSize: 11, color: MUTED, textTransform: "uppercase", letterSpacing: "0.06em", marginTop: 4 }}>{s.label}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {error && <div style={{ background: "#1a0a0a", border: "1px solid #8B0000", borderRadius: 8, padding: "12px 16px", color: "#ff8080", fontSize: 13, marginBottom: 16 }}>{error}</div>}

              <Divider />

              {/* Report Cards */}
              <div style={{ marginBottom: 0 }}>
                <div style={{ textAlign: "center", marginBottom: 40 }}>
                  <div style={{ fontSize: 14, color: BLUE_BRIGHT, letterSpacing: "0.06em", textTransform: "uppercase", fontWeight: 700, marginBottom: 18 }}>What You Get</div>
                  <h2 style={{ fontSize: 32, fontFamily: "Georgia, serif", fontWeight: 700, color: WHITE, marginBottom: 24 }}>Two reports. One complete picture<br />of your warm pipeline.</h2>
                  <p style={{ fontSize: 14, color: MUTED, maxWidth: 440, margin: "0 auto" }}>
                    Every lead, every signal, and every next step is unique to you and your network.<br />This is your data. These are your prospects. This is your pipeline.
                  </p>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 14, marginBottom: 24 }}>
                  {REPORTS.map(r => (
                    <div key={r.id} style={{ background: DARK_CARD, border: `1px solid ${BORDER}`, borderRadius: 12, padding: 20, position: "relative", display: "flex", flexDirection: "column" }}>
                      <div style={{ display: "inline-block", padding: "2px 8px", borderRadius: 4, fontSize: 10, fontWeight: 700, letterSpacing: "0.06em", background: BLUE_MID + "33", color: BLUE_BRIGHT, marginBottom: 8 }}>{r.tag}</div>
                      <div style={{ fontSize: 15, fontWeight: 700, color: WHITE, marginBottom: 3, fontFamily: "Georgia, serif" }}>{r.name}</div>
                      <div style={{ fontSize: 11, color: MUTED, marginBottom: 7, textTransform: "uppercase", letterSpacing: "0.05em" }}>{r.subtitle}</div>
                      <div style={{ fontSize: 13, color: MUTED, lineHeight: 1.5, marginBottom: 14, flex: 1 }}>{r.description}</div>
                      {reports[r.id]
                        ? <button style={{ padding: "8px 16px", background: BLUE_MID + "33", border: `1px solid ${BLUE_BRIGHT}`, color: BLUE_BRIGHT, borderRadius: 7, fontSize: 12, fontWeight: 700, cursor: "pointer", width: "100%" }} onClick={() => { setActiveReport(r.id); setStep("reports"); }}>✓ View Report</button>
                        : <button style={{ padding: "8px 16px", background: generating === r.id ? BLUE_MID + "44" : `linear-gradient(135deg, ${BLUE_MID}, ${BLUE_BRIGHT})`, border: "none", color: WHITE, borderRadius: 7, fontSize: 12, fontWeight: 700, cursor: generating ? "not-allowed" : "pointer", width: "100%" }} onClick={() => initiateReport(r.id)} disabled={!!generating}>
                            {generating === r.id ? "⏳ Building your pipeline..." : `Generate ${r.name}`}
                          </button>
                      }
                    </div>
                  ))}
                </div>
              </div>


              {/* Final CTA */}
              <div style={{ textAlign: "center", padding: "40px 24px" }}>
                <h2 style={{ fontSize: 36, fontFamily: "Georgia, serif", fontWeight: 700, color: WHITE, marginBottom: 16, lineHeight: 1.2 }}>
                  Your warmest prospects are already<br />in your network.
                </h2>
                <button style={{ ...primaryBtn, fontSize: 17, padding: "16px 44px", animation: "pulseCTA 2.5s ease-in-out infinite", marginTop: 24 }} onClick={scrollToUpload}>
                  Get My Warm 25 →
                </button>
              </div>

            </div>
          </>
        )}

        {/* ══ REPORTS ══ */}
        {step === "reports" && (
          <div style={{ paddingTop: 32, display: "grid", gridTemplateColumns: "210px 1fr", gap: 22, alignItems: "start" }}>
            {/* Sidebar */}
            <div style={{ background: DARK_CARD, borderRadius: 12, border: `1px solid ${BORDER}`, overflow: "hidden", position: "sticky", top: 80 }}>
              {REPORTS.map(r => {
                let statusText;
                if (generating === r.id) statusText = "⏳ Building pipeline...";
                else if (reports[r.id])  statusText = "✓ Complete";
                else                     statusText = "Not yet generated";
                return (
                  <div key={r.id} style={{ padding: "13px 16px", borderBottom: `1px solid ${BORDER}`, cursor: "pointer", background: activeReport === r.id ? BLUE_MID + "33" : "transparent", borderLeft: `3px solid ${activeReport === r.id ? BLUE_BRIGHT : "transparent"}`, transition: "all 0.15s" }} onClick={() => setActiveReport(r.id)}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: activeReport === r.id ? BLUE_BRIGHT : WHITE, marginBottom: 2 }}>{r.name}</div>
                    <div style={{ fontSize: 11, color: reports[r.id] ? BLUE_BRIGHT : MUTED }}>{statusText}</div>
                  </div>
                );
              })}
              <div style={{ padding: "14px 16px" }}>
                <button style={{ width: "100%", padding: "10px 16px", background: `linear-gradient(135deg, ${BLUE_MID}, ${BLUE_BRIGHT})`, color: WHITE, border: "none", borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: "pointer" }} onClick={() => setStep("upload")}>← Back to Home</button>
              </div>
            </div>

            {/* Report panel */}
            <div style={{ background: DARK_CARD, borderRadius: 12, border: `1px solid ${BORDER}`, padding: 32, minHeight: 420 }}>
              {error && <div style={{ background: "#1a0a0a", border: "1px solid #8B0000", borderRadius: 8, padding: "12px 16px", color: "#ff8080", fontSize: 13, marginBottom: 16 }}>{error}</div>}
              <div style={{ marginBottom: 22, paddingBottom: 16, borderBottom: `1px solid ${BORDER}` }}>
                <div style={{ fontSize: 22, fontFamily: "Georgia, serif", fontWeight: 700, background: `linear-gradient(90deg, ${BLUE_BRIGHT}, ${BLUE_LIGHT})`, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", marginBottom: 4 }}>{activeReportMeta?.name}</div>
                <div style={{ fontSize: 12, color: MUTED }}>{activeReportMeta?.subtitle}</div>
              </div>
              {generating === activeReport ? (
                <div style={{ textAlign: "center", padding: "60px 32px" }}>
                  <div style={{ width: 36, height: 36, border: `3px solid ${BORDER}`, borderTop: `3px solid ${BLUE_BRIGHT}`, borderRadius: "50%", animation: "spin 1s linear infinite", margin: "0 auto 16px" }} />
                  <div style={{ color: MUTED, fontSize: 14 }}>{retryMessage || loadingMsg || "Surfacing your warm pipeline..."}</div>
                </div>
              ) : reports[activeReport] ? (
                <><IntroBlock reportId={activeReport} /><ReportContent text={reports[activeReport]} /></>
              ) : (
                <div style={{ textAlign: "center", padding: "60px 32px" }}>
                  <div style={{ fontSize: 38, marginBottom: 14 }}>📊</div>
                  <div style={{ color: MUTED, fontSize: 14, marginBottom: 20 }}>This report hasn't been generated yet.</div>
                  <button style={{ padding: "10px 24px", background: `linear-gradient(135deg, ${BLUE_MID}, ${BLUE_BRIGHT})`, color: WHITE, border: "none", borderRadius: 8, fontSize: 14, fontWeight: 700, cursor: generating ? "not-allowed" : "pointer" }} onClick={() => initiateReport(activeReport)} disabled={!!generating}>
                    Generate {activeReportMeta?.name}
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      {/* ── Info capture modal ── */}
      {showModal && (
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(2,8,18,0.97)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: 24 }}>
          <div style={{ background: `linear-gradient(160deg, #0f2040 0%, #0a1628 100%)`, border: `1px solid ${BLUE_BRIGHT}66`, borderRadius: 20, padding: "40px 48px", maxWidth: 480, width: "100%", boxShadow: `0 0 80px rgba(65,161,232,0.15), 0 24px 60px rgba(0,0,0,0.8)`, animation: "fadeIn 0.2s ease-out" }}>
            <h2 style={{ fontSize: 22, fontFamily: "Georgia, serif", fontWeight: 700, color: WHITE, textAlign: "center", marginBottom: 8, lineHeight: 1.3 }}>Almost there — where should we send your reports?</h2>
            <p style={{ fontSize: 14, color: MUTED, textAlign: "center", marginBottom: 28, lineHeight: 1.6 }}>Enter your details and we'll get your Warm 25 ready.</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 14, marginBottom: 20 }}>
              <div>
                <label style={{ fontSize: 12, color: MUTED, display: "block", marginBottom: 6, letterSpacing: "0.06em", textTransform: "uppercase" }}>First Name</label>
                <input type="text" placeholder="Your first name" value={userName} onChange={e => setUserName(e.target.value)} style={{ width: "100%", padding: "12px 16px", background: "#0a1628", border: `1px solid ${BLUE_BRIGHT}44`, borderRadius: 8, color: WHITE, fontSize: 15 }} />
              </div>
              <div>
                <label style={{ fontSize: 12, color: MUTED, display: "block", marginBottom: 6, letterSpacing: "0.06em", textTransform: "uppercase" }}>Company</label>
                <input type="text" placeholder="Your company name" value={userCompany} onChange={e => setUserCompany(e.target.value)} style={{ width: "100%", padding: "12px 16px", background: "#0a1628", border: `1px solid ${BLUE_BRIGHT}44`, borderRadius: 8, color: WHITE, fontSize: 15 }} />
              </div>
              <div>
                <label style={{ fontSize: 12, color: MUTED, display: "block", marginBottom: 6, letterSpacing: "0.06em", textTransform: "uppercase" }}>Work Email</label>
                <input type="email" placeholder="you@company.com" value={userEmail} onChange={e => setUserEmail(e.target.value)} onKeyDown={e => e.key === "Enter" && submitModal()} style={{ width: "100%", padding: "12px 16px", background: "#0a1628", border: `1px solid ${BLUE_BRIGHT}44`, borderRadius: 8, color: WHITE, fontSize: 15 }} />
              </div>
            </div>
            <button onClick={submitModal} disabled={modalSubmitting || !userName.trim() || !userEmail.trim()} style={{ width: "100%", padding: "14px 24px", background: `linear-gradient(135deg, ${BLUE_MID}, ${BLUE_BRIGHT})`, border: "none", borderRadius: 10, color: WHITE, fontSize: 16, fontWeight: 700, cursor: modalSubmitting ? "not-allowed" : "pointer", fontFamily: "Georgia, serif", marginBottom: 12, opacity: modalSubmitting ? 0.6 : 1 }}>
              {modalSubmitting ? "Getting your pipeline ready..." : "Show Me My Warm 25 →"}
            </button>
            <p style={{ fontSize: 11, color: MUTED, textAlign: "center" }}>No spam. No sharing. Just your warm lead intelligence.</p>
          </div>
        </div>
      )}

      <footer style={{ borderTop: `1px solid ${BORDER}`, background: DARK_CARD, padding: "20px 40px", textAlign: "center", marginTop: 40 }}>
        <p style={{ fontSize: 12, color: MUTED, margin: 0 }}>
          © 2025 Nugget™ for Sales Teams &nbsp;·&nbsp;
          <a href="/privacy.html" style={{ color: BLUE_BRIGHT, textDecoration: "none" }}>Privacy Policy</a> &nbsp;·&nbsp;
          <a href="/terms.html" style={{ color: BLUE_BRIGHT, textDecoration: "none" }}>Terms of Service</a> &nbsp;·&nbsp;
          <a href="mailto:hello@annaludwinowski.com" style={{ color: BLUE_BRIGHT, textDecoration: "none" }}>hello@annaludwinowski.com</a>
        </p>
      </footer>
    </div>
  );
}
