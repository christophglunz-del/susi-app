/**
 * Rechnungsversand-Modul für Susi's Alltagshilfe
 */

const RechnungModule = {
  async init() {
    await this.listeAnzeigen();
  },

  async listeAnzeigen() {
    const container = document.getElementById('rechnungContent');
    if (!container) return;

    const rechnungen = await DB.alleRechnungen();
    const kunden = await DB.alleKunden();
    const kundenMap = {};
    kunden.forEach(k => kundenMap[k.id] = k);

    const jetzt = new Date();
    const aktuellerMonat = jetzt.getMonth() + 1;
    const aktuellesJahr = jetzt.getFullYear();

    container.innerHTML = `
      <!-- Neue Rechnung erstellen -->
      <div class="card">
        <h3 class="card-title mb-2">Neue Rechnung erstellen</h3>
        <div class="form-group">
          <label for="rechnungKunde">Kunde</label>
          <select id="rechnungKunde" class="form-control" onchange="RechnungModule.kundeGewaehlt()">
            <option value="">-- Kunde wählen --</option>
            ${kunden.map(k => `<option value="${k.id}">${KundenModule.escapeHtml(k.name)}</option>`).join('')}
          </select>
        </div>

        <div id="rechnungKundeInfo" class="hidden">
          <div class="form-row">
            <div class="form-group">
              <label>Pflegekasse</label>
              <div id="rechnungKasse" class="form-control" style="background: var(--gray-100);">-</div>
            </div>
            <div class="form-group">
              <label>Fax</label>
              <div id="rechnungFax" class="form-control" style="background: var(--gray-100);">-</div>
            </div>
          </div>
          <div id="rechnungBesonderheiten" class="hidden" style="padding: 8px; background: var(--warning-bg); border-radius: 8px; margin-bottom: 12px;">
          </div>
        </div>

        <div class="form-row">
          <div class="form-group">
            <label for="rechnungMonat">Monat</label>
            <select id="rechnungMonat" class="form-control">
              ${Array.from({length: 12}, (_, i) => {
                const m = i + 1;
                return `<option value="${m}" ${m === aktuellerMonat - 1 ? 'selected' : ''}>${App.monatsName(m)}</option>`;
              }).join('')}
            </select>
          </div>
          <div class="form-group">
            <label for="rechnungJahr">Jahr</label>
            <input type="number" id="rechnungJahr" class="form-control"
                   value="${aktuellesJahr}" min="2024" max="2030">
          </div>
        </div>

        <div class="form-group">
          <label>Versandart</label>
          <div class="btn-group">
            <button type="button" class="btn btn-sm btn-outline versand-btn" data-art="fax" onclick="RechnungModule.versandartWaehlen('fax')">
              📠 Fax (Sipgate)
            </button>
            <button type="button" class="btn btn-sm btn-outline versand-btn" data-art="brief" onclick="RechnungModule.versandartWaehlen('brief')">
              ✉️ Brief (LetterXpress)
            </button>
            <button type="button" class="btn btn-sm btn-outline versand-btn" data-art="webmail" onclick="RechnungModule.versandartWaehlen('webmail')">
              💻 Webmail
            </button>
          </div>
          <input type="hidden" id="rechnungVersandart" value="">
        </div>

        <div class="card" style="background: var(--info-bg);">
          <p class="text-sm">
            <strong>Hinweis:</strong> Die Rechnung wird über <strong>Lexoffice</strong> erstellt.
            Hier wird das Anschreiben an die Pflegekasse generiert.
          </p>
        </div>

        <div class="btn-group mt-2">
          <button class="btn btn-primary btn-block" onclick="RechnungModule.rechnungErstellen()">
            Rechnung anlegen
          </button>
          <button class="btn btn-outline" onclick="RechnungModule.anschreibenErstellen()">
            📄 Anschreiben PDF
          </button>
        </div>
      </div>

      <!-- Bestehende Rechnungen -->
      <div class="section-title mt-3"><span class="icon">📊</span> Rechnungsübersicht</div>

      ${rechnungen.length === 0
        ? '<div class="card text-center text-muted">Noch keine Rechnungen</div>'
        : this.rechnungenRendern(rechnungen, kundenMap)
      }
    `;
  },

  rechnungenRendern(rechnungen, kundenMap) {
    return rechnungen.map(r => {
      const kunde = kundenMap[r.kundeId];
      const statusInfo = this.statusInfo(r.status);

      return `
        <div class="card">
          <div class="card-header">
            <div>
              <div class="card-title">${kunde ? KundenModule.escapeHtml(kunde.name) : 'Unbekannt'}</div>
              <div class="text-sm text-muted">
                ${App.monatsName(r.monat)} ${r.jahr}
                ${r.rechnungsnummer ? ' | Nr. ' + r.rechnungsnummer : ''}
              </div>
            </div>
            <span class="badge ${statusInfo.badgeClass}">${statusInfo.label}</span>
          </div>

          <div class="d-flex justify-between align-center">
            <div class="text-sm">
              ${r.versandart ? '📤 ' + this.versandartLabel(r.versandart) : ''}
              ${r.versandDatum ? ' | ' + App.formatDatum(r.versandDatum) : ''}
            </div>
            <div class="fw-bold text-primary">${r.betrag ? App.formatBetrag(r.betrag) : '-'}</div>
          </div>

          <!-- Status-Timeline -->
          <div class="status-timeline">
            <div class="status-step ${r.status ? 'complete' : 'active'}"></div>
            <div class="status-step ${r.status === 'versendet' || r.status === 'eingegangen' || r.status === 'bezahlt' ? 'complete' : ''}"></div>
            <div class="status-step ${r.status === 'eingegangen' || r.status === 'bezahlt' ? 'complete' : ''}"></div>
            <div class="status-step ${r.status === 'bezahlt' ? 'complete' : ''}"></div>
          </div>
          <div class="d-flex justify-between text-xs text-muted mt-1">
            <span>Erstellt</span>
            <span>Versendet</span>
            <span>Eingegangen</span>
            <span>Bezahlt</span>
          </div>

          <div class="btn-group mt-2">
            ${r.status !== 'bezahlt' ? `
              <button class="btn btn-sm btn-outline" onclick="RechnungModule.statusAendern(${r.id}, '${this.naechsterStatus(r.status)}')">
                ${this.naechsterStatusLabel(r.status)}
              </button>
            ` : ''}
            <button class="btn btn-sm btn-secondary" onclick="RechnungModule.loeschen(${r.id})">
              Löschen
            </button>
          </div>
        </div>
      `;
    }).join('');
  },

  async kundeGewaehlt() {
    const kundeId = parseInt(document.getElementById('rechnungKunde').value);
    const infoDiv = document.getElementById('rechnungKundeInfo');

    if (!kundeId) {
      infoDiv.classList.add('hidden');
      return;
    }

    const kunde = await DB.kundeById(kundeId);
    if (!kunde) return;

    infoDiv.classList.remove('hidden');
    document.getElementById('rechnungKasse').textContent = kunde.pflegekasse || '-';
    document.getElementById('rechnungFax').textContent = kunde.faxKasse || '-';

    const besDiv = document.getElementById('rechnungBesonderheiten');
    if (kunde.besonderheiten) {
      besDiv.classList.remove('hidden');
      besDiv.innerHTML = `<strong>⚠️ Besonderheit:</strong> ${KundenModule.escapeHtml(kunde.besonderheiten)}`;
    } else {
      besDiv.classList.add('hidden');
    }
  },

  versandartWaehlen(art) {
    document.querySelectorAll('.versand-btn').forEach(btn => {
      btn.classList.remove('btn-primary');
      btn.classList.add('btn-outline');
    });
    const btn = document.querySelector(`.versand-btn[data-art="${art}"]`);
    if (btn) {
      btn.classList.remove('btn-outline');
      btn.classList.add('btn-primary');
    }
    document.getElementById('rechnungVersandart').value = art;
  },

  async rechnungErstellen() {
    const kundeId = parseInt(document.getElementById('rechnungKunde').value);
    if (!kundeId) {
      App.toast('Bitte einen Kunden wählen', 'error');
      return;
    }

    const monat = parseInt(document.getElementById('rechnungMonat').value);
    const jahr = parseInt(document.getElementById('rechnungJahr').value);
    const versandart = document.getElementById('rechnungVersandart').value;

    // Leistungen für diesen Monat laden
    const leistungen = await DB.leistungenFuerMonat(monat, jahr);
    const kundeLeistungen = leistungen.filter(l => l.kundeId === kundeId);

    let betrag = 0;
    kundeLeistungen.forEach(l => {
      const stunden = App.stundenBerechnen(l.startzeit, l.endzeit);
      betrag += App.betragBerechnen(stunden);
    });

    const rechnung = {
      kundeId,
      monat,
      jahr,
      betrag,
      status: 'offen',
      versandart,
      notizen: ''
    };

    try {
      await DB.rechnungHinzufuegen(rechnung);
      App.toast('Rechnung angelegt', 'success');
      this.listeAnzeigen();
    } catch (err) {
      console.error('Fehler:', err);
      App.toast('Fehler beim Anlegen', 'error');
    }
  },

  async anschreibenErstellen() {
    const kundeId = parseInt(document.getElementById('rechnungKunde').value);
    if (!kundeId) {
      App.toast('Bitte einen Kunden wählen', 'error');
      return;
    }

    const monat = parseInt(document.getElementById('rechnungMonat').value);
    const jahr = parseInt(document.getElementById('rechnungJahr').value);

    try {
      const kunde = await DB.kundeById(kundeId);
      const leistungen = await DB.leistungenFuerMonat(monat, jahr);
      const kundeLeistungen = leistungen.filter(l => l.kundeId === kundeId);

      const rechnung = { monat, jahr };
      const doc = await PDFHelper.generateAnschreiben(rechnung, kunde, kundeLeistungen);
      const dateiname = `Anschreiben_${kunde.name.replace(/\s+/g, '_')}_${App.monatsName(monat)}_${jahr}.pdf`;
      PDFHelper.download(doc, dateiname);
      App.toast('Anschreiben-PDF erstellt', 'success');
    } catch (err) {
      console.error('PDF-Fehler:', err);
      App.toast('Fehler bei PDF-Erstellung', 'error');
    }
  },

  async statusAendern(id, neuerStatus) {
    try {
      const daten = { status: neuerStatus };
      if (neuerStatus === 'versendet') daten.versandDatum = new Date().toISOString();
      if (neuerStatus === 'bezahlt') daten.bezahltDatum = new Date().toISOString();

      await DB.rechnungAktualisieren(id, daten);
      App.toast(`Status: ${this.statusInfo(neuerStatus).label}`, 'success');
      this.listeAnzeigen();
    } catch (err) {
      App.toast('Fehler beim Aktualisieren', 'error');
    }
  },

  async loeschen(id) {
    if (!await App.confirm('Rechnung wirklich löschen?')) return;
    try {
      await db.rechnungen.delete(id);
      App.toast('Gelöscht', 'success');
      this.listeAnzeigen();
    } catch (err) {
      App.toast('Fehler', 'error');
    }
  },

  statusInfo(status) {
    const map = {
      'offen': { label: 'Offen', badgeClass: 'badge-warning' },
      'versendet': { label: 'Versendet', badgeClass: 'badge-info' },
      'eingegangen': { label: 'Eingegangen', badgeClass: 'badge-primary' },
      'bezahlt': { label: 'Bezahlt', badgeClass: 'badge-success' }
    };
    return map[status] || map['offen'];
  },

  naechsterStatus(status) {
    const flow = { 'offen': 'versendet', 'versendet': 'eingegangen', 'eingegangen': 'bezahlt' };
    return flow[status] || 'versendet';
  },

  naechsterStatusLabel(status) {
    const labels = {
      'offen': '📤 Als versendet markieren',
      'versendet': '📥 Als eingegangen markieren',
      'eingegangen': '✅ Als bezahlt markieren'
    };
    return labels[status] || '📤 Versenden';
  },

  versandartLabel(art) {
    const labels = { 'fax': 'Fax (Sipgate)', 'brief': 'Brief (LetterXpress)', 'webmail': 'Webmail' };
    return labels[art] || art;
  }
};

document.addEventListener('DOMContentLoaded', () => {
  RechnungModule.init();
});
