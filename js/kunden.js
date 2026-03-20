/**
 * Kundenverwaltung für Susi's Alltagshilfe
 */

const KundenModule = {
  currentKunde: null,

  async init() {
    await this.listeAnzeigen();
    this.setupEventListeners();
  },

  setupEventListeners() {
    // Suche
    const searchInput = document.getElementById('kundenSuche');
    if (searchInput) {
      searchInput.addEventListener('input', App.debounce((e) => {
        this.listeAnzeigen(e.target.value);
      }));
    }

    // Formular
    const form = document.getElementById('kundeForm');
    if (form) {
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        this.speichern();
      });
    }
  },

  async listeAnzeigen(suchbegriff = '') {
    const container = document.getElementById('kundenListe');
    if (!container) return;

    let kunden;
    if (suchbegriff) {
      kunden = await DB.kundenSuchen(suchbegriff);
    } else {
      kunden = await DB.alleKunden();
    }

    if (kunden.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">👥</div>
          <p>${suchbegriff ? 'Keine Kunden gefunden' : 'Noch keine Kunden angelegt'}</p>
          <button class="btn btn-primary" onclick="KundenModule.neuerKunde()">
            + Neuer Kunde
          </button>
        </div>
      `;
      return;
    }

    container.innerHTML = kunden.map(kunde => `
      <div class="list-item" onclick="KundenModule.detailAnzeigen(${kunde.id})">
        <div class="item-avatar">${App.initialen(kunde.name)}</div>
        <div class="item-content">
          <div class="item-title">${this.escapeHtml(kunde.name)}</div>
          <div class="item-subtitle">
            ${kunde.pflegekasse || ''} ${kunde.pflegegrad ? '| PG ' + kunde.pflegegrad : ''}
            ${kunde.besonderheiten ? '| ' + this.escapeHtml(kunde.besonderheiten) : ''}
          </div>
        </div>
        <div class="item-action">›</div>
      </div>
    `).join('');
  },

  neuerKunde() {
    this.currentKunde = null;
    this.formAnzeigen();
  },

  async detailAnzeigen(id) {
    const kunde = await DB.kundeById(id);
    if (!kunde) {
      App.toast('Kunde nicht gefunden', 'error');
      return;
    }
    this.currentKunde = kunde;
    this.formAnzeigen(kunde);
  },

  formAnzeigen(kunde = null) {
    const container = document.getElementById('kundenContent');
    if (!container) return;

    const kassenOptions = PFLEGEKASSEN.map(k =>
      `<option value="${k.name}" ${kunde && kunde.pflegekasse === k.name ? 'selected' : ''}>${k.name}</option>`
    ).join('');

    container.innerHTML = `
      <form id="kundeForm" onsubmit="event.preventDefault(); KundenModule.speichern();">
        <div class="card">
          <h3 class="card-title mb-2">${kunde ? 'Kunde bearbeiten' : 'Neuer Kunde'}</h3>

          <div class="form-group">
            <label for="kundeName">Name *</label>
            <input type="text" id="kundeName" class="form-control" required
                   value="${kunde ? this.escapeHtml(kunde.name) : ''}"
                   placeholder="Vor- und Nachname">
          </div>

          <div class="form-row">
            <div class="form-group">
              <label for="kundeStrasse">Straße</label>
              <input type="text" id="kundeStrasse" class="form-control"
                     value="${kunde ? this.escapeHtml(kunde.strasse || '') : ''}"
                     placeholder="Straße und Hausnr.">
            </div>
            <div class="form-group">
              <label for="kundePlz">PLZ</label>
              <input type="text" id="kundePlz" class="form-control"
                     value="${kunde ? this.escapeHtml(kunde.plz || '') : ''}"
                     placeholder="45525" maxlength="5">
            </div>
          </div>

          <div class="form-row">
            <div class="form-group">
              <label for="kundeOrt">Ort</label>
              <input type="text" id="kundeOrt" class="form-control"
                     value="${kunde ? this.escapeHtml(kunde.ort || '') : ''}"
                     placeholder="Hattingen">
            </div>
            <div class="form-group">
              <label for="kundeGeburtstag">Geburtstag</label>
              <input type="date" id="kundeGeburtstag" class="form-control"
                     value="${kunde ? (kunde.geburtstag || '') : ''}">
            </div>
          </div>

          <div class="form-row">
            <div class="form-group">
              <label for="kundeTelefon">Telefon</label>
              <input type="tel" id="kundeTelefon" class="form-control"
                     value="${kunde ? this.escapeHtml(kunde.telefon || '') : ''}"
                     placeholder="02324 ...">
            </div>
            <div class="form-group">
              <label for="kundeEmail">E-Mail</label>
              <input type="email" id="kundeEmail" class="form-control"
                     value="${kunde ? this.escapeHtml(kunde.email || '') : ''}">
            </div>
          </div>
        </div>

        <div class="card">
          <h3 class="card-title mb-2">Versicherungsdaten</h3>

          <div class="form-group">
            <label for="kundeVersNr">Versichertennummer</label>
            <input type="text" id="kundeVersNr" class="form-control"
                   value="${kunde ? this.escapeHtml(kunde.versichertennummer || '') : ''}"
                   placeholder="Versichertennummer">
          </div>

          <div class="form-group">
            <label for="kundePflegekasse">Pflegekasse</label>
            <select id="kundePflegekasse" class="form-control">
              <option value="">-- Bitte wählen --</option>
              ${kassenOptions}
            </select>
          </div>

          <div class="form-group">
            <label for="kundeFaxKasse">Faxnummer der Kasse</label>
            <input type="tel" id="kundeFaxKasse" class="form-control"
                   value="${kunde ? this.escapeHtml(kunde.faxKasse || '') : ''}"
                   placeholder="Faxnummer">
          </div>

          <div class="form-group">
            <label for="kundePflegegrad">Pflegegrad</label>
            <select id="kundePflegegrad" class="form-control">
              <option value="">-- Bitte wählen --</option>
              ${[1,2,3,4,5].map(pg =>
                `<option value="${pg}" ${kunde && kunde.pflegegrad == pg ? 'selected' : ''}>Pflegegrad ${pg}</option>`
              ).join('')}
            </select>
          </div>

          <div class="form-group">
            <label for="kundeBesonderheiten">Besonderheiten</label>
            <textarea id="kundeBesonderheiten" class="form-control" rows="3"
                      placeholder="z.B. 50% LBV, besondere Hinweise...">${kunde ? this.escapeHtml(kunde.besonderheiten || '') : ''}</textarea>
          </div>
        </div>

        <div class="btn-group">
          <button type="submit" class="btn btn-primary btn-block">
            ${kunde ? 'Speichern' : 'Anlegen'}
          </button>
          <button type="button" class="btn btn-secondary" onclick="KundenModule.zurueckZurListe()">
            Abbrechen
          </button>
          ${kunde ? `
            <button type="button" class="btn btn-danger" onclick="KundenModule.loeschen(${kunde.id})">
              Löschen
            </button>
          ` : ''}
        </div>
      </form>
    `;
  },

  async speichern() {
    const daten = {
      name: document.getElementById('kundeName').value.trim(),
      strasse: document.getElementById('kundeStrasse').value.trim(),
      plz: document.getElementById('kundePlz').value.trim(),
      ort: document.getElementById('kundeOrt').value.trim(),
      telefon: document.getElementById('kundeTelefon').value.trim(),
      email: document.getElementById('kundeEmail').value.trim(),
      versichertennummer: document.getElementById('kundeVersNr').value.trim(),
      pflegekasse: document.getElementById('kundePflegekasse').value,
      faxKasse: document.getElementById('kundeFaxKasse').value.trim(),
      pflegegrad: document.getElementById('kundePflegegrad').value,
      geburtstag: document.getElementById('kundeGeburtstag').value || null,
      besonderheiten: document.getElementById('kundeBesonderheiten').value.trim()
    };

    if (!daten.name) {
      App.toast('Bitte einen Namen eingeben', 'error');
      return;
    }

    try {
      if (this.currentKunde) {
        await DB.kundeAktualisieren(this.currentKunde.id, daten);
        App.toast('Kunde aktualisiert', 'success');
      } else {
        await DB.kundeHinzufuegen(daten);
        App.toast('Kunde angelegt', 'success');
      }
      this.zurueckZurListe();
    } catch (err) {
      console.error('Fehler beim Speichern:', err);
      App.toast('Fehler beim Speichern', 'error');
    }
  },

  async loeschen(id) {
    if (!await App.confirm('Diesen Kunden wirklich löschen? Alle zugehörigen Daten bleiben erhalten.')) return;

    try {
      await DB.kundeLoeschen(id);
      App.toast('Kunde gelöscht', 'success');
      this.zurueckZurListe();
    } catch (err) {
      console.error('Fehler beim Löschen:', err);
      App.toast('Fehler beim Löschen', 'error');
    }
  },

  zurueckZurListe() {
    this.currentKunde = null;
    const container = document.getElementById('kundenContent');
    if (container) {
      container.innerHTML = `
        <div class="search-bar">
          <span class="search-icon">🔍</span>
          <input type="text" id="kundenSuche" placeholder="Kunden suchen..." class="form-control"
                 style="padding-left: 44px; border-radius: 25px;">
        </div>
        <div id="kundenListe"></div>
      `;
      this.init();
    }
  },

  // HTML-Escape-Hilfsfunktion
  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
};

// Initialisierung wenn Seite geladen
document.addEventListener('DOMContentLoaded', () => {
  KundenModule.init();
});
