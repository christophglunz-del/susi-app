/**
 * Abtretungserklärung-Modul für Susi's Alltagshilfe
 */

const AbtretungModule = {
  signaturePad: null,

  async init() {
    await this.listeAnzeigen();
  },

  async listeAnzeigen() {
    const container = document.getElementById('abtretungContent');
    if (!container) return;

    const abtretungen = await DB.alleAbtretungen();
    const kunden = await DB.alleKunden();
    const kundenMap = {};
    kunden.forEach(k => kundenMap[k.id] = k);

    // Kunden ohne Abtretung markieren
    const kundenMitAbtretung = new Set(abtretungen.map(a => a.kundeId));

    container.innerHTML = `
      <div class="section-title"><span class="icon">📝</span> Bestehende Abtretungserklärungen</div>

      ${abtretungen.length === 0
        ? '<div class="card text-center text-muted">Noch keine Abtretungserklärungen vorhanden</div>'
        : abtretungen.map(a => {
            const kunde = kundenMap[a.kundeId];
            return `
              <div class="list-item" onclick="AbtretungModule.detailAnzeigen(${a.id})">
                <div class="item-avatar" style="background: var(--success-bg); color: var(--success);">
                  ${kunde ? App.initialen(kunde.name) : '?'}
                </div>
                <div class="item-content">
                  <div class="item-title">${kunde ? KundenModule.escapeHtml(kunde.name) : 'Unbekannt'}</div>
                  <div class="item-subtitle">
                    ${App.formatDatum(a.datum)} | ${a.ort || 'Hattingen'}
                    ${a.unterschrift ? ' | ✓ Unterschrieben' : ''}
                  </div>
                </div>
                <div class="item-action">›</div>
              </div>
            `;
          }).join('')
      }

      <div class="section-title mt-3"><span class="icon">👥</span> Kunden ohne Abtretung</div>

      ${kunden.filter(k => !kundenMitAbtretung.has(k.id)).length === 0
        ? '<div class="card text-center text-muted">Alle Kunden haben eine Abtretungserklärung</div>'
        : kunden.filter(k => !kundenMitAbtretung.has(k.id)).map(k => `
            <div class="list-item" onclick="AbtretungModule.neueAbtretung(${k.id})">
              <div class="item-avatar" style="background: var(--warning-bg); color: var(--warning);">
                ${App.initialen(k.name)}
              </div>
              <div class="item-content">
                <div class="item-title">${KundenModule.escapeHtml(k.name)}</div>
                <div class="item-subtitle">${k.pflegekasse || 'Keine Kasse hinterlegt'}</div>
              </div>
              <button class="btn btn-sm btn-primary" onclick="event.stopPropagation(); AbtretungModule.neueAbtretung(${k.id})">
                Erstellen
              </button>
            </div>
          `).join('')
      }
    `;
  },

  async neueAbtretung(kundeId) {
    const kunde = await DB.kundeById(kundeId);
    if (!kunde) {
      App.toast('Kunde nicht gefunden', 'error');
      return;
    }
    this.formAnzeigen(null, kunde);
  },

  async detailAnzeigen(id) {
    const abtretung = await db.abtretungen.get(id);
    if (!abtretung) return;
    const kunde = await DB.kundeById(abtretung.kundeId);
    this.formAnzeigen(abtretung, kunde);
  },

  formAnzeigen(abtretung = null, kunde = {}) {
    const container = document.getElementById('abtretungContent');
    if (!container) return;

    container.innerHTML = `
      <div class="card">
        <h3 class="card-title mb-2">
          ${abtretung ? 'Abtretungserklärung' : 'Neue Abtretungserklärung'}
        </h3>

        <div class="form-row">
          <div class="form-group">
            <label>Versicherte/r</label>
            <input type="text" class="form-control" value="${KundenModule.escapeHtml(kunde.name || '')}" readonly>
          </div>
          <div class="form-group">
            <label>Versichertennummer</label>
            <input type="text" class="form-control" value="${KundenModule.escapeHtml(kunde.versichertennummer || '')}" readonly>
          </div>
        </div>

        <div class="form-group">
          <label>Pflegekasse (Empfänger)</label>
          <input type="text" class="form-control" value="${KundenModule.escapeHtml(kunde.pflegekasse || '')}" readonly>
        </div>

        <div class="form-row">
          <div class="form-group">
            <label for="abtretungOrt">Ort</label>
            <input type="text" id="abtretungOrt" class="form-control"
                   value="${abtretung ? KundenModule.escapeHtml(abtretung.ort || 'Hattingen') : 'Hattingen'}">
          </div>
          <div class="form-group">
            <label for="abtretungDatum">Datum</label>
            <input type="date" id="abtretungDatum" class="form-control"
                   value="${abtretung ? abtretung.datum : App.heute()}">
          </div>
        </div>
      </div>

      <!-- Dokumentenvorschau -->
      <div class="doc-preview">
        <div class="doc-header">
          <h2>Vollmacht & Abtretungserklärung</h2>
          <p>zur Vertretung gegenüber der Pflegekasse sowie zur Direktabrechnung/Direktzahlung<br>
          (§&nbsp;39 SGB XI Verhinderungspflege und §&nbsp;45b SGB XI Entlastungsbetrag)</p>
        </div>

        <p style="margin: 8px 0; padding: 10px; background: var(--gray-50); border-radius: 8px;">
          <strong>Empfänger (Pflegekasse):</strong><br>
          ${KundenModule.escapeHtml(kunde.pflegekasse || '____________')}
        </p>

        <p><strong>1) Pflegebedürftige/versicherte Person</strong></p>
        <p style="margin: 8px 0; padding: 10px; background: var(--gray-50); border-radius: 8px;">
          Name, Vorname: <strong>${KundenModule.escapeHtml(kunde.name || '____________')}</strong><br>
          Anschrift: ${KundenModule.escapeHtml([kunde.strasse, kunde.plz, kunde.ort].filter(Boolean).join(', ') || '____________')}<br>
          Versichertennummer: ${KundenModule.escapeHtml(kunde.versichertennummer || '____________')}
        </p>

        <p><strong>2) Bevollmächtigte / Abtretungsempfängerin</strong></p>
        <p style="margin: 8px 0; padding: 10px; background: var(--gray-50); border-radius: 8px;">
          ${FIRMA.name} – ${FIRMA.inhaber}<br>
          ${FIRMA.strasse}, ${FIRMA.plz} ${FIRMA.ort}<br>
          IK-Nummer: ${FIRMA.ikNummer} · Angebots-ID: ${FIRMA.angebotsId || '080123F8M2'}
        </p>

        <hr style="border: none; border-top: 1px solid var(--gray-200); margin: 12px 0;">

        <p><strong>A) VOLLMACHT</strong></p>
        <p>Hiermit bevollmächtige ich, ${KundenModule.escapeHtml(kunde.name || '____________')}, die unter Ziffer 2 genannte Person, mich gegenüber meiner Pflegekasse in Angelegenheiten der Pflegeversicherung nach dem SGB XI zu vertreten, insbesondere für:</p>
        <ul style="margin: 4px 0; padding-left: 20px; font-size: 0.9em;">
          <li>Verhinderungspflege nach §&nbsp;39 SGB XI</li>
          <li>Entlastungsbetrag nach §&nbsp;45b SGB XI</li>
          <li>Entgegennahme von Schreiben/Bescheiden</li>
        </ul>
        <p style="font-size: 0.9em;">Diese Vollmacht umfasst ausdrücklich auch die Zustimmung zur Direktabrechnung und Direktzahlung. Sie gilt bis auf Widerruf.</p>

        <hr style="border: none; border-top: 1px solid var(--gray-200); margin: 12px 0;">

        <p><strong>B) ABTRETUNGSERKLÄRUNG (Direktzahlung)</strong></p>
        <p>Ich trete meinen Anspruch auf Erstattung/Auszahlung gegenüber meiner Pflegekasse aus §&nbsp;39 SGB XI und §&nbsp;45b SGB XI widerruflich und in voller Höhe an die Abtretungsempfängerin ab. Ich bitte die Pflegekasse, die Beträge direkt auf deren Bankverbindung zu überweisen.</p>

        <hr style="border: none; border-top: 1px solid var(--gray-200); margin: 12px 0;">

        <p><strong>C) EINWILLIGUNG ZUR AUSKUNFT / DATENÜBERMITTLUNG</strong></p>
        <p style="font-size: 0.9em;">Ich willige ein, dass meine Pflegekasse zur Bearbeitung der Abrechnungen die hierfür erforderlichen Informationen an die unter Ziffer 2 genannte Person übermitteln darf.</p>
      </div>

      <!-- Unterschrift -->
      <div class="card">
        <h3 class="card-title mb-2">Unterschrift Pflegebedürftige/r</h3>
        <div class="signature-wrapper">
          <canvas id="abtretungSignatur"></canvas>
          <div class="sig-placeholder">Hier unterschreiben</div>
        </div>
        <div id="abtretungSigActions" class="signature-actions"></div>
      </div>

      <div class="btn-group mt-2">
        <button class="btn btn-primary btn-block" onclick="AbtretungModule.speichern(${abtretung ? abtretung.id : 'null'}, ${kunde.id})">
          ${abtretung ? 'Aktualisieren' : 'Speichern'}
        </button>
        <button class="btn btn-outline" onclick="AbtretungModule.pdfErstellen(${abtretung ? abtretung.id : 'null'}, ${kunde.id})">
          📄 PDF erstellen
        </button>
        <button class="btn btn-secondary" onclick="AbtretungModule.listeAnzeigen()">
          Abbrechen
        </button>
        ${abtretung ? `
          <button class="btn btn-danger btn-sm" onclick="AbtretungModule.loeschen(${abtretung.id})">
            Löschen
          </button>
        ` : ''}
      </div>
    `;

    // Signatur initialisieren
    setTimeout(() => {
      this.signaturePad = initSignaturePad('abtretungSignatur', 'abtretungSigActions');
      if (abtretung && abtretung.unterschrift) {
        this.signaturePad.fromDataURL(abtretung.unterschrift);
      }
    }, 100);
  },

  async speichern(id, kundeId) {
    const daten = {
      kundeId,
      datum: document.getElementById('abtretungDatum').value,
      ort: document.getElementById('abtretungOrt').value.trim(),
      unterschrift: this.signaturePad ? this.signaturePad.toDataURL() : null
    };

    try {
      if (id) {
        await db.abtretungen.update(id, daten);
        App.toast('Abtretungserklärung aktualisiert', 'success');
      } else {
        await DB.abtretungHinzufuegen(daten);
        App.toast('Abtretungserklärung gespeichert', 'success');
      }
      this.listeAnzeigen();
    } catch (err) {
      console.error('Fehler:', err);
      App.toast('Fehler beim Speichern', 'error');
    }
  },

  async pdfErstellen(id, kundeId) {
    try {
      let abtretung;
      if (id) {
        abtretung = await db.abtretungen.get(id);
      } else {
        abtretung = {
          datum: document.getElementById('abtretungDatum').value,
          ort: document.getElementById('abtretungOrt').value.trim(),
          unterschrift: this.signaturePad ? this.signaturePad.toDataURL() : null
        };
      }

      const kunde = await DB.kundeById(kundeId);
      if (!kunde) {
        App.toast('Kunde nicht gefunden', 'error');
        return;
      }

      const doc = await PDFHelper.generateAbtretung(abtretung, kunde);
      const dateiname = `Abtretungserklaerung_${kunde.name.replace(/\s+/g, '_')}.pdf`;
      PDFHelper.download(doc, dateiname);
      App.toast('PDF erstellt', 'success');
    } catch (err) {
      console.error('PDF-Fehler:', err);
      App.toast('Fehler bei PDF-Erstellung', 'error');
    }
  },

  async loeschen(id) {
    if (!await App.confirm('Abtretungserklärung wirklich löschen?')) return;
    try {
      await DB.abtretungLoeschen(id);
      App.toast('Gelöscht', 'success');
      this.listeAnzeigen();
    } catch (err) {
      App.toast('Fehler', 'error');
    }
  }
};

document.addEventListener('DOMContentLoaded', () => {
  AbtretungModule.init();
});
