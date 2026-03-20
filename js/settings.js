/**
 * Einstellungen-Modul für Susi's Alltagshilfe
 */

const SettingsModule = {
  async init() {
    await this.anzeigen();
  },

  async anzeigen() {
    const container = document.getElementById('settingsContent');
    if (!container) return;

    // Gespeicherte Einstellungen laden
    const lexofficeKey = await DB.settingLesen('lexoffice_api_key') || '';
    const sipgateUser = await DB.settingLesen('sipgate_user') || '';
    const sipgatePass = await DB.settingLesen('sipgate_pass') || '';
    const letterxpressUser = await DB.settingLesen('letterxpress_user') || '';
    const letterxpressKey = await DB.settingLesen('letterxpress_key') || '';

    // Statistiken
    const stats = await DB.statistiken();

    container.innerHTML = `
      <!-- Firmendaten -->
      <div class="card">
        <div class="card-header">
          <span class="card-title">Firmendaten</span>
          <span class="card-icon pink">🏠</span>
        </div>
        <div class="text-sm">
          <p><strong>${FIRMA.name}</strong></p>
          <p>${FIRMA.inhaber}</p>
          <p>${FIRMA.strasse}, ${FIRMA.plz} ${FIRMA.ort}</p>
          <p>Tel: ${FIRMA.telefon}</p>
          <p>E-Mail: ${FIRMA.email}</p>
          <p>StNr: ${FIRMA.steuernummer}</p>
          <p>IK: ${FIRMA.ikNummer}</p>
          <p>IBAN: ${FIRMA.iban} (${FIRMA.bank})</p>
          <p>Stundensatz: ${App.formatBetrag(FIRMA.stundensatz)}</p>
          <p>km-Satz: ${FIRMA.kmSatz.toFixed(2).replace('.', ',')} €/km</p>
          <p class="text-muted mt-1">Kleinunternehmer gem. § 19 Abs. 1 UStG</p>
        </div>
      </div>

      <!-- Statistiken -->
      <div class="card">
        <div class="card-header">
          <span class="card-title">Statistiken</span>
          <span class="card-icon blue">📊</span>
        </div>
        <div class="route-summary" style="margin-bottom: 0;">
          <div class="summary-item">
            <div class="summary-value">${stats.kunden}</div>
            <div class="summary-label">Kunden</div>
          </div>
          <div class="summary-item">
            <div class="summary-value">${stats.leistungen}</div>
            <div class="summary-label">Leistungen</div>
          </div>
          <div class="summary-item">
            <div class="summary-value">${stats.offeneRechnungen}</div>
            <div class="summary-label">Offene Rechnungen</div>
          </div>
        </div>
      </div>

      <!-- API-Schlüssel -->
      <div class="card">
        <div class="card-header">
          <span class="card-title">API-Einstellungen</span>
          <span class="card-icon orange">🔑</span>
        </div>

        <div class="form-group">
          <label for="settLexoffice">Lexoffice API-Key</label>
          <input type="password" id="settLexoffice" class="form-control"
                 value="${lexofficeKey}" placeholder="API-Schlüssel eingeben">
          <div class="form-hint">Für automatische Rechnungserstellung</div>
        </div>

        <div class="form-group">
          <label>Sipgate (Faxversand)</label>
          <div class="form-row">
            <input type="text" id="settSipgateUser" class="form-control"
                   value="${sipgateUser}" placeholder="Benutzername">
            <input type="password" id="settSipgatePass" class="form-control"
                   value="${sipgatePass}" placeholder="Passwort">
          </div>
        </div>

        <div class="form-group">
          <label>LetterXpress (Briefversand)</label>
          <div class="form-row">
            <input type="text" id="settLetterxpressUser" class="form-control"
                   value="${letterxpressUser}" placeholder="Benutzername">
            <input type="password" id="settLetterxpressKey" class="form-control"
                   value="${letterxpressKey}" placeholder="API-Key">
          </div>
        </div>

        <button class="btn btn-primary btn-block" onclick="SettingsModule.apiKeysSpeichern()">
          API-Einstellungen speichern
        </button>
      </div>

      <!-- Google OAuth (Platzhalter) -->
      <div class="card">
        <div class="card-header">
          <span class="card-title">Google-Konto</span>
          <span class="card-icon green">🔗</span>
        </div>
        <p class="text-sm text-muted mb-2">
          Für Google Calendar Sync und Google Drive Backup.
        </p>
        <button class="btn btn-outline btn-block" disabled>
          Google-Konto verbinden (in Planung)
        </button>
      </div>

      <!-- Datensicherung -->
      <div class="card">
        <div class="card-header">
          <span class="card-title">Datensicherung</span>
          <span class="card-icon pink">💾</span>
        </div>

        <div class="btn-group">
          <button class="btn btn-primary btn-block" onclick="SettingsModule.exportJSON()">
            📤 Alle Daten exportieren (JSON)
          </button>
        </div>

        <div class="form-group mt-2">
          <label for="importFile">Daten importieren</label>
          <input type="file" id="importFile" accept=".json"
                 class="form-control" onchange="SettingsModule.importJSON(event)">
          <div class="form-hint">⚠️ Überschreibt alle vorhandenen Daten!</div>
        </div>

        <button class="btn btn-outline btn-block mt-2" disabled>
          ☁️ Backup auf Google Drive (in Planung)
        </button>
      </div>

      <!-- Gefahrenzone -->
      <div class="card" style="border: 2px solid var(--danger);">
        <div class="card-header">
          <span class="card-title" style="color: var(--danger);">Gefahrenzone</span>
        </div>
        <button class="btn btn-danger btn-block" onclick="SettingsModule.alleDatenLoeschen()">
          🗑️ Alle Daten löschen
        </button>
        <div class="form-hint mt-1">Diese Aktion kann nicht rückgängig gemacht werden!</div>
      </div>

      <!-- App-Info -->
      <div class="card text-center text-sm text-muted">
        <p><strong>Susi's Alltagshilfe</strong></p>
        <p>Version 1.0.0</p>
        <p>PWA für Entlastungsleistungen nach § 45b SGB XI</p>
        <p class="mt-1">Made with ♥ für Susanne</p>
      </div>
    `;
  },

  async apiKeysSpeichern() {
    try {
      await DB.settingSpeichern('lexoffice_api_key', document.getElementById('settLexoffice').value);
      await DB.settingSpeichern('sipgate_user', document.getElementById('settSipgateUser').value);
      await DB.settingSpeichern('sipgate_pass', document.getElementById('settSipgatePass').value);
      await DB.settingSpeichern('letterxpress_user', document.getElementById('settLetterxpressUser').value);
      await DB.settingSpeichern('letterxpress_key', document.getElementById('settLetterxpressKey').value);
      App.toast('Einstellungen gespeichert', 'success');
    } catch (err) {
      console.error('Fehler:', err);
      App.toast('Fehler beim Speichern', 'error');
    }
  },

  async exportJSON() {
    try {
      const jsonStr = await DB.exportAlles();
      const blob = new Blob([jsonStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `susi_backup_${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      App.toast('Export erfolgreich', 'success');
    } catch (err) {
      console.error('Export-Fehler:', err);
      App.toast('Fehler beim Export', 'error');
    }
  },

  async importJSON(event) {
    const file = event.target.files[0];
    if (!file) return;

    if (!await App.confirm('ACHTUNG: Alle vorhandenen Daten werden überschrieben! Fortfahren?')) {
      event.target.value = '';
      return;
    }

    try {
      const text = await file.text();
      await DB.importAlles(text);
      App.toast('Import erfolgreich', 'success');
      this.anzeigen();
    } catch (err) {
      console.error('Import-Fehler:', err);
      App.toast('Fehler beim Import: ' + err.message, 'error');
    }
  },

  async alleDatenLoeschen() {
    if (!await App.confirm('ALLE Daten unwiderruflich löschen? Diese Aktion kann NICHT rückgängig gemacht werden!')) return;
    if (!await App.confirm('Wirklich ALLE Daten löschen? Letzte Chance!')) return;

    try {
      await db.kunden.clear();
      await db.leistungen.clear();
      await db.fahrten.clear();
      await db.termine.clear();
      await db.abtretungen.clear();
      await db.rechnungen.clear();
      App.toast('Alle Daten gelöscht', 'info');
      this.anzeigen();
    } catch (err) {
      App.toast('Fehler beim Löschen', 'error');
    }
  }
};

document.addEventListener('DOMContentLoaded', () => {
  SettingsModule.init();
});
