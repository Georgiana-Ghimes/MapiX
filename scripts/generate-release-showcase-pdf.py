#!/usr/bin/env python3
"""Generează PDF showcase MapiX cu diacritice RO (font Unicode, nu Helvetica)."""
from __future__ import annotations

from pathlib import Path

from PIL import Image as PILImage
from reportlab.lib.colors import HexColor
from reportlab.lib.enums import TA_CENTER
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import (
    HRFlowable,
    Image,
    KeepTogether,
    PageBreak,
    Paragraph,
    SimpleDocTemplate,
    Spacer,
)

ROOT = Path(__file__).resolve().parents[1]
VERSION = "0.4.0"
BUILD = "39"
SHOTS = ROOT / f"releases/{VERSION}/screenshots"
OUT = ROOT / f"releases/{VERSION}/MapiX-v{VERSION}-showcase.pdf"
OUT_DOCS = ROOT / f"DOCS/releases/{VERSION}/MapiX-v{VERSION}-showcase.pdf"

# DejaVu suportă corect ș/ț (comma-below). Arial Unicode pe macOS le corupe.
_FONT_DIR = Path(__file__).resolve().parent / "fonts"
FONT_CANDIDATES = [
    (_FONT_DIR / "DejaVuSans.ttf", _FONT_DIR / "DejaVuSans-Bold.ttf"),
    (
        Path("/System/Library/Fonts/Supplemental/Arial.ttf"),
        Path("/System/Library/Fonts/Supplemental/Arial Bold.ttf"),
    ),
]


def register_fonts() -> tuple[str, str]:
    probe = "ăâîșțĂÂÎȘȚ"
    for regular, bold in FONT_CANDIDATES:
        if not regular.exists():
            continue
        pdfmetrics.registerFont(TTFont("MapiXSans", str(regular)))
        bold_path = bold if bold.exists() else regular
        pdfmetrics.registerFont(TTFont("MapiXSans-Bold", str(bold_path)))
        # respinge fonturi care nu mapează comma-below (ex. Arial Unicode → glyf lipsă)
        from reportlab.pdfgen import canvas
        from io import BytesIO
        from pypdf import PdfReader

        buf = BytesIO()
        c = canvas.Canvas(buf)
        c.setFont("MapiXSans", 12)
        c.drawString(10, 10, probe)
        c.save()
        extracted = PdfReader(BytesIO(buf.getvalue())).pages[0].extract_text() or ""
        if "\x00" in extracted or "ș" not in extracted or "ț" not in extracted:
            continue
        return "MapiXSans", "MapiXSans-Bold"
    raise SystemExit(
        "Nu am găsit un font TTF cu diacritice RO. Rulează din scripts/fonts "
        "(DejaVuSans.ttf + DejaVuSans-Bold.ttf)."
    )


def fit_image(path: Path, max_w: float, max_h: float) -> Image:
    im = PILImage.open(path)
    iw, ih = im.size
    scale = min(max_w / iw, max_h / ih)
    return Image(str(path), width=iw * scale, height=ih * scale)


