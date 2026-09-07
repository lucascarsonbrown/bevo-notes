"""Renders docs/figure.png for the README.

Documentation tooling. The right-hand panels are arithmetic on the context
budget documented in docs/architecture.md; the left panel is a diagram of the
pipeline in lib/ai/, not a measurement.

    pip install numpy matplotlib && python3 docs/render_figure.py
"""
import os
import numpy as np
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from matplotlib.patches import FancyBboxPatch, FancyArrowPatch

BG, PANEL, FG, MUTED = "#14171c", "#1b1f26", "#e6e4e0", "#8b8f98"
ACC, COOL, WARN, DIM = "#c678dd", "#5fb3b3", "#e0a458", "#3a4350"

# from docs/architecture.md
WINDOW, SYSTEM, RESERVE, TRANSCRIPT = 4096, 350, 1000, 2400
CHARS_PER_PASS = 9500

plt.rcParams.update({
    "figure.facecolor": BG, "axes.facecolor": PANEL, "savefig.facecolor": BG,
    "text.color": FG, "axes.labelcolor": MUTED, "axes.edgecolor": "#2b323d",
    "xtick.color": MUTED, "ytick.color": MUTED, "font.size": 9,
    "axes.titlesize": 10.5, "axes.titlecolor": FG,
    "grid.color": "#232935", "grid.linewidth": 0.6,
})

fig = plt.figure(figsize=(13, 6.6))
gs = fig.add_gridspec(2, 2, width_ratios=[1.25, 1], hspace=0.42, wspace=0.18,
                      left=0.035, right=0.975, top=0.845, bottom=0.115)

# (a) the pipeline -----------------------------------------------------------
ax = fig.add_subplot(gs[:, 0])
ax.set_xlim(0, 10); ax.set_ylim(-0.55, 10.4); ax.axis("off")
ax.set_title("One lecture through lib/ai — a diagram, not a measurement", pad=12)

steps = [
    ("capture",  "raw VTT, timings preserved",            COOL),
    ("parse",    "cues built, rolling repeats collapsed", COOL),
    ("chunk",    "split at the longest silence",          WARN),
    ("generate", "one constrained pass per chunk",        ACC),
    ("merge",    "deterministic — no second model call",  WARN),
    ("title",    "the one reduce-step model call",        ACC),
    ("render",   "HTML, LaTeX → MathML via KaTeX",        COOL),
    ("persist",  "POST to Supabase",                      COOL),
]
h, gap = 0.92, 0.34
y = 10.0
for i, (name, sub, colour) in enumerate(steps):
    y -= h
    ax.add_patch(FancyBboxPatch((0.5, y), 8.9, h, boxstyle="round,pad=0.02,rounding_size=0.12",
                                fc=PANEL, ec=colour, lw=1.4))
    ax.text(0.85, y + h * 0.62, name, fontsize=10.5, color=FG, va="center", weight="bold")
    ax.text(0.85, y + h * 0.24, sub, fontsize=8.4, color=MUTED, va="center")
    if colour is ACC:
        ax.text(9.1, y + h * 0.5, "model", fontsize=7.6, color=ACC,
                va="center", ha="right", style="italic")
    if i < len(steps) - 1:
        ax.add_patch(FancyArrowPatch((5.0, y), (5.0, y - gap), arrowstyle="-|>",
                                     mutation_scale=11, color="#3a4350", lw=1.2))
    y -= gap

ax.text(5.0, -0.35, "everything above runs in the browser — nothing leaves the machine",
        fontsize=8.6, color=WARN, ha="center", style="italic")

# (b) the budget -------------------------------------------------------------
ax = fig.add_subplot(gs[0, 1])
parts = [("system prompt", SYSTEM, COOL), ("transcript", TRANSCRIPT, ACC),
         ("output reserve", RESERVE, WARN),
         ("headroom", WINDOW - SYSTEM - TRANSCRIPT - RESERVE, DIM)]
left = 0
for label, val, colour in parts:
    ax.barh([0], [val], left=left, color=colour, height=0.5)
    if val > 300:
        ax.text(left + val / 2, 0, f"{label}\n{val}", ha="center", va="center",
                fontsize=8.2, color="#14171c" if colour is not DIM else MUTED)
    left += val
ax.set_xlim(0, WINDOW); ax.set_ylim(-0.5, 0.5)
ax.set_yticks([])
ax.set_xlabel("tokens")
ax.set_title(f"The whole constraint: a {WINDOW}-token window\n"
             "holding prompt and completion together", pad=8)

# (c) why chunking is structural --------------------------------------------
ax = fig.add_subplot(gs[1, 1])
chars = np.linspace(0, 60000, 400)
ax.plot(chars, np.ceil(chars / CHARS_PER_PASS), color=ACC, lw=1.8)
ax.axvline(50000, color=WARN, ls="--", lw=1.2)
ax.annotate("a 50,000-char lecture\n→ ~5 passes", (50000, np.ceil(50000 / CHARS_PER_PASS)),
            textcoords="offset points", xytext=(-108, -12), fontsize=8.4, color=WARN)
ax.axhline(1, color="#e06c75", ls=":", lw=1.2)
ax.text(1200, 1.18, "what a single call could hold", fontsize=8.2, color="#e06c75")
ax.grid(True)
ax.set_xlabel("lecture length (characters)")
ax.set_ylabel("generation passes")
ax.set_title("Chunking is structural, not an optimisation", pad=8)

fig.suptitle("Bevo Notes — what a 4096-token budget forces the architecture to be",
             fontsize=12.5, y=0.945)
fig.text(0.5, 0.050,
         "Running the model locally costs nothing per token and keeps lecture "
         "content on the student's machine.",
         color=MUTED, fontsize=8.3, ha="center")
fig.text(0.5, 0.022,
         "The price is the window above — which is why generation is chunked at "
         "topic boundaries, and why the merge step is deterministic rather than "
         "a second model call.",
         color=MUTED, fontsize=8.3, ha="center")

fig.savefig(os.path.join(os.path.dirname(os.path.abspath(__file__)), "figure.png"), dpi=140)
print("saved docs/figure.png")
