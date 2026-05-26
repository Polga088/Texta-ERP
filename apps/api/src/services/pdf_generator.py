from __future__ import annotations

from datetime import date
from typing import Any

from jinja2 import Template

try:
    from weasyprint import HTML
except Exception:  # pragma: no cover - optional system dependency in some environments
    HTML = None


QUOTE_TEMPLATE = Template(
    """
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <style>
    @page { size: A4; margin: 2cm; }
    body { font-family: Inter, Arial, sans-serif; color: #1e293b; }
    .header { display: flex; justify-content: space-between; align-items: start; margin-bottom: 36px; }
    .logo { width: 140px; height: 60px; background: #f1f5f9; border-radius: 8px; display: flex; align-items: center; justify-content: center; color: #94a3b8; font-size: 12px; font-weight: 600; }
    .doc-info { text-align: right; }
    .doc-number { font-size: 24px; font-weight: 800; color: #7c3aed; }
    .doc-date { color: #64748b; font-size: 13px; margin-top: 4px; }
    .client-box { background: #f8fafc; padding: 16px; border-radius: 12px; margin-bottom: 24px; }
    .client-label { font-size: 11px; text-transform: uppercase; color: #94a3b8; font-weight: 700; letter-spacing: 0.05em; }
    .client-name { font-size: 18px; font-weight: 700; margin-top: 4px; }
    table { width: 100%; border-collapse: collapse; margin: 20px 0; }
    th { background: #f1f5f9; padding: 11px; text-align: left; font-size: 12px; text-transform: uppercase; color: #64748b; font-weight: 700; border-bottom: 2px solid #e2e8f0; }
    td { padding: 14px 11px; border-bottom: 1px solid #f1f5f9; font-size: 13px; }
    td.number, th.number { text-align: right; }
    .totals-box { margin-left: auto; width: 320px; margin-top: 18px; }
    .total-row { display: flex; justify-content: space-between; padding: 7px 0; font-size: 13px; color: #475569; }
    .total-row.grand-total { font-size: 20px; font-weight: 800; color: #7c3aed; border-top: 2px solid #e2e8f0; padding-top: 11px; margin-top: 6px; }
    .conditions { margin-top: 26px; font-size: 12px; color: #64748b; line-height: 1.5; }
    .footer { margin-top: 44px; padding-top: 14px; border-top: 1px solid #e2e8f0; font-size: 11px; color: #94a3b8; }
  </style>
</head>
<body>
  <div class="header">
    <div class="logo">VOTRE LOGO</div>
    <div class="doc-info">
      <div class="doc-number">{{ title }} {{ number }}</div>
      <div class="doc-date">Emis le {{ issue_date }}{% if due_label %} — {{ due_label }}{% endif %}</div>
    </div>
  </div>

  <div class="client-box">
    <div class="client-label">Client</div>
    <div class="client-name">{{ client_name }}</div>
    <div style="color: #64748b; margin-top: 4px;">{{ client_meta }}</div>
  </div>

  <table>
    <thead>
      <tr>
        <th style="width: 52%">Description</th>
        <th style="width: 10%" class="number">Qte</th>
        <th style="width: 18%" class="number">Prix unit.</th>
        <th style="width: 20%" class="number">Total</th>
      </tr>
    </thead>
    <tbody>
      {% for item in items %}
      <tr>
        <td>{{ item.description }}</td>
        <td class="number">{{ item.qty }}</td>
        <td class="number">{{ item.unit_price }} MAD</td>
        <td class="number">{{ item.total_ht }} MAD</td>
      </tr>
      {% endfor %}
    </tbody>
  </table>

  <div class="totals-box">
    <div class="total-row"><span>Sous-total HT</span><span>{{ total_ht }} MAD</span></div>
    <div class="total-row"><span>TVA ({{ tva_rate }}%)</span><span>{{ tva_amount }} MAD</span></div>
    <div class="total-row grand-total"><span>TOTAL TTC</span><span>{{ total_ttc }} MAD</span></div>
  </div>

  <div class="conditions">
    <strong>Conditions de paiement:</strong> Paiement sous 30 jours a reception de la facture.<br>
    <strong>Validite:</strong> Ce document est valable jusqu'au {{ valid_until }}.
  </div>

  <div class="footer">
    Votre Entreprise — RC XXX — IF XXX — ICE XXX<br>
    Adresse — Tel — Email
  </div>
</body>
</html>
"""
)


def _fmt_amount(value: Any) -> str:
    return f"{float(value or 0):.2f}"


def _normalize_items(items: list[dict]) -> list[dict[str, str]]:
    rows: list[dict[str, str]] = []
    for item in items:
        rows.append(
            {
                "description": str(item.get("description") or "Ligne"),
                "qty": _fmt_amount(item.get("qty")),
                "unit_price": _fmt_amount(item.get("unit_price")),
                "total_ht": _fmt_amount(item.get("total_ht")),
            }
        )
    return rows


def build_commercial_pdf(
    *,
    title: str,
    number: str,
    issue_date: date,
    valid_until: date | None,
    client_name: str,
    client_meta: str,
    items: list[dict],
    total_ht: Any,
    tva_rate: Any,
    tva_amount: Any,
    total_ttc: Any,
) -> bytes:
    html_content = QUOTE_TEMPLATE.render(
        title=title,
        number=number,
        issue_date=issue_date.isoformat(),
        due_label=f"Valable jusqu'au {valid_until.isoformat()}" if valid_until else "",
        valid_until=valid_until.isoformat() if valid_until else issue_date.isoformat(),
        client_name=client_name,
        client_meta=client_meta,
        items=_normalize_items(items),
        total_ht=_fmt_amount(total_ht),
        tva_rate=_fmt_amount(tva_rate),
        tva_amount=_fmt_amount(tva_amount),
        total_ttc=_fmt_amount(total_ttc),
    )
    if HTML is None:
        raise RuntimeError("WeasyPrint indisponible")
    return HTML(string=html_content).write_pdf()