def main() -> None:
    font, font_bold = register_fonts()
    W, H = A4
    MARGIN = 16 * mm

    styles = getSampleStyleSheet()
    title = ParagraphStyle(
        "TitleRO",
        parent=styles["Title"],
        fontName=font_bold,
        fontSize=22,
        textColor=HexColor("#0f172a"),
        spaceAfter=6,
        alignment=TA_CENTER,
    )
    subtitle = ParagraphStyle(
        "SubRO",
        parent=styles["Normal"],
        fontName=font,
        fontSize=11,
        textColor=HexColor("#334155"),
        spaceAfter=14,
        alignment=TA_CENTER,
        leading=15,
    )
    h1 = ParagraphStyle(
        "H1RO",
        parent=styles["Heading1"],
        fontName=font_bold,
        fontSize=14,
        textColor=HexColor("#0f172a"),
        spaceBefore=10,
        spaceAfter=8,
    )
    h2 = ParagraphStyle(
        "H2RO",
        parent=styles["Heading2"],
        fontName=font_bold,
        fontSize=12,
        textColor=HexColor("#1e3a5f"),
        spaceBefore=8,
        spaceAfter=4,
    )
    body = ParagraphStyle(
        "BodyRO",
        parent=styles["Normal"],
        fontName=font,
        fontSize=9.5,
        textColor=HexColor("#1e293b"),
        leading=13,
        spaceAfter=4,
    )
    bullet = ParagraphStyle(
        "BulletRO",
        parent=body,
        leftIndent=10,
        bulletIndent=0,
        spaceAfter=2,
    )
    caption = ParagraphStyle(
        "CapRO",
        parent=styles["Normal"],
        fontName=font,
        fontSize=8.5,
        textColor=HexColor("#475569"),
        spaceBefore=4,
        spaceAfter=10,
        alignment=TA_CENTER,
        leading=11,
    )
    foot = ParagraphStyle(
        "FootRO",
        parent=styles["Normal"],
        fontName=font,
        fontSize=8,
        textColor=HexColor("#64748b"),
        alignment=TA_CENTER,
    )

    story = []
    story.append(Spacer(1, 8 * mm))
    story.append(Paragraph("MapiX", title))
    story.append(Paragraph(f"Release showcase · v{VERSION} · build {BUILD}", subtitle))
    story.append(Paragraph("13 octombrie 2026 · Transitix / MapiX", subtitle))
    story.append(HRFlowable(width="100%", thickness=1, color=HexColor("#2563eb"), spaceAfter=12))
    story.append(
        Paragraph(
            "Acest document prezintă cum arată platforma după release-ul 0.4.0 și ce s-a implementat: "
            "navigare localități, motor de căutare taxe corectat, UI accesibil (contrast WCAG), "
            "sidebar permanent, județe oficiale RO, zone rethink și changelog detaliat.",
            body,
        )
    )

    story.append(Paragraph("1. Ce aduce v0.4.0 (pe scurt)", h1))
    highlights = [
        "<b>Căutare localitate în header</b> — typeahead cu diacritice, Enter doar pe match, URL partajabil către Caută taxe.",
        "<b>Caută taxe</b> — zone combinate (A și B), tarif potrivit duratei (zi/lună), interdicții/exceptări cu status corect, fără badge-uri înșelătoare.",
        "<b>Dashboard</b> — KPI colorate cu linkuri; coadă verificări pe județ; fără „Acces rapid” redundant.",
        "<b>Sidebar</b> — mereu expandat; badge alerte pe meniu; versiune v0.4.0 · build 39.",
        "<b>Localități / Zone / Județ</b> — listă pe județ (până la 500); județ din catalog oficial; zonă „întreagă” vs distinctă.",
        "<b>Contrast WCAG</b> — texte secundare lizibile; fundal canvas subtil.",
        "<b>Date</b> — import Bragadiru HCL 41; praguri București fără overlap la limite de masă.",
    ]
    for t in highlights:
        story.append(Paragraph(f"• {t}", bullet))

    story.append(PageBreak())
    story.append(Paragraph("2. Showcase — ecrane din platformă", h1))

    shots = [
        (
            "01-home-dashboard.png",
            "Prezentare generală",
            "KPI-uri cu panglici colorate + linkuri; verificări pe județ; badge Alerte în sidebar; v0.4.0 · build 39.",
        ),
        (
            "02-cauta-taxe.png",
            "Caută taxe și restricții",
            "București · 6 t · 1 zi: interdicție tranzit Calculat; tarife pe zi (nu și pe lună); descriere zonă / străzi.",
        ),
        (
            "03-localitati.png",
            "Localități",
            "Grupare pe județ (Ilfov, București…); filtre prioritate/județ/status; + Adaugă localitate.",
        ),
        (
            "04-baza-taxe.png",
            "Baza de taxe",
            "Reguli pe județ → localitate; alerte overlap; catalog pe județe.",
        ),
        (
            "05-alerte.png",
            "Alerte",
            "Badge numeric pe navigare; listă agregată pe județ (Ilfov, București…).",
        ),
        (
            "06-cost-cursa.png",
            "Cost pe cursă",
            "Calcul pe traseu cu aceleași reguli de zonă și tarif pe durată ca în Caută taxe.",
        ),
    ]

    max_w = W - 2 * MARGIN
    max_h = H - 55 * mm

    for fname, heading, cap in shots:
        path = SHOTS / fname
        if not path.exists():
            story.append(Paragraph(f"[Lipsă screenshot: {fname}]", body))
            continue
        story.append(
            KeepTogether(
                [
                    Paragraph(heading, h2),
                    fit_image(path, max_w, max_h),
                    Paragraph(cap, caption),
                ]
            )
        )

    story.append(PageBreak())
    story.append(Paragraph("3. Changelog detaliat — v0.4.0", h1))
    story.append(Paragraph("Data: 2026-10-13 · SemVer MINOR față de 0.3.0 · build 39", body))

    story.append(Paragraph("Adăugat", h2))
    for t in [
        "HeaderLocalitateSearch — căutare globală localitate → /cauta-taxe cu query params.",
        "LocalitateSelect — combobox cmdk, diacritice, etichetă Nume · Județ.",
        "judeteRo (FE + API) — catalog județe RO + validare 400.",
        "ZonaFormDialog rethink — Întreaga localitate vs zonă distinctă; ZonaDescriere.",
        "grupareJudet / ListaJudetExpand / VerificariJudetExpand / verificariCoada.",
        "importBragadiruHcl41 + act PDF research; benzi masă fără overlap.",
        "regulaPotrivesteZona, zoneCompatibile, marcheazaTarifeAlternative în reguliTaxe.",
        "Canvas fundal (bg-app-canvas); ExpandToggle / panouri UI.",
    ]:
        story.append(Paragraph(f"• {t}", bullet))

    story.append(Paragraph("Schimbat", h2))
    for t in [
        "Sidebar permanent w-64; badge alerte pe nav; header org centrat.",
        "Home: fără Acces rapid; KPI ribbons + linkuri; contrast ridicat.",
        "Tokeni slate / muted-foreground WCAG; PageHeader, EmptyState, AppVersion.",
        "Localități limit 500, sort județ.",
        "Caută taxe: URL sync; zone combinate; tarif după durată; status Calculat pentru interdicții/exceptări; regim localitate ca text, nu badge rezultat.",
        "Cost pe cursă: aceleași reguli zonă + tarife alternative.",
        "Versiune din package.json (nu define Vite stale).",
    ]:
        story.append(Paragraph(f"• {t}", bullet))

    story.append(Paragraph("Remediat", h2))
    for t in [
        "București: praguri masă 5,01 / 7,51 / … (fără dublă potrivire la limite).",
        "Enter în header fără match nu mai reîncarcă haotic.",
        "Prefill URL onorează localitatea din query (nu session veche).",
    ]:
        story.append(Paragraph(f"• {t}", bullet))

    story.append(Paragraph("Ops", h2))
    for t in [
        "După pull: npm install (dacă e nevoie), npm run db:migrate, npm run dev:all.",
        "Login seed: admin@mapix.local / admin12345.",
        "Changelog complet în CHANGELOG.md din repo.",
    ]:
        story.append(Paragraph(f"• {t}", bullet))

    story.append(Spacer(1, 8 * mm))
    story.append(HRFlowable(width="100%", thickness=0.5, color=HexColor("#cbd5e1"), spaceAfter=8))
    story.append(Paragraph(f"MapiX · Transitix · Document generat pentru release {VERSION}", foot))
    story.append(Paragraph("Verifică întotdeauna la sursa oficială înainte de deplasare.", foot))

    def on_page(canvas, doc):
        canvas.saveState()
        canvas.setFillColor(HexColor("#64748b"))
        canvas.setFont(font, 8)
        canvas.drawString(MARGIN, 10 * mm, f"MapiX v{VERSION} · build {BUILD}")
        canvas.drawRightString(W - MARGIN, 10 * mm, f"pag. {doc.page}")
        canvas.restoreState()

    OUT.parent.mkdir(parents=True, exist_ok=True)
    doc = SimpleDocTemplate(
        str(OUT),
        pagesize=A4,
        leftMargin=MARGIN,
        rightMargin=MARGIN,
        topMargin=14 * mm,
        bottomMargin=16 * mm,
        title=f"MapiX v{VERSION} Showcase",
        author="MapiX",
    )
    doc.build(story, onFirstPage=on_page, onLaterPages=on_page)

    OUT_DOCS.parent.mkdir(parents=True, exist_ok=True)
    OUT_DOCS.write_bytes(OUT.read_bytes())
    print(f"OK {OUT} ({OUT.stat().st_size} bytes) font={font}")
    print(f"OK {OUT_DOCS}")


if __name__ == "__main__":
    main()
