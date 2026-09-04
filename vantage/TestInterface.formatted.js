import {
  r as i,
  j as e,
  g as Se,
  m as y,
  h as Ce,
  A as z,
  i as Ee,
  p as Te,
  k as ce,
  u as Be,
  n as Le,
  o as Ae,
  a as Ie,
  q as Me,
} from "./index-DFG7jbWJ.js";
import { u as Fe, p as De, v as _e } from "./usePageMeta-D1iZP4bN.js";
import { M as $ } from "./MathText-BSL9sMqo.js";
import { s as de } from "./scoringEngine-Dz6oxfCW.js";
import { T as Pe } from "./topicLabels-BTouzYTL.js";
import "./katex-CjHiWPWQ.js";
function He(a) {
  return a
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/\son\w+="[^"]*"/gi, "")
    .replace(/\son\w+='[^']*'/gi, "");
}
const Oe = {
  render: "Hiển thị lỗi (LaTeX/hình ảnh)",
  answer_key: "Đáp án có vẻ sai",
  ambiguous: "Câu hỏi không rõ nghĩa",
  other: "Khác",
};
function Re({ questionId: a }) {
  const [r, t] = i.useState(!1),
    [o, l] = i.useState("render"),
    [c, x] = i.useState(""),
    [u, b] = i.useState("idle");
  async function g() {
    b("sending");
    try {
      (await Se(a, o, c || void 0), b("sent"));
    } catch {
      b("error");
    }
  }
  return r
    ? u === "sent"
      ? e.jsx("p", {
          className: "font-sans text-[12px] text-[var(--success)] px-1",
          children: "Đã gửi báo cáo — cảm ơn bạn.",
        })
      : e.jsxs("div", {
          className:
            "flex flex-col gap-2 p-3 rounded-xl border border-[var(--border)] bg-[var(--surface-elevated)]",
          children: [
            e.jsx("select", {
              value: o,
              onChange: (f) => l(f.target.value),
              className:
                "font-sans text-[12px] px-2 py-1.5 rounded-lg border border-[var(--border)] bg-[var(--surface)] text-[var(--foreground)]",
              children: Object.entries(Oe).map(([f, v]) =>
                e.jsx("option", { value: f, children: v }, f),
              ),
            }),
            e.jsx("textarea", {
              value: c,
              onChange: (f) => x(f.target.value),
              placeholder: "Mô tả ngắn (không bắt buộc)",
              rows: 2,
              className:
                "font-sans text-[12px] px-2 py-1.5 rounded-lg border border-[var(--border)] bg-[var(--surface)] text-[var(--foreground)] resize-none",
            }),
            e.jsxs("div", {
              className: "flex items-center gap-2",
              children: [
                e.jsx("button", {
                  onClick: g,
                  disabled: u === "sending",
                  className:
                    "px-3 py-1.5 rounded-lg font-sans text-[12px] font-semibold text-[var(--accent-fg)] bg-[var(--accent)] disabled:opacity-50",
                  children: u === "sending" ? "Đang gửi…" : "Gửi báo cáo",
                }),
                e.jsx("button", {
                  onClick: () => t(!1),
                  className:
                    "px-3 py-1.5 rounded-lg font-sans text-[12px] text-[var(--fg-tertiary)]",
                  children: "Hủy",
                }),
                u === "error" &&
                  e.jsx("span", {
                    className:
                      "font-sans text-[11px] text-[var(--destructive)]",
                    children: "Gửi thất bại, thử lại sau.",
                  }),
              ],
            }),
          ],
        })
    : e.jsxs("button", {
        onClick: () => t(!0),
        className:
          "self-start flex items-center gap-2 px-3 py-1.5 rounded-lg font-sans text-[11px] text-[var(--fg-tertiary)] hover:text-[var(--foreground)] transition",
        children: [e.jsx("span", { children: "⚑" }), " Báo lỗi câu hỏi"],
      });
}
function L(a, r = {}) {
  var t;
  try {
    if (typeof window > "u") return;
    if (typeof ((t = window.rybbit) == null ? void 0 : t.event) == "function") {
      window.rybbit.event(a, r);
      return;
    }
    if (typeof window.plausible == "function") {
      window.plausible(a, { props: r });
      return;
    }
  } catch {}
}
const xe = ["A", "B", "C", "D"];
function $e(a, r, t, o) {
  return o
    ? t === null
      ? r === a
        ? {
            bg: "var(--choice-chosen-bg)",
            border: "var(--accent)",
            bw: "1.5px",
            labelBg: "var(--accent)",
            labelText: "var(--accent-fg)",
            text: "var(--accent)",
          }
        : {
            bg: "var(--surface)",
            border: "var(--border)",
            bw: "1px",
            labelBg: "var(--border)",
            labelText: "var(--fg-tertiary)",
            text: "var(--fg-tertiary)",
          }
      : a === t
        ? {
            bg: "var(--primary-subtle)",
            border: "var(--success)",
            bw: "1.5px",
            labelBg: "var(--success)",
            labelText: "var(--primary-fg)",
            text: "var(--success)",
          }
        : a === r
          ? {
              bg: "var(--choice-wrong-bg)",
              border: "var(--destructive)",
              bw: "1.5px",
              labelBg: "var(--destructive)",
              labelText: "#FFFFFF",
              text: "var(--destructive)",
            }
          : {
              bg: "var(--surface)",
              border: "var(--border)",
              bw: "1px",
              labelBg: "var(--border)",
              labelText: "var(--fg-tertiary)",
              text: "var(--fg-tertiary)",
            }
    : r === a
      ? {
          bg: "var(--choice-chosen-bg)",
          border: "var(--accent)",
          bw: "1.5px",
          labelBg: "var(--accent)",
          labelText: "var(--accent-fg)",
          text: "var(--accent)",
        }
      : {
          bg: "var(--surface)",
          border: "var(--border)",
          bw: "1px",
          labelBg: "var(--border)",
          labelText: "var(--fg-secondary)",
          text: "var(--fg-secondary)",
        };
}
function ze({
  question: a,
  chosen: r,
  onAnswer: t,
  practiceMode: o,
  submitted: l,
  wrongStreak: c = 0,
}) {
  var E, F, D;
  const x = o && r !== null && r !== void 0,
    [u, b] = i.useState(!1),
    [g, f] = i.useState(!1),
    [v, C] = i.useState({ status: "idle", result: null }),
    S = a.correct,
    N = r != null && r === S;
  i.useEffect(() => {
    (b(!1), f(!1), C({ status: "idle", result: null }));
  }, [a.id]);
  const K = async () => {
    const p = !g;
    if ((f(p), p && v.status === "idle")) {
      C({ status: "loading", result: null });
      const h = await Ce(a.id);
      C({ status: "done", result: h });
    }
  };
  return e.jsxs("div", {
    children: [
      ((E = a.figure) == null ? void 0 : E.data) &&
        e.jsx("div", {
          className:
            "mb-4 rounded-xl overflow-hidden border border-[var(--border)] bg-[var(--surface)] flex justify-center p-3",
          dangerouslySetInnerHTML: { __html: He(a.figure.data) },
        }),
      a.image &&
        e.jsx("div", {
          className:
            "mb-4 rounded-xl overflow-hidden border border-[var(--border)] bg-[var(--surface)] flex justify-center p-3",
          children: e.jsx("img", {
            src: a.image,
            alt: "",
            className: "max-h-64 w-auto object-contain",
          }),
        }),
      !a.image &&
        a.imageLink &&
        e.jsxs("a", {
          href: a.imageLink,
          target: "_blank",
          rel: "noopener noreferrer",
          className:
            "mb-4 flex items-center gap-2 px-4 py-2.5 rounded-xl border border-[var(--border)] bg-[var(--surface)] font-sans text-[0.8125rem] text-[var(--info)] hover:border-[var(--info)] hover:bg-[var(--surface-elevated)] transition w-fit",
          children: [
            e.jsx("span", { children: "🖼" }),
            e.jsx("span", {
              children: "Xem hình minh họa (nguồn chính thức) →",
            }),
          ],
        }),
      e.jsx($, {
        className:
          "font-sans font-semibold text-[20px] text-[var(--foreground)] leading-relaxed mb-5 whitespace-pre-wrap",
        children: a.question,
      }),
      e.jsx("div", {
        className: "flex flex-col gap-2.5",
        children: a.choices.map((p, h) => {
          const j = $e(h, r, x ? S : null, x),
            W = x
              ? h === S
                ? "z-choice-correct"
                : h === r && h !== S
                  ? "z-choice-wrong"
                  : ""
              : "";
          return e.jsxs(
            y.button,
            {
              className: `w-full text-left flex items-center gap-3.5 px-[18px] py-3.5 rounded-xl transition-all ${W}`,
              style: { background: j.bg, border: `${j.bw} solid ${j.border}` },
              onClick: () => !x && !l && t(h),
              disabled: x || l,
              whileHover: !x && !l ? { scale: 1.01 } : {},
              whileTap: !x && !l ? { scale: 0.98 } : {},
              transition: { type: "spring", stiffness: 400, damping: 25 },
              children: [
                e.jsx("span", {
                  className:
                    "flex-shrink-0 flex items-center justify-center w-7 h-7 rounded-md font-sans text-[0.8125rem] font-bold",
                  style: { background: j.labelBg, color: j.labelText },
                  children: xe[h],
                }),
                e.jsx($, {
                  className: "font-sans text-[15px] font-medium",
                  style: { color: j.text },
                  children: p,
                }),
              ],
            },
            h,
          );
        }),
      }),
      x &&
        e.jsxs("div", {
          className: "mt-5 flex items-start gap-3 p-3.5 rounded-xl",
          style: {
            border: `1px solid ${N ? "var(--primary-border)" : "var(--choice-wrong-border)"}`,
            background: N ? "var(--primary-subtle)" : "var(--choice-wrong-bg)",
          },
          children: [
            e.jsx("span", {
              className: "flex-shrink-0 mt-0.5",
              style: { color: "var(--success)" },
              children: N
                ? e.jsx("svg", {
                    className: "z-checkmark w-5 h-5",
                    viewBox: "0 0 20 20",
                    fill: "none",
                    children: e.jsx("path", {
                      d: "M4 10l4.5 4.5L16 6",
                      stroke: "currentColor",
                      strokeWidth: "2.2",
                      strokeLinecap: "round",
                      strokeLinejoin: "round",
                    }),
                  })
                : e.jsx("span", {
                    className:
                      "text-base leading-none text-[var(--destructive)]",
                    children: "✗",
                  }),
            }),
            e.jsxs("div", {
              className: "flex-1 min-w-0",
              children: [
                !N &&
                  e.jsxs("p", {
                    className:
                      "font-sans text-xs font-semibold text-[var(--destructive)] mb-1",
                    children: ["Đáp án đúng: ", xe[S] ?? "?"],
                  }),
                N &&
                  e.jsx("p", {
                    className:
                      "font-sans text-[0.8125rem] text-[var(--success)]",
                    children: "Đúng rồi.",
                  }),
              ],
            }),
          ],
        }),
      o &&
        !l &&
        x &&
        !N &&
        c >= 2 &&
        e.jsx("div", {
          className: "mt-3 px-4 py-3 rounded-xl glass-base border-info/20",
          children: e.jsx("p", {
            className: "font-sans text-xs text-[var(--info)] leading-relaxed",
            style: { opacity: 0.8 },
            children:
              "Bài này khó với nhiều học sinh. Xem giải thích bên dưới.",
          }),
        }),
      o &&
        !l &&
        x &&
        !N &&
        e.jsxs("div", {
          className: "mt-3 flex flex-col gap-2",
          children: [
            e.jsxs("button", {
              onClick: () => {
                const p = !u;
                (b(p), p && L("explanation_opened", { questionId: a.id }));
              },
              className:
                "self-start flex items-center gap-2 px-4 py-2 rounded-lg border border-[var(--border)] bg-[var(--surface-elevated)] font-sans text-xs text-[var(--muted-fg)] hover:text-[var(--foreground)] hover:border-[var(--primary-border)] transition",
              children: [
                e.jsx("span", { children: "📖" }),
                u ? "Ẩn giải thích" : "Xem giải thích",
              ],
            }),
            u &&
              a.explanation &&
              e.jsx("div", {
                className:
                  "p-3.5 rounded-xl border border-[var(--border)] bg-[var(--surface-elevated)]",
                children: e.jsx($, {
                  className:
                    "font-sans text-[0.8125rem] text-[var(--muted-fg)] leading-relaxed",
                  children: a.explanation,
                }),
              }),
          ],
        }),
      o &&
        e.jsxs("div", {
          className: "mt-3 flex flex-col gap-2",
          children: [
            e.jsxs("button", {
              onClick: K,
              className:
                "self-start flex items-center gap-2 px-4 py-2 rounded-lg border border-[var(--border)] bg-[var(--surface-elevated)] font-sans text-xs text-[var(--muted-fg)] hover:text-[var(--foreground)] hover:border-[var(--primary-border)] transition",
              children: [
                e.jsx("span", { children: "🧮" }),
                g ? "Ẩn các bước giải" : "Xem các bước giải",
              ],
            }),
            g &&
              v.status === "loading" &&
              e.jsx("p", {
                className: "font-sans text-xs text-[var(--muted-fg)]",
                children: "Đang tạo lời giải…",
              }),
            g &&
              v.status === "done" &&
              !((F = v.result) != null && F.available) &&
              e.jsx("p", {
                className: "font-sans text-xs text-[var(--fg-tertiary)]",
                children: "Câu này chưa có lời giải từng bước.",
              }),
            g &&
              v.status === "done" &&
              ((D = v.result) == null ? void 0 : D.available) &&
              e.jsx("div", {
                className: "flex flex-col gap-2",
                children: v.result.steps.map((p, h) =>
                  e.jsxs(
                    "div",
                    {
                      className:
                        "p-3.5 rounded-xl border border-[var(--border)] bg-[var(--surface-elevated)] flex flex-col gap-1.5",
                      children: [
                        e.jsx($, {
                          className:
                            "font-sans text-[0.8125rem] text-[var(--foreground)]",
                          children: `$${p.before}$ $\\Rightarrow$ $${p.after}$`,
                        }),
                        p.caption &&
                          e.jsx("p", {
                            className:
                              "font-sans text-[0.6875rem] text-[var(--muted-fg)]",
                            children: p.caption,
                          }),
                      ],
                    },
                    h,
                  ),
                ),
              }),
          ],
        }),
      e.jsx("div", {
        className: "mt-3",
        children: e.jsx(Re, { questionId: a.id }),
      }),
    ],
  });
}
const Ke = i.memo(
    ze,
    (a, r) =>
      a.question.id === r.question.id &&
      a.chosen === r.chosen &&
      a.practiceMode === r.practiceMode &&
      a.submitted === r.submitted,
  ),
  Y = 20,
  ue = 2 * Math.PI * Y;
