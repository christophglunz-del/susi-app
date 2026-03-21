/**
 * Google Calendar Sync-Modul für Susi's Alltagshilfe
 *
 * Verwendet Google Identity Services (GIS) für OAuth2
 * und die Google Calendar API v3 für bidirektionalen Sync.
 *
 * Voraussetzung: Google Cloud Console Projekt mit:
 * - Calendar API aktiviert
 * - OAuth2 Client-ID (Web Application)
 * - Redirect URI: http://localhost:8080 (oder eigene Domain)
 *
 * Die Client-ID wird in den Einstellungen hinterlegt (settings store).
 */

const GCalSync = {
  // OAuth2 State
  tokenClient: null,
  accessToken: null,
  tokenExpiry: null,
  calendarId: 'primary',
  isInitialized: false,
  isSyncing: false,

  // Google API Endpoints
  API_BASE: 'https://www.googleapis.com/calendar/v3',
  SCOPES: 'https://www.googleapis.com/auth/calendar.events',

  /**
   * Modul initialisieren — prüft ob GIS-Library geladen ist
   * und ob eine Client-ID konfiguriert wurde.
   */
  async init() {
    const clientId = await DB.settingLesen('gcal_client_id');
    if (!clientId) {
      console.log('GCal: Keine Client-ID konfiguriert');
      return false;
    }

    // Gespeichertes Token laden
    const savedToken = await DB.settingLesen('gcal_access_token');
    const savedExpiry = await DB.settingLesen('gcal_token_expiry');
    if (savedToken && savedExpiry && new Date(savedExpiry) > new Date()) {
      this.accessToken = savedToken;
      this.tokenExpiry = new Date(savedExpiry);
    }

    // Kalender-ID laden (Standard: primary)
    const savedCalId = await DB.settingLesen('gcal_calendar_id');
    if (savedCalId) this.calendarId = savedCalId;

    // Warten bis GIS Library geladen ist
    if (typeof google === 'undefined' || !google.accounts) {
      console.warn('GCal: Google Identity Services Library nicht geladen');
      return false;
    }

    this.tokenClient = google.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: this.SCOPES,
      callback: (response) => this._onTokenResponse(response),
    });

    this.isInitialized = true;
    console.log('GCal: Initialisiert');
    return true;
  },

  /**
   * OAuth2 Login starten
   */
  async login() {
    if (!this.isInitialized) {
      const ok = await this.init();
      if (!ok) {
        App.toast('Google Client-ID fehlt — bitte in Einstellungen eintragen', 'error');
        return false;
      }
    }

    return new Promise((resolve) => {
      this._loginResolve = resolve;
      if (this.accessToken && this.tokenExpiry > new Date()) {
        // Token ist noch gültig
        resolve(true);
        return;
      }
      // Token anfordern (zeigt Google Login Popup)
      this.tokenClient.requestAccessToken({ prompt: '' });
    });
  },

  /**
   * Callback wenn Token empfangen wird
   */
  async _onTokenResponse(response) {
    if (response.error) {
      console.error('GCal OAuth Fehler:', response);
      App.toast('Google-Anmeldung fehlgeschlagen: ' + (response.error_description || response.error), 'error');
      if (this._loginResolve) this._loginResolve(false);
      return;
    }

    this.accessToken = response.access_token;
    // Token läuft nach expires_in Sekunden ab
    this.tokenExpiry = new Date(Date.now() + (response.expires_in * 1000));

    // Token in IndexedDB speichern
    await DB.settingSpeichern('gcal_access_token', this.accessToken);
    await DB.settingSpeichern('gcal_token_expiry', this.tokenExpiry.toISOString());

    console.log('GCal: Token erhalten, gültig bis', this.tokenExpiry);
    App.toast('Mit Google verbunden', 'success');

    if (this._loginResolve) this._loginResolve(true);

    // UI aktualisieren
    this._updateUI();
  },

  /**
   * Abmelden — Token widerrufen
   */
  async logout() {
    if (this.accessToken) {
      google.accounts.oauth2.revoke(this.accessToken, () => {
        console.log('GCal: Token widerrufen');
      });
    }
    this.accessToken = null;
    this.tokenExpiry = null;
    await DB.settingSpeichern('gcal_access_token', null);
    await DB.settingSpeichern('gcal_token_expiry', null);
    await DB.settingSpeichern('gcal_last_sync', null);
    App.toast('Google-Konto getrennt', 'info');
    this._updateUI();
  },

  /**
   * Prüfen ob verbunden
   */
  isConnected() {
    return !!(this.accessToken && this.tokenExpiry && this.tokenExpiry > new Date());
  },

  /**
   * Google Calendar API Aufruf
   */
  async _apiCall(endpoint, method = 'GET', body = null) {
    if (!this.isConnected()) {
      const ok = await this.login();
      if (!ok) throw new Error('Nicht angemeldet');
    }

    const url = `${this.API_BASE}${endpoint}`;
    const options = {
      method,
      headers: {
        'Authorization': `Bearer ${this.accessToken}`,
        'Content-Type': 'application/json',
      },
    };
    if (body) options.body = JSON.stringify(body);

    const response = await fetch(url, options);

    if (response.status === 401) {
      // Token abgelaufen — neu anfordern
      this.accessToken = null;
      const ok = await this.login();
      if (!ok) throw new Error('Token-Erneuerung fehlgeschlagen');
      // Retry
      options.headers['Authorization'] = `Bearer ${this.accessToken}`;
      const retry = await fetch(url, options);
      if (!retry.ok) throw new Error(`API-Fehler: ${retry.status}`);
      return retry.status === 204 ? null : await retry.json();
    }

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(`API-Fehler ${response.status}: ${err.error?.message || response.statusText}`);
    }

    return response.status === 204 ? null : await response.json();
  },

  // ─── Termine aus Google Calendar laden ──────────────────────────

  /**
   * Termine aus Google Calendar für einen Zeitraum laden
   */
  async termineVonGoogle(von, bis) {
    const params = new URLSearchParams({
      timeMin: new Date(von).toISOString(),
      timeMax: new Date(bis).toISOString(),
      singleEvents: 'true',
      orderBy: 'startTime',
      maxResults: '250',
    });

    const data = await this._apiCall(
      `/calendars/${encodeURIComponent(this.calendarId)}/events?${params}`
    );
    return data.items || [];
  },

  /**
   * Einzelnen Termin aus Google Calendar laden
   */
  async terminVonGoogle(eventId) {
    return this._apiCall(
      `/calendars/${encodeURIComponent(this.calendarId)}/events/${encodeURIComponent(eventId)}`
    );
  },

  // ─── Termine nach Google Calendar schreiben ─────────────────────

  /**
   * Lokalen Termin als Google Calendar Event formatieren
   */
  _zuGoogleEvent(termin, kundeName) {
    const event = {
      summary: termin.titel || kundeName || 'Termin',
      description: [
        termin.notizen || '',
        kundeName ? `Kunde: ${kundeName}` : '',
        `[susi-id:${termin.id}]`  // Marker für Sync-Zuordnung
      ].filter(Boolean).join('\n'),
    };

    // Datum + Zeit
    if (termin.startzeit && termin.datum) {
      event.start = {
        dateTime: `${termin.datum}T${termin.startzeit}:00`,
        timeZone: 'Europe/Berlin',
      };
      event.end = {
        dateTime: termin.endzeit
          ? `${termin.datum}T${termin.endzeit}:00`
          : `${termin.datum}T${termin.startzeit}:00`,
        timeZone: 'Europe/Berlin',
      };
    } else {
      // Ganztägig
      event.start = { date: termin.datum };
      event.end = { date: termin.datum };
    }

    // Wiederkehrende Termine
    if (termin.wiederkehrend && termin.wiederholungsMuster) {
      const wochentage = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];
      const wt = termin.wiederholungsMuster.wochentag;
      if (wt !== undefined && wochentage[wt]) {
        event.recurrence = [`RRULE:FREQ=WEEKLY;BYDAY=${wochentage[wt]}`];
      }
    }

    return event;
  },

  /**
   * Google Calendar Event zu lokalem Termin konvertieren
   */
  _vonGoogleEvent(event) {
    const termin = {
      titel: event.summary || '',
      notizen: (event.description || '').replace(/\[susi-id:\d+\]/g, '').trim(),
      gcalEventId: event.id,
      gcalUpdated: event.updated,
    };

    // Datum + Zeit parsen
    if (event.start.dateTime) {
      const start = new Date(event.start.dateTime);
      termin.datum = start.toISOString().split('T')[0];
      termin.startzeit = start.toTimeString().substring(0, 5);
    } else if (event.start.date) {
      termin.datum = event.start.date;
      termin.startzeit = '00:00';
    }

    if (event.end.dateTime) {
      const end = new Date(event.end.dateTime);
      termin.endzeit = end.toTimeString().substring(0, 5);
    } else {
      termin.endzeit = '';
    }

    // Susi-ID aus Description extrahieren (falls vorhanden)
    const match = (event.description || '').match(/\[susi-id:(\d+)\]/);
    if (match) {
      termin._susiId = parseInt(match[1]);
    }

    // Wiederkehrend?
    termin.wiederkehrend = !!(event.recurrence && event.recurrence.length > 0);
    termin.wiederholungsMuster = null;
    if (termin.wiederkehrend && event.recurrence) {
      const rule = event.recurrence[0] || '';
      const dayMatch = rule.match(/BYDAY=(\w{2})/);
      if (dayMatch) {
        const tagMap = { SU: 0, MO: 1, TU: 2, WE: 3, TH: 4, FR: 5, SA: 6 };
        termin.wiederholungsMuster = { wochentag: tagMap[dayMatch[1]] || 0 };
      }
    }

    return termin;
  },

  /**
   * Termin nach Google Calendar schreiben
   */
  async terminNachGoogle(termin, kundeName) {
    const event = this._zuGoogleEvent(termin, kundeName);

    if (termin.gcalEventId) {
      // Update bestehenden Event
      const updated = await this._apiCall(
        `/calendars/${encodeURIComponent(this.calendarId)}/events/${encodeURIComponent(termin.gcalEventId)}`,
        'PUT',
        event
      );
      return updated;
    } else {
      // Neuen Event erstellen
      const created = await this._apiCall(
        `/calendars/${encodeURIComponent(this.calendarId)}/events`,
        'POST',
        event
      );
      // gcalEventId lokal speichern
      if (created && created.id) {
        await DB.terminAktualisieren(termin.id, {
          gcalEventId: created.id,
          gcalUpdated: created.updated
        });
      }
      return created;
    }
  },

  /**
   * Termin aus Google Calendar löschen
   */
  async terminAusGoogle(gcalEventId) {
    try {
      await this._apiCall(
        `/calendars/${encodeURIComponent(this.calendarId)}/events/${encodeURIComponent(gcalEventId)}`,
        'DELETE'
      );
    } catch (err) {
      // 404 = schon gelöscht, OK
      if (!err.message.includes('404')) throw err;
    }
  },

  // ─── Bidirektionaler Sync ───────────────────────────────────────

  /**
   * Bidirektionaler Sync durchführen
   *
   * Strategie:
   * 1. Alle lokalen Termine laden
   * 2. Alle Google-Termine für +/- 3 Monate laden
   * 3. Zuordnung über gcalEventId (lokal) und [susi-id:X] (Google)
   * 4. Konflikte: Google gewinnt (da dort auch manuell editiert wird)
   */
  async sync() {
    if (this.isSyncing) {
      App.toast('Sync läuft bereits...', 'info');
      return;
    }

    if (!this.isConnected()) {
      const ok = await this.login();
      if (!ok) return;
    }

    this.isSyncing = true;
    this._updateUI();

    try {
      // Zeitraum: 1 Monat zurück, 3 Monate voraus
      const von = new Date();
      von.setMonth(von.getMonth() - 1);
      von.setDate(1);
      const bis = new Date();
      bis.setMonth(bis.getMonth() + 3);

      // Laden
      const [lokaleTermine, googleEvents] = await Promise.all([
        DB.alleTermine(),
        this.termineVonGoogle(von.toISOString(), bis.toISOString()),
      ]);

      const kunden = await DB.alleKunden();
      const kundenMap = {};
      kunden.forEach(k => kundenMap[k.id] = k);

      let hochgeladen = 0;
      let heruntergeladen = 0;
      let aktualisiert = 0;

      // Map: gcalEventId -> Google Event
      const googleMap = {};
      googleEvents.forEach(e => { googleMap[e.id] = e; });

      // Map: susiId -> Google Event (aus Description)
      const susiIdMap = {};
      googleEvents.forEach(e => {
        const match = (e.description || '').match(/\[susi-id:(\d+)\]/);
        if (match) susiIdMap[parseInt(match[1])] = e;
      });

      // 1. Lokale Termine → Google hochladen (wenn kein gcalEventId)
      for (const termin of lokaleTermine) {
        if (termin.gcalEventId) {
          // Schon verknüpft — prüfen ob Google-Version neuer ist
          const googleEvent = googleMap[termin.gcalEventId];
          if (googleEvent) {
            // Google → Lokal aktualisieren (Google gewinnt)
            const gUpdated = new Date(googleEvent.updated);
            const lUpdated = new Date(termin.gcalUpdated || '2000-01-01');
            if (gUpdated > lUpdated) {
              const updates = this._vonGoogleEvent(googleEvent);
              await DB.terminAktualisieren(termin.id, {
                titel: updates.titel,
                datum: updates.datum,
                startzeit: updates.startzeit,
                endzeit: updates.endzeit,
                notizen: updates.notizen,
                gcalUpdated: googleEvent.updated,
              });
              aktualisiert++;
            }
            // Aus Map entfernen (verarbeitet)
            delete googleMap[termin.gcalEventId];
          }
          // Wenn nicht mehr in Google → lokal lassen (wurde evtl. in Google gelöscht,
          // aber wir löschen nicht automatisch lokal)
        } else {
          // Prüfen ob über susi-id schon in Google existiert
          const existing = susiIdMap[termin.id];
          if (existing) {
            // Verknüpfung herstellen
            await DB.terminAktualisieren(termin.id, {
              gcalEventId: existing.id,
              gcalUpdated: existing.updated
            });
            delete googleMap[existing.id];
          } else {
            // Neuen Event in Google erstellen
            const kundeName = termin.kundeId && kundenMap[termin.kundeId]
              ? kundenMap[termin.kundeId].name : '';
            try {
              await this.terminNachGoogle(termin, kundeName);
              hochgeladen++;
            } catch (err) {
              console.warn('GCal Upload fehlgeschlagen:', termin.titel, err);
            }
          }
        }
      }

      // 2. Verbleibende Google-Events → Lokal anlegen (neue aus Google)
      for (const eventId of Object.keys(googleMap)) {
        const event = googleMap[eventId];
        // Nur Events die nicht von Susi kamen und keine abgesagten
        if (event.status === 'cancelled') continue;

        const termin = this._vonGoogleEvent(event);
        termin.erstellt = new Date().toISOString();
        try {
          await db.termine.add(termin);
          heruntergeladen++;
        } catch (err) {
          console.warn('GCal Import fehlgeschlagen:', event.summary, err);
        }
      }

      // Sync-Zeitpunkt speichern
      await DB.settingSpeichern('gcal_last_sync', new Date().toISOString());

      const msg = `Sync abgeschlossen: ${hochgeladen} hoch, ${heruntergeladen} runter, ${aktualisiert} aktualisiert`;
      console.log('GCal:', msg);
      App.toast(msg, 'success', 4000);

      // Kalender neu laden wenn TermineModule geladen
      if (typeof TermineModule !== 'undefined') {
        TermineModule.kalenderAnzeigen();
      }

    } catch (err) {
      console.error('GCal Sync Fehler:', err);
      App.toast('Sync-Fehler: ' + err.message, 'error');
    } finally {
      this.isSyncing = false;
      this._updateUI();
    }
  },

  // ─── UI-Elemente ────────────────────────────────────────────────

  /**
   * Sync-Status-Leiste für termine.html rendern
   */
  renderSyncBar() {
    const connected = this.isConnected();
    const syncBtn = this.isSyncing
      ? '<span class="gcal-spinner"></span> Synchronisiere...'
      : 'Jetzt synchronisieren';

    return `
      <div class="gcal-sync-bar" id="gcalSyncBar">
        <div class="gcal-status">
          <span class="gcal-icon">${connected ? '🟢' : '⚪'}</span>
          <span class="gcal-label">
            ${connected ? 'Google Calendar verbunden' : 'Google Calendar nicht verbunden'}
          </span>
        </div>
        <div class="gcal-actions">
          ${connected ? `
            <button class="btn btn-sm btn-primary" onclick="GCalSync.sync()" ${this.isSyncing ? 'disabled' : ''}>
              ${syncBtn}
            </button>
            <button class="btn btn-sm btn-outline" onclick="GCalSync.logout()">
              Trennen
            </button>
          ` : `
            <button class="btn btn-sm btn-primary" onclick="GCalSync.loginUndSync()">
              Verbinden
            </button>
          `}
        </div>
      </div>
    `;
  },

  /**
   * Login und danach direkt Sync starten
   */
  async loginUndSync() {
    const ok = await this.login();
    if (ok) {
      await this.sync();
    }
  },

  /**
   * UI-Elemente aktualisieren (ohne Kalender-Grid neu zu laden)
   */
  _updateUI() {
    const bar = document.getElementById('gcalSyncBar');
    if (bar) {
      bar.outerHTML = this.renderSyncBar();
    }
  },

  // ─── Einstellungen-UI (für settings.html) ──────────────────────

  /**
   * Google-Konto Karte für Einstellungen rendern
   */
  async renderSettingsCard() {
    const clientId = await DB.settingLesen('gcal_client_id') || '';
    const calendarId = await DB.settingLesen('gcal_calendar_id') || 'primary';
    const lastSync = await DB.settingLesen('gcal_last_sync');
    const connected = this.isConnected();

    return `
      <div class="card">
        <div class="card-header">
          <span class="card-title">Google Calendar</span>
          <span class="card-icon green">📅</span>
        </div>

        <div class="form-group">
          <label for="settGcalClientId">OAuth2 Client-ID</label>
          <input type="text" id="settGcalClientId" class="form-control"
                 value="${clientId}" placeholder="xxxxx.apps.googleusercontent.com">
          <div class="form-hint">
            Aus der <a href="https://console.cloud.google.com/apis/credentials" target="_blank"
            style="color: var(--primary);">Google Cloud Console</a> —
            OAuth 2.0 Client-ID (Webanwendung)
          </div>
        </div>

        <div class="form-group">
          <label for="settGcalCalendarId">Kalender-ID</label>
          <input type="text" id="settGcalCalendarId" class="form-control"
                 value="${calendarId}" placeholder="primary">
          <div class="form-hint">Standard: primary (Hauptkalender). Oder eine spezifische Kalender-E-Mail.</div>
        </div>

        <button class="btn btn-primary btn-block" onclick="GCalSync.einstellungenSpeichern()">
          Google Calendar Einstellungen speichern
        </button>

        <div class="mt-2 text-sm">
          <p>Status: ${connected
            ? '<span style="color: var(--success);">Verbunden</span>'
            : '<span style="color: var(--text-muted);">Nicht verbunden</span>'}
          </p>
          ${lastSync ? `<p>Letzter Sync: ${App.formatDatum(lastSync)} ${new Date(lastSync).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}</p>` : ''}
        </div>

        ${connected ? `
          <button class="btn btn-outline btn-block mt-1" onclick="GCalSync.logout(); SettingsModule.anzeigen();">
            Google-Konto trennen
          </button>
        ` : `
          <button class="btn btn-outline btn-block mt-1" onclick="GCalSync.loginUndSync()">
            Jetzt mit Google verbinden
          </button>
        `}

        <div class="form-hint mt-2">
          <strong>Einrichtung:</strong><br>
          1. <a href="https://console.cloud.google.com/" target="_blank" style="color: var(--primary);">Google Cloud Console</a> aufrufen<br>
          2. Neues Projekt erstellen oder vorhandenes nutzen<br>
          3. Google Calendar API aktivieren<br>
          4. OAuth-Zustimmungsbildschirm einrichten (Extern, Testuser hinzufügen)<br>
          5. Anmeldedaten > OAuth 2.0 Client-ID erstellen (Webanwendung)<br>
          6. Autorisierte JavaScript-Quellen: <code>http://localhost:8080</code><br>
          7. Client-ID hier eintragen
        </div>
      </div>
    `;
  },

  /**
   * Einstellungen speichern
   */
  async einstellungenSpeichern() {
    try {
      const clientId = document.getElementById('settGcalClientId').value.trim();
      const calendarId = document.getElementById('settGcalCalendarId').value.trim() || 'primary';

      await DB.settingSpeichern('gcal_client_id', clientId);
      await DB.settingSpeichern('gcal_calendar_id', calendarId);

      this.calendarId = calendarId;
      this.isInitialized = false; // Neuinitialisierung erzwingen

      App.toast('Google Calendar Einstellungen gespeichert', 'success');

      // Wenn Client-ID gesetzt, neu initialisieren
      if (clientId) {
        await this.init();
      }
    } catch (err) {
      console.error('GCal Einstellungen Fehler:', err);
      App.toast('Fehler beim Speichern', 'error');
    }
  },
};

// Automatisch initialisieren wenn DOM fertig
document.addEventListener('DOMContentLoaded', async () => {
  // Kurze Verzögerung damit GIS-Library Zeit zum Laden hat
  setTimeout(() => GCalSync.init(), 500);
});