function We({ timeLeft: a, totalTime: r }) {
  const t = Math.floor(a / 60),
    o = a % 60,
    l = r > 0 ? a / r : 1,
    c = Math.max(0, Math.min(1, l)),
    x = ue * (1 - c),
    u =
      a > 30
        ? "var(--success)"
        : a > 10
          ? "var(--accent)"
          : "var(--destructive)",
    b = a <= 10 && a > 0;
  return e.jsxs(y.div, {
    className:
      "flex items-center gap-2 px-3 py-1.5 bg-[var(--surface)] border border-[var(--border)] rounded-lg",
    animate: b ? { scale: [1, 1.05, 1] } : { scale: 1 },
    transition: b ? { duration: 1, repeat: 1 / 0, ease: "easeInOut" } : {},
    children: [
      e.jsxs("svg", {
        width: "44",
        height: "44",
        viewBox: "0 0 44 44",
        className: "flex-shrink-0 -rotate-90",
        children: [
          e.jsx("circle", {
            cx: "22",
            cy: "22",
            r: Y,
            fill: "none",
            stroke: "var(--border)",
            strokeWidth: "3",
          }),
          e.jsx("circle", {
            cx: "22",
            cy: "22",
            r: Y,
            fill: "none",
            stroke: u,
            strokeWidth: "3",
            strokeLinecap: "round",
            strokeDasharray: ue,
            strokeDashoffset: x,
            style: {
              transition: "stroke-dashoffset 0.9s linear, stroke 0.4s ease",
            },
          }),
        ],
      }),
      e.jsxs("span", {
        className: "font-bold text-[15px] tabular-nums",
        style: {
          fontFamily: "'JetBrains Mono', monospace",
          color: u,
          transition: "color 0.4s ease",
        },
        children: [String(t).padStart(2, "0"), ":", String(o).padStart(2, "0")],
      }),
    ],
  });
}
const fe = [
  {
    label: "Lượng giác",
    formulas: [
      { label: "sin(A±B)", text: "sin(A±B) = sinA·cosB ± cosA·sinB" },
      { label: "cos(A±B)", text: "cos(A±B) = cosA·cosB ∓ sinA·sinB" },
      { label: "Hạ bậc sin²", text: "sin²x = (1 − cos2x) / 2" },
      { label: "Hạ bậc cos²", text: "cos²x = (1 + cos2x) / 2" },
      { label: "sin²+cos²", text: "sin²x + cos²x = 1" },
    ],
  },
  {
    label: "Logarit",
    formulas: [
      { label: "Đổi cơ số", text: "logₐb = ln b / ln a" },
      { label: "logₐ(mn)", text: "logₐ(mn) = logₐm + logₐn" },
      { label: "logₐ(m/n)", text: "logₐ(m/n) = logₐm − logₐn" },
      { label: "logₐ(mⁿ)", text: "logₐ(mⁿ) = n · logₐm" },
    ],
  },
  {
    label: "Hình học",
    formulas: [
      { label: "Diện tích tam giác", text: "S = (1/2) · a · h" },
      { label: "Định lý cosin", text: "a² = b² + c² − 2bc·cosA" },
      { label: "Diện tích hình tròn", text: "S = πr²" },
      { label: "Chu vi hình tròn", text: "C = 2πr" },
    ],
  },
  {
    label: "Đại số",
    formulas: [
      { label: "(a+b)²", text: "(a+b)² = a² + 2ab + b²" },
      { label: "(a−b)²", text: "(a−b)² = a² − 2ab + b²" },
      { label: "a²−b²", text: "a² − b² = (a+b)(a−b)" },
      { label: "Nghiệm bậc 2", text: "x = (−b ± √(b²−4ac)) / 2a" },
    ],
  },
  {
    label: "Giải tích",
    formulas: [
      { label: "(xⁿ)'", text: "(xⁿ)' = n·xⁿ⁻¹" },
      { label: "(√x)'", text: "(√x)' = 1 / (2√x)" },
      { label: "(eˣ)'", text: "(eˣ)' = eˣ" },
      { label: "(ln x)'", text: "(ln x)' = 1/x" },
      { label: "(sin x)'", text: "(sin x)' = cos x" },
      { label: "(cos x)'", text: "(cos x)' = −sin x" },
      { label: "∫xⁿ dx", text: "∫xⁿ dx = xⁿ⁺¹/(n+1) + C" },
    ],
  },
  {
    label: "Tổ hợp",
    formulas: [
      { label: "Hoán vị", text: "Pₙ = n!" },
      { label: "Chỉnh hợp", text: "Aₙᵏ = n! / (n−k)!" },
      { label: "Tổ hợp", text: "Cₙᵏ = n! / (k!·(n−k)!)" },
      { label: "Xác suất", text: "P(A) = m / n" },
      { label: "Nhị thức", text: "(a+b)ⁿ = Σ Cₙᵏ·aⁿ⁻ᵏ·bᵏ" },
    ],
  },
  {
    label: "Dãy số",
    formulas: [
      { label: "CSC — uₙ", text: "uₙ = u₁ + (n−1)·d" },
      { label: "CSC — Sₙ", text: "Sₙ = n·(u₁ + uₙ) / 2" },
      { label: "CSN — uₙ", text: "uₙ = u₁·qⁿ⁻¹" },
      { label: "CSN — Sₙ", text: "Sₙ = u₁·(qⁿ − 1) / (q − 1)" },
      { label: "Tổng ∞ CSN", text: "S∞ = u₁ / (1 − q),  |q| < 1" },
    ],
  },
];
function Ge() {
  const [a, r] = i.useState(!1),
    [t, o] = i.useState(0);
  return e.jsxs(e.Fragment, {
    children: [
      e.jsx("button", {
        onClick: () => r((l) => !l),
        className:
          "flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-sans text-xs text-dim border border-border hover:text-muted hover:border-border-subtle transition",
        children: "📋 Công thức",
      }),
      e.jsx(z, {
        children:
          a &&
          e.jsxs(e.Fragment, {
            children: [
              e.jsx(y.div, {
                className: "fixed inset-0 z-40",
                initial: { opacity: 0 },
                animate: { opacity: 1 },
                exit: { opacity: 0 },
                onClick: () => r(!1),
              }),
              e.jsxs(y.div, {
                className:
                  "fixed bottom-0 left-0 right-0 z-50 bg-surface border-t border-border rounded-t-2xl px-4 pt-4 pb-8 max-h-[60vh] flex flex-col gap-3",
                initial: { y: "100%" },
                animate: { y: 0 },
                exit: { y: "100%" },
                transition: { type: "spring", stiffness: 400, damping: 40 },
                drag: "y",
                dragConstraints: { top: 0 },
                dragElastic: { top: 0.05, bottom: 0.2 },
                onDragEnd: (l, c) => {
                  c.offset.y > 80 && r(!1);
                },
                children: [
                  e.jsxs("div", {
                    className: "flex items-center justify-between mb-1",
                    children: [
                      e.jsx("span", {
                        className:
                          "font-sans text-[0.8125rem] font-semibold text-foreground",
                        children: "Bảng công thức",
                      }),
                      e.jsx("button", {
                        onClick: () => r(!1),
                        className:
                          "text-faint hover:text-muted text-lg leading-none",
                        children: "✕",
                      }),
                    ],
                  }),
                  e.jsx("div", {
                    className: "flex gap-2 overflow-x-auto pb-1",
                    children: fe.map((l, c) =>
                      e.jsx(
                        "button",
                        {
                          onClick: () => o(c),
                          className:
                            "flex-shrink-0 px-3 py-1.5 rounded-lg font-sans text-xs font-medium transition",
                          style:
                            t === c
                              ? {
                                  background: "var(--primary)",
                                  color: "var(--primary-fg)",
                                }
                              : { color: "#64748B" },
                          children: l.label,
                        },
                        c,
                      ),
                    ),
                  }),
                  e.jsx("div", {
                    className: "overflow-y-auto flex flex-col gap-2",
                    children: fe[t].formulas.map((l, c) =>
                      e.jsxs(
                        "div",
                        {
                          className:
                            "flex items-start gap-3 px-4 py-3 rounded-xl bg-surface",
                          children: [
                            e.jsx("span", {
                              className:
                                "font-sans text-[0.6875rem] text-faint pt-0.5 flex-shrink-0 w-28",
                              children: l.label,
                            }),
                            e.jsx("span", {
                              className:
                                "font-mono text-[0.8125rem] text-foreground",
                              children: l.text,
                            }),
                          ],
                        },
                        c,
                      ),
                    ),
                  }),
                ],
              }),
            ],
          }),
      }),
    ],
  });
}
const Ue = {
  ai_review: "AI đang rà soát",
  identity_plus_ai: "Xác minh danh tính + AI",
  human_escalation: "Giám sát viên trực tiếp",
};
function Xe({
  examId: a,
  stakesTier: r = "low",
  tabSwitchCount: t = 0,
  devToolsOpen: o = !1,
}) {
  const { isOrgSession: l } = Ee(),
    [c, x] = i.useState(null),
    u = i.useRef(0),
    b = i.useRef(!1);
  return (
    i.useEffect(() => {
      if (!l) return;
      let g = !1;
      return (
        Te(a, r)
          .then((f) => {
            !g && f.tier !== "none" && x(f);
          })
          .catch(() => {}),
        () => {
          g = !0;
        }
      );
    }, [l, a, r]),
    i.useEffect(() => {
      !c ||
        t <= u.current ||
        ((u.current = t),
        ce(c.id, {
          type: "tab_switch",
          severity: t >= 3 ? "high" : "medium",
          count: t,
        }).catch(() => {}));
    }, [c, t]),
    i.useEffect(() => {
      !c ||
        !o ||
        b.current ||
        ((b.current = !0),
        ce(c.id, { type: "devtools_open", severity: "high" }).catch(() => {}));
    }, [c, o]),
    c
      ? e.jsxs("div", {
          className:
            "fixed top-14 right-3 z-30 flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-[var(--border)] bg-[var(--surface-elevated)]",
          title: "Bài thi này đang được tổ chức của bạn giám sát",
          children: [
            e.jsx("span", {
              className:
                "w-1.5 h-1.5 rounded-full bg-[var(--primary)] animate-pulse",
            }),
            e.jsx("span", {
              className: "font-sans text-[10px] font-medium text-dim",
              children: Ue[c.tier] ?? "Giám sát",
            }),
          ],
        })
      : null
  );
}
const Qe = { easy: "Dễ", medium: "Trung bình", hard: "Khó" },
  me = "kb_hint_seen";
function tt() {
  var ne, ie, oe;
  Fe("Đang thi", { noindex: !0 });
  const a = Be(),
    { examId: r } = Le(),
    t = Ae(),
    o = Ie(),
    [l, c] = i.useState(0),
    [x, u] = i.useState(!1),
    [b, g] = i.useState(!1),
    [f, v] = i.useState(!1),
    [C, S] = i.useState(!1),
    [N, K] = i.useState(() => !sessionStorage.getItem(me)),
    [E, F] = i.useState(0),
    [D, p] = i.useState(!1),
    [h, j] = i.useState(!1),
    _ = i.useRef(null),
    [W, Z] = i.useState(!1),
    [G, pe] = i.useState(!1),
    P = i.useRef(Date.now());
  function H(s) {
    const d = Math.round((Date.now() - P.current) / 1e3);
    (s && d > 0 && o({ type: "RECORD_TIME", questionId: s, seconds: d }),
      (P.current = Date.now()));
  }
  (i.useEffect(() => {
    (t.status === "idle" || !t.exam || t.exam.id !== r) &&
      a("/exams", { replace: !0 });
  }, [t.status, t.exam, r, a]),
    i.useEffect(() => {
      var s;
      ((s = t.exam) == null ? void 0 : s.id) === r &&
        t.status === "active" &&
        L("exam_started", { examId: r, mode: t.mode });
    }, [(ne = t.exam) == null ? void 0 : ne.id, r, t.mode]),
    i.useEffect(() => {
      if (t.mode !== "timed" || t.status !== "active") return;
      const s = setInterval(() => o({ type: "TICK" }), 1e3);
      return () => clearInterval(s);
    }, [t.mode, t.status, o]),
    i.useEffect(() => {
      if (t.status === "timeout") {
        const s = de(t);
        (o({ type: "SUBMIT" }),
          a("/results/current", { replace: !0, state: { result: s } }));
      }
    }, [t.status, o, a]),
    i.useEffect(() => {
      !r ||
        !t.answers ||
        t.status !== "active" ||
        sessionStorage.setItem(
          `exam-draft-${r}`,
          JSON.stringify({
            examId: r,
            answers: t.answers,
            startedAt: t.startedAt ?? new Date().toISOString(),
            mode: t.mode,
          }),
        );
    }, [r, t.answers, t.status]),
    i.useEffect(() => {
      function s() {
        document.hidden &&
          t.status === "active" &&
          (F((d) => d + 1),
          Z(!0),
          t.mode === "timed" &&
            (o({ type: "PAUSE" }),
            v(!0),
            L("exam_paused", {
              examId: r,
              elapsedMs: Date.now() - P.current,
            })));
      }
      return (
        document.addEventListener("visibilitychange", s),
        () => document.removeEventListener("visibilitychange", s)
      );
    }, [t.mode, t.status, o]),
    i.useEffect(() => {
      if (t.status !== "active" || t.mode !== "timed") return;
      const s = (m) => {
          (m.preventDefault(), m.stopPropagation());
        },
        d = (m) => {
          var O;
          (m.key === "PrintScreen" &&
            (m.preventDefault(),
            (O = navigator.clipboard) == null ||
              O.writeText("").catch(() => {})),
            (m.ctrlKey || m.metaKey) &&
              ["a", "u", "s", "p"].includes(m.key.toLowerCase()) &&
              m.preventDefault());
        };
      return (
        document.addEventListener("copy", s),
        document.addEventListener("cut", s),
        document.addEventListener("contextmenu", s),
        window.addEventListener("keydown", d),
        () => {
          (document.removeEventListener("copy", s),
            document.removeEventListener("cut", s),
            document.removeEventListener("contextmenu", s),
            window.removeEventListener("keydown", d));
        }
      );
    }, [t.status, t.mode]),
    i.useEffect(() => {
      if (t.status !== "active" || t.mode !== "timed") return;
      const s = setInterval(() => {
        const m =
          window.outerWidth - window.innerWidth > 160 ||
          window.outerHeight - window.innerHeight > 160;
        pe(m);
      }, 1e3);
      return () => clearInterval(s);
    }, [t.status, t.mode]),
    i.useEffect(() => {
      function s() {
        S(!!document.fullscreenElement);
      }
      return (
        document.addEventListener("fullscreenchange", s),
        () => document.removeEventListener("fullscreenchange", s)
      );
    }, []));
  const { questions: w, answers: U, mode: T, timeLeft: k, exam: B } = t,
    n = w[l];
  i.useEffect(() => {
    const s = (n == null ? void 0 : n.difficulty) ?? null;
    if (_.current !== null && _.current !== s) {
      p(!0);
      const d = setTimeout(() => p(!1), 700);
      return () => clearTimeout(d);
    }
    _.current = s;
  }, [n == null ? void 0 : n.id]);
  const A = i.useCallback(
    (s) => {
      n &&
        (o({ type: "ANSWER_QUESTION", questionId: n.id, choiceIndex: s }),
        L("question_answered", { questionId: n.id, topic: n.topic }));
    },
    [o, n],
  );
  (i.useEffect(() => {
    if (t.status !== "active" || x || f) return;
    function s(d) {
      const m = d.target.tagName;
      if (!(m === "INPUT" || m === "TEXTAREA"))
        switch (d.key) {
          case "a":
          case "A":
            A(0);
            break;
          case "b":
          case "B":
            A(1);
            break;
          case "c":
          case "C":
            A(2);
            break;
          case "d":
          case "D":
            A(3);
            break;
          case "ArrowRight":
            ae();
            break;
          case "ArrowLeft":
            re();
            break;
          case "f":
          case "F":
            n && o({ type: "TOGGLE_FLAG", questionId: n.id });
            break;
        }
    }
    return (
      window.addEventListener("keydown", s),
      () => window.removeEventListener("keydown", s)
    );
  }, [t.status, x, f, A, l]),
    i.useEffect(() => {
      if (T !== "practice" || t.status !== "active") return;
      window.history.pushState(null, "", window.location.href);
      function s() {
        (window.history.pushState(null, "", window.location.href), j(!0));
      }
      return (
        window.addEventListener("popstate", s),
        () => window.removeEventListener("popstate", s)
      );
    }, [T, t.status]));
  const { flags: X, toggleFlag: be } = Me();
  if (t.status === "idle" || !t.exam) return null;
  const q = U[n == null ? void 0 : n.id] ?? null,
    ee = l === w.length - 1,
    I = T === "practice",
    he = ((l + 1) / w.length) * 100,
    M = X[n == null ? void 0 : n.id] ?? !1,
    Q = w.map((s, d) => ({ q: s, i: d })).filter(({ q: s }) => X[s.id]),
    V = w
      .map((s, d) => ({ q: s, i: d }))
      .filter(({ q: s }) => U[s.id] === void 0),
    te = V.length === 0,
    se = t.mode === "timed" && k !== null && k < 300;
  function ge(s) {
    (o({ type: "ANSWER_QUESTION", questionId: n.id, choiceIndex: s }),
      L("question_answered", { questionId: n.id, topic: n.topic }));
  }
  function ae() {
    l < w.length - 1 && (H(n == null ? void 0 : n.id), c((s) => s + 1));
  }
  function re() {
    l > 0 && (H(n == null ? void 0 : n.id), c((s) => s - 1));
  }
  function J(s) {
    (H(n == null ? void 0 : n.id), c(s));
  }
  function ve() {
    u(!0);
  }
  function ye() {
    if (b) return;
    (g(!0),
      H(n == null ? void 0 : n.id),
      sessionStorage.removeItem(`exam-draft-${r}`));
    const s = de(t);
    (o({ type: "SUBMIT" }),
      L("exam_submitted", {
        examId: r,
        score: s == null ? void 0 : s.score,
        durationMs:
          Date.now() - (t.startedAt ? Date.parse(t.startedAt) : Date.now()),
      }),
      _e(a, "/results/current", {
        replace: !0,
        state: { result: s, tab_switches: E, devtools_detected: G ? 1 : 0 },
      }));
  }
  function je() {
    (o({ type: "RESUME" }), v(!1), (P.current = Date.now()));
  }
  function we() {
    document.fullscreenElement
      ? document.exitFullscreen()
      : document.documentElement.requestFullscreen();
  }
  function Ne() {
    (sessionStorage.setItem(me, "1"), K(!1));
  }
  const ke = I ? q !== null : !0;
  return e.jsxs(y.div, {
    variants: De,
    initial: "hidden",
    animate: "show",
    exit: "exit",
    className: "min-h-screen bg-surface flex flex-col relative overflow-hidden",
    children: [
      e.jsx("div", {
        className:
          "absolute top-0 left-0 right-0 h-0.5 pointer-events-none bg-[var(--primary-border)]",
      }),
      T === "timed" &&
        e.jsx(Xe, {
          examId: r,
          stakesTier: (B == null ? void 0 : B.stakesTier) ?? "low",
          tabSwitchCount: E,
          devToolsOpen: G,
        }),
      e.jsxs("nav", {
        className:
          "relative z-10 flex items-center justify-between px-6 border-b border-[var(--border)] bg-[var(--bg)]",
        style: { height: 64 },
        children: [
          e.jsxs("div", {
            className: "flex items-center gap-2",
            children: [
              e.jsxs("span", {
                className:
                  "font-sans font-semibold text-foreground text-[15px]",
                children: ["Câu ", l + 1],
              }),
              e.jsxs("span", {
                className: "font-sans text-dim text-sm",
                children: ["/ ", w.length],
              }),
            ],
          }),
          e.jsx("span", {
            className:
              "font-sans text-muted text-sm font-medium truncate max-w-xs hidden sm:block",
            children: B == null ? void 0 : B.title,
          }),
          e.jsxs("div", {
            className: "flex items-center gap-3",
            children: [
              T === "timed" &&
                k !== null &&
                e.jsxs("div", {
                  className: "relative",
                  children: [
                    e.jsx("div", {
                      "aria-hidden": "true",
                      style: {
                        position: "absolute",
                        inset: -12,
                        borderRadius: "50%",
                        background:
                          "radial-gradient(circle, rgba(76,59,140,0.15) 0%, transparent 70%)",
                        animation: "breathe 4s ease-in-out infinite",
                        pointerEvents: "none",
                      },
                    }),
                    e.jsx(y.div, {
                      animate: se
                        ? {
                            boxShadow: [
                              "0 0 0 0 rgba(194,65,12,0.25)",
                              "0 0 0 8px rgba(194,65,12,0)",
                            ],
                          }
                        : {},
                      transition: se ? { duration: 1.2, repeat: 1 / 0 } : {},
                      className: "rounded-lg relative z-10",
                      children: e.jsx(We, {
                        timeLeft: k,
                        totalTime:
                          (((ie = t.exam) == null ? void 0 : ie.duration) ??
                            0) * 60,
                      }),
                    }),
                  ],
                }),
              e.jsx("button", {
                onClick: we,
                title: C ? "Thoát toàn màn hình" : "Toàn màn hình",
                className:
                  "p-2 rounded-lg text-dim hover:text-foreground hover:bg-surface transition",
                children: C
                  ? e.jsx("svg", {
                      width: "14",
                      height: "14",
                      viewBox: "0 0 14 14",
                      fill: "none",
                      children: e.jsx("path", {
                        d: "M5 1H1v4M9 1h4v4M5 13H1V9M9 13h4V9",
                        stroke: "currentColor",
                        strokeWidth: "1.5",
                        strokeLinecap: "round",
                      }),
                    })
                  : e.jsx("svg", {
                      width: "14",
                      height: "14",
                      viewBox: "0 0 14 14",
                      fill: "none",
                      children: e.jsx("path", {
                        d: "M1 5V1h4M9 1h4v4M1 9v4h4M13 9v4H9",
                        stroke: "currentColor",
                        strokeWidth: "1.5",
                        strokeLinecap: "round",
                      }),
                    }),
              }),
            ],
          }),
        ],
      }),
      e.jsxs("div", {
        className: "relative z-10",
        children: [
          e.jsx("div", {
            className: "h-1 bg-surface",
            children: e.jsx(y.div, {
              className: "h-full",
              style: { background: "var(--primary)" },
              animate: { width: `${he}%` },
              transition: { duration: 0.3, ease: "easeOut" },
            }),
          }),
          T === "timed" &&
            k !== null &&
            e.jsx("div", {
              className: "h-1 md:hidden transition-colors duration-500",
              style: {
                background:
                  k < 60
                    ? "var(--destructive)"
                    : k < 300
                      ? "var(--accent)"
                      : "var(--primary)",
                width: `${Math.max(0, (k / ((((oe = t.exam) == null ? void 0 : oe.duration) ?? 45) * 60)) * 100)}%`,
              },
            }),
        ],
      }),
      e.jsxs("div", {
        className:
          "relative z-10 flex-1 max-w-3xl mx-auto w-full px-4 pt-6 pb-0 md:py-10 flex flex-col gap-6 md:gap-8 exam-content overflow-y-auto md:overflow-visible",
        children: [
          e.jsx(z, {
            children:
              N &&
              e.jsxs(y.div, {
                initial: { opacity: 0 },
                animate: { opacity: 1 },
                exit: { opacity: 0 },
                transition: { duration: 0.2 },
                className:
                  "flex items-center justify-between gap-3 px-4 py-2.5 rounded-xl border border-surface glass-base",
                children: [
                  e.jsxs("span", {
                    className: "font-sans text-[12px] text-dim",
                    children: [
                      "⌨ ",
                      e.jsx("span", {
                        className: "text-dim",
                        children: "A · B · C · D",
                      }),
                      " chọn đáp án  · ",
                      e.jsx("span", { className: "text-dim", children: "← →" }),
                      " chuyển câu  · ",
                      e.jsx("span", { className: "text-dim", children: "F" }),
                      " đánh dấu",
                    ],
                  }),
                  e.jsx("button", {
                    onClick: Ne,
                    className: "text-dim hover:text-dim text-base leading-none",
                    children: "×",
                  }),
                ],
              }),
          }),
          W &&
            e.jsxs("div", {
              className:
                "flex items-center justify-between gap-3 px-4 py-2.5 rounded-xl border border-primary/20 glass-base",
              children: [
                e.jsxs("span", {
                  className: "font-sans text-[12px] text-muted",
                  children: [
                    "Bạn đã rời khỏi trang ",
                    e.jsx("strong", {
                      className: "text-[var(--accent)]",
                      children: E,
                    }),
                    " lần trong khi làm bài.",
                  ],
                }),
                e.jsx("button", {
                  onClick: () => Z(!1),
                  className: "text-dim hover:text-muted text-base leading-none",
                  children: "×",
                }),
              ],
            }),
          e.jsxs("div", {
            className: "flex items-center gap-2",
            children: [
              (n == null ? void 0 : n.topic) &&
                e.jsx("span", {
                  className:
                    "px-2.5 py-1 bg-surface text-primary font-sans text-[11px] font-semibold rounded-md tracking-[0.5px]",
                  children: Pe[n.topic] ?? n.topic,
                }),
              e.jsxs("div", {
                className: "relative",
                children: [
                  D &&
                    e.jsx(y.div, {
                      className:
                        "absolute inset-0 rounded-md pointer-events-none",
                      initial: { opacity: 0.8, scale: 1 },
                      animate: { opacity: 0, scale: 2.2 },
                      transition: { duration: 0.6, ease: "easeOut" },
                      style: {
                        background:
                          "radial-gradient(circle, rgba(76,59,140,0.15) 0%, transparent 70%)",
                      },
                    }),
                  e.jsx("span", {
                    className:
                      "px-2.5 py-1 bg-surface border border-surface text-dim font-sans text-[11px] font-medium rounded-md block",
                    children:
                      Qe[n == null ? void 0 : n.difficulty] ?? "Trung bình",
                  }),
                ],
              }),
              e.jsxs("button", {
                onClick: () => be(n.id),
                title: M ? "Bỏ đánh dấu" : "Đánh dấu câu này",
                className:
                  "ml-auto flex items-center gap-1.5 px-2.5 py-1 rounded-md font-sans text-[11px] font-semibold transition",
                style: {
                  background: M ? "rgba(220,38,38,0.1)" : "var(--surface)",
                  border: `1px solid ${M ? "var(--destructive)" : "var(--border)"}`,
                  color: M ? "var(--destructive)" : "var(--fg-secondary)",
                },
                children: [
                  e.jsx("svg", {
                    width: "11",
                    height: "13",
                    viewBox: "0 0 11 13",
                    fill: "none",
                    children: e.jsx("path", {
                      d: "M1 1v11M1 1h7.5l-2 3.5 2 3.5H1",
                      stroke: "currentColor",
                      strokeWidth: "1.5",
                      strokeLinecap: "round",
                      strokeLinejoin: "round",
                    }),
                  }),
                  M ? "Đã đánh dấu" : "Đánh dấu",
                ],
              }),
            ],
          }),
          e.jsx(z, {
            mode: "wait",
            children:
              n &&
              e.jsx(
                y.div,
                {
                  initial: { opacity: 0 },
                  animate: { opacity: 1 },
                  exit: { opacity: 0 },
                  transition: { duration: 0.15 },
                  className: "relative",
                  children: e.jsx(Ke, {
                    question: n,
                    chosen: q,
                    onAnswer: ge,
                    practiceMode: I,
                    submitted: t.status === "submitted",
                  }),
                },
                n.id,
              ),
          }),
          e.jsxs("div", {
            className:
              "flex items-center justify-between sticky bottom-0 md:static z-20 bg-surface md:bg-transparent py-3 md:py-0 -mx-4 md:mx-0 px-4 md:px-0 border-t border-surface md:border-none",
            children: [
              e.jsxs("div", {
                className: "flex items-center gap-2",
                children: [
                  e.jsx("button", {
                    onClick: re,
                    disabled: l === 0,
                    className:
                      "flex items-center gap-1.5 px-4 py-3 md:py-2.5 bg-surface border border-surface rounded-[10px] font-sans text-[13px] text-muted font-medium disabled:opacity-40 hover:bg-surface transition",
                    children: "← Câu trước",
                  }),
                  I && e.jsx(Ge, {}),
                ],
              }),
              e.jsxs("div", {
                className: "flex items-center gap-2.5",
                children: [
                  !ee &&
                    e.jsx("button", {
                      onClick: ae,
                      disabled: I && !ke,
                      className:
                        "flex items-center gap-1.5 px-5 py-3 md:py-2.5 bg-surface rounded-[10px] font-sans text-[13px] text-foreground font-semibold disabled:opacity-40 hover:bg-surface-elevated transition",
                      children: "Tiếp theo →",
                    }),
                  (ee || !I) &&
                    e.jsx("button", {
                      onClick: ve,
                      className:
                        "flex items-center gap-1.5 px-5 py-3 md:py-2.5 rounded-[10px] font-sans text-[13px] text-background font-bold hover:opacity-90 transition",
                      style: { background: "var(--primary)" },
                      children: "Nộp bài",
                    }),
                ],
              }),
            ],
          }),
          e.jsx("div", {
            className: "flex items-center justify-center gap-1.5 flex-wrap",
            children: w.map((s, d) => {
              const m = U[s.id] !== void 0,
                O = X[s.id],
                le = d === l;
              let R = "var(--border)";
              return (
                le
                  ? (R = "var(--accent)")
                  : O
                    ? (R = "var(--destructive)")
                    : m && (R = "var(--success)"),
                e.jsx(
                  "button",
                  {
                    onClick: () => J(d),
                    className: "rounded-[2px] h-1 transition-all",
                    style: { width: le ? 24 : 8, background: R },
                  },
                  d,
                )
              );
            }),
          }),
        ],
      }),
      G &&
        t.status === "active" &&
        e.jsx("div", {
          className:
            "fixed inset-0 z-40 flex items-center justify-center p-4 pointer-events-none",
          children: e.jsx("div", {
            className:
              "px-6 py-4 rounded-xl border border-primary/20 glass-base pointer-events-auto",
            children: e.jsx("p", {
              className:
                "font-sans text-[13px] text-[var(--accent)] text-center",
              children: "Vui lòng đóng DevTools để tiếp tục làm bài.",
            }),
          }),
        }),
      e.jsx(z, {
        children:
          f &&
          e.jsx(y.div, {
            initial: { opacity: 0 },
            animate: { opacity: 1 },
            exit: { opacity: 0 },
            className:
              "fixed inset-0 z-50 flex items-center justify-center p-4",
            style: {
              background: "rgba(0,0,0,0.6)",
              backdropFilter: "blur(4px)",
            },
            children: e.jsxs("div", {
              className: "flex flex-col items-center gap-6 text-center",
              children: [
                e.jsx("span", {
                  className: "font-sans text-[22px] font-bold text-foreground",
                  children: "Bài thi đã tạm dừng",
                }),
                e.jsx("p", {
                  className: "font-sans text-[14px] text-dim",
                  children: "Bạn đã rời khỏi tab — bộ đếm giờ đã dừng.",
                }),
                e.jsx("button", {
                  onClick: je,
                  className:
                    "px-8 py-3 rounded-xl font-sans text-[14px] font-bold text-background hover:opacity-90 transition bg-primary",
                  children: "Tiếp tục thi",
                }),
              ],
            }),
          }),
      }),
      x &&
        e.jsx("div", {
          className: "fixed inset-0 z-50 flex items-center justify-center p-4",
          style: {
            background: "rgba(0,0,0,0.55)",
            backdropFilter: "blur(4px)",
          },
          children: e.jsxs("div", {
            className:
              "relative w-full max-w-sm rounded-2xl border border-surface p-6 flex flex-col gap-5",
            style: { background: "var(--surface-elevated)" },
            children: [
              e.jsx("div", {
                className: "flex flex-col gap-1",
                children: te
                  ? e.jsxs(e.Fragment, {
                      children: [
                        e.jsx("span", {
                          className:
                            "font-sans text-foreground text-[18px] font-semibold",
                          children: "Nộp bài?",
                        }),
                        e.jsxs("span", {
                          className: "font-sans text-dim text-[13px]",
                          children: [
                            "Bạn đã trả lời đủ ",
                            w.length,
                            "/",
                            w.length,
                            " câu.",
                          ],
                        }),
                      ],
                    })
                  : e.jsxs(e.Fragment, {
                      children: [
                        e.jsx("span", {
                          className:
                            "font-sans text-foreground text-[18px] font-semibold",
                          children: "Còn câu chưa trả lời",
                        }),
                        e.jsxs("span", {
                          className: "font-sans text-muted text-[13px]",
                          children: [
                            "Bạn còn",
                            " ",
                            e.jsxs("span", {
                              className: "text-primary font-bold",
                              children: [V.length, " câu"],
                            }),
                            " ",
                            "chưa trả lời. Nhấn vào ô để quay lại, hoặc vẫn nộp bài.",
                          ],
                        }),
                      ],
                    }),
              }),
              !te &&
                e.jsx("div", {
                  className: "flex flex-wrap gap-2",
                  children: V.map(({ q: s, i: d }) =>
                    e.jsx(
                      "button",
                      {
                        onClick: () => {
                          (J(d), u(!1));
                        },
                        className:
                          "w-8 h-8 rounded-lg font-sans text-[12px] font-bold border border-primary/20 text-primary hover:bg-primary/10 transition",
                        style: { background: "var(--primary-subtle)" },
                        children: d + 1,
                      },
                      s.id,
                    ),
                  ),
                }),
              Q.length > 0 &&
                e.jsxs("div", {
                  className: "flex flex-col gap-2",
                  children: [
                    e.jsxs("span", {
                      className:
                        "font-sans text-destructive text-[12px] font-semibold flex items-center gap-1.5",
                      children: [
                        e.jsx("svg", {
                          width: "10",
                          height: "12",
                          viewBox: "0 0 11 13",
                          fill: "none",
                          children: e.jsx("path", {
                            d: "M1 1v11M1 1h7.5l-2 3.5 2 3.5H1",
                            stroke: "currentColor",
                            strokeWidth: "1.5",
                            strokeLinecap: "round",
                            strokeLinejoin: "round",
                          }),
                        }),
                        Q.length,
                        " câu đã đánh dấu — nhấn để xem lại",
                      ],
                    }),
                    e.jsx("div", {
                      className: "flex flex-wrap gap-2",
                      children: Q.map(({ q: s, i: d }) =>
                        e.jsx(
                          "button",
                          {
                            onClick: () => {
                              (J(d), u(!1));
                            },
                            className:
                              "w-8 h-8 rounded-lg font-sans text-[12px] font-bold transition hover:opacity-80",
                            style: {
                              background: "rgba(220,38,38,0.1)",
                              border: "1px solid var(--destructive)",
                              color: "var(--destructive)",
                            },
                            children: d + 1,
                          },
                          s.id,
                        ),
                      ),
                    }),
                  ],
                }),
              e.jsxs("div", {
                className: "flex items-center gap-3 mt-1",
                children: [
                  e.jsx("button", {
                    onClick: () => u(!1),
                    className:
                      "flex-1 py-2.5 rounded-[10px] font-sans text-[13px] font-semibold text-muted bg-surface border border-surface hover:bg-surface transition",
                    children: "Làm tiếp",
                  }),
                  e.jsx("button", {
                    onClick: ye,
                    className:
                      "flex-1 py-2.5 rounded-[10px] font-sans text-[13px] font-bold text-background hover:opacity-90 transition",
                    style: { background: "var(--primary)" },
                    children: "Nộp bài",
                  }),
                ],
              }),
            ],
          }),
        }),
      h &&
        e.jsx("div", {
          className:
            "fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 px-4",
          children: e.jsxs(y.div, {
            initial: { opacity: 0, y: 24 },
            animate: { opacity: 1, y: 0 },
            transition: { duration: 0.22, ease: [0.25, 0.46, 0.45, 0.94] },
            className:
              "w-full max-w-sm bg-surface-elevated rounded-2xl p-6 flex flex-col gap-4 mb-4 sm:mb-0",
            children: [
              e.jsxs("div", {
                className: "flex flex-col gap-1",
                children: [
                  e.jsx("p", {
                    className:
                      "font-sans text-[15px] font-semibold text-foreground",
                    children: "Thoát bài luyện tập?",
                  }),
                  e.jsx("p", {
                    className: "font-sans text-[13px] text-muted",
                    children:
                      "Câu trả lời đã chọn vẫn được lưu. Bạn có thể tiếp tục sau.",
                  }),
                ],
              }),
              e.jsxs("div", {
                className: "flex gap-2",
                children: [
                  e.jsx("button", {
                    onClick: () => j(!1),
                    className:
                      "flex-1 py-2.5 rounded-xl font-sans text-[13px] font-semibold text-foreground bg-surface border border-border hover:bg-border/50 transition",
                    children: "Làm tiếp",
                  }),
                  e.jsx("button", {
                    onClick: () => {
                      (j(!1),
                        sessionStorage.removeItem(`exam-draft-${r}`),
                        o({ type: "RESET" }),
                        a("/exams", { replace: !0 }));
                    },
                    className:
                      "flex-1 py-2.5 rounded-xl font-sans text-[13px] font-semibold text-muted bg-surface border border-border hover:text-foreground transition",
                    children: "Lưu nháp và thoát",
                  }),
                ],
              }),
            ],
          }),
        }),
    ],
  });
}
export { tt as default };
