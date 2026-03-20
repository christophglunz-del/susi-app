/**
 * Lexoffice API-Client für Susi's Alltagshilfe
 *
 * Kommunikation mit der Lexoffice REST-API (https://api.lexoffice.io/v1/)
 * Auth: Bearer Token (aus IndexedDB settings)
 * Rate Limit: max. 2 Requests/Sekunde
 *
 * HINWEIS: Die Lexoffice API unterstützt kein CORS aus dem Browser.
 * Für den Betrieb ohne Browser-Extension wird ein Proxy benötigt.
 * Die Proxy-URL kann in den Einstellungen konfiguriert werden.
 */

const LexofficeAPI = {
  apiKey: null,
  proxyUrl: null,
  baseUrl: 'https://api.lexoffice.io/v1',

  // Rate-Limiting: max. 2 Requests pro Sekunde
  _requestQueue: [],
  _lastRequestTime: 0,
  _processing: false,

  /**
   * API-Client initialisieren — API-Key und Proxy-URL aus Einstellungen laden
   */
  async init() {
    this.apiKey = await DB.settingLesen('lexoffice_api_key');
    this.proxyUrl = await DB.settingLesen('lexoffice_proxy_url');

    if (!this.apiKey) {
      console.warn('Lexoffice: Kein API-Key konfiguriert (Einstellungen → API-Einstellungen)');
      return false;
    }
    console.log('Lexoffice API initialisiert' + (this.proxyUrl ? ' (via Proxy)' : ' (direkt)'));
    return true;
  },

  /**
   * Prüfen ob API konfiguriert ist
   */
  istKonfiguriert() {
    return !!this.apiKey;
  },

  /**
   * Effektive URL berechnen (direkt oder via Proxy)
   */
  _buildUrl(endpoint) {
    if (this.proxyUrl) {
      // Proxy-URL: z.B. https://mein-proxy.example.com/lexoffice
      // Der Proxy leitet an https://api.lexoffice.io/v1/{endpoint} weiter
      const proxy = this.proxyUrl.replace(/\/+$/, '');
      return `${proxy}/${endpoint}`;
    }
    return `${this.baseUrl}/${endpoint}`;
  },

  /**
   * Rate-Limiting: Wartet bis der nächste Request erlaubt ist (mind. 500ms Abstand)
   */
  async _waitForRateLimit() {
    const jetzt = Date.now();
    const mindestAbstand = 500; // 2 req/s = 500ms Abstand
    const warteDauer = Math.max(0, mindestAbstand - (jetzt - this._lastRequestTime));

    if (warteDauer > 0) {
      await new Promise(resolve => setTimeout(resolve, warteDauer));
    }
    this._lastRequestTime = Date.now();
  },

  /**
   * Basis-Request mit Auth, Rate-Limiting und Fehlerbehandlung
   * @param {string} endpoint - API-Endpunkt (z.B. "contacts")
   * @param {string} method - HTTP-Methode (GET, POST, PUT)
   * @param {Object|null} body - Request-Body (wird als JSON gesendet)
   * @returns {Object} Geparste JSON-Antwort
   */
  async request(endpoint, method = 'GET', body = null) {
    if (!this.apiKey) {
      throw new Error('Lexoffice API-Key nicht konfiguriert. Bitte unter Einstellungen hinterlegen.');
    }

    await this._waitForRateLimit();

    const url = this._buildUrl(endpoint);
    const headers = {
      'Authorization': `Bearer ${this.apiKey}`,
      'Accept': 'application/json'
    };

    const options = { method, headers };

    if (body && (method === 'POST' || method === 'PUT')) {
      headers['Content-Type'] = 'application/json';
      options.body = JSON.stringify(body);
    }

    try {
      const response = await fetch(url, options);

      // Rate Limit überschritten → warten und erneut versuchen
      if (response.status === 429) {
        console.warn('Lexoffice Rate Limit erreicht, warte 2 Sekunden...');
        await new Promise(resolve => setTimeout(resolve, 2000));
        return this.request(endpoint, method, body);
      }

      // Kein Inhalt (z.B. nach DELETE oder finalize)
      if (response.status === 204) {
        return { success: true };
      }

      // Fehlerhafte Antworten
      if (!response.ok) {
        let fehlerText = `HTTP ${response.status}`;
        try {
          const fehlerBody = await response.json();
          if (fehlerBody.message) fehlerText += `: ${fehlerBody.message}`;
          if (fehlerBody.details) fehlerText += ` (${JSON.stringify(fehlerBody.details)})`;
        } catch (e) {
          fehlerText += `: ${response.statusText}`;
        }
        throw new Error(`Lexoffice API-Fehler: ${fehlerText}`);
      }

      return await response.json();
    } catch (err) {
      // Netzwerk-/CORS-Fehler abfangen
      if (err.name === 'TypeError' && err.message.includes('Failed to fetch')) {
        throw new Error(
          'Lexoffice API nicht erreichbar. Mögliche Ursachen:\n' +
          '- CORS-Blockierung (Proxy-URL in Einstellungen konfigurieren)\n' +
          '- Keine Internetverbindung\n' +
          '- API-Key ungültig'
        );
      }
      throw err;
    }
  },

  /**
   * Spezieller Request für Binärdaten (PDF-Download)
   */
  async requestBlob(endpoint) {
    if (!this.apiKey) {
      throw new Error('Lexoffice API-Key nicht konfiguriert.');
    }

    await this._waitForRateLimit();

    const url = this._buildUrl(endpoint);
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Accept': 'application/pdf'
      }
    });

    if (!response.ok) {
      throw new Error(`Lexoffice PDF-Download fehlgeschlagen: HTTP ${response.status}`);
    }

    return await response.blob();
  },

  // =============================================
  // Kontakte (Kunden)
  // =============================================

  /**
   * Kontakte abrufen (paginiert)
   * @param {number} page - Seitennummer (0-basiert)
   * @param {number} size - Einträge pro Seite (max. 250)
   * @returns {Object} { content: [...], totalPages, totalElements, ... }
   */
  async getContacts(page = 0, size = 100) {
    return this.request(`contacts?page=${page}&size=${size}&direction=ASC&property=name`);
  },

  /**
   * Einzelnen Kontakt abrufen
   * @param {string} id - Lexoffice Kontakt-ID (UUID)
   */
  async getContact(id) {
    return this.request(`contacts/${id}`);
  },

  /**
   * Kontakt nach Name suchen (über Filter-Endpoint)
   * @param {string} name - Suchbegriff
   */
  async searchContacts(name) {
    return this.request(`contacts?name=${encodeURIComponent(name)}`);
  },

  /**
   * Neuen Kontakt anlegen
   * @param {Object} data - Kontaktdaten im Lexoffice-Format
   * @returns {Object} { id, resourceUri, createdDate, updatedDate, version }
   */
  async createContact(data) {
    return this.request('contacts', 'POST', data);
  },

  /**
   * Kontakt aktualisieren
   * @param {string} id - Lexoffice Kontakt-ID
   * @param {Object} data - Aktualisierte Kontaktdaten (inkl. version!)
   */
  async updateContact(id, data) {
    return this.request(`contacts/${id}`, 'PUT', data);
  },

  // =============================================
  // Rechnungen
  // =============================================

  /**
   * Rechnung erstellen (als Entwurf)
   * @param {Object} data - Rechnungsdaten im Lexoffice-Format
   * @returns {Object} { id, resourceUri, createdDate, updatedDate, version }
   */
  async createInvoice(data) {
    return this.request('invoices', 'POST', data);
  },

  /**
   * Rechnung abrufen
   * @param {string} id - Lexoffice Rechnungs-ID (UUID)
   */
  async getInvoice(id) {
    return this.request(`invoices/${id}`);
  },

  /**
   * Rechnung finalisieren (festschreiben → Rechnungsnummer wird vergeben)
   * @param {string} id - Lexoffice Rechnungs-ID
   */
  async finalizeInvoice(id) {
    // Finalize gibt die documentFileId zurück
    return this.request(`invoices/${id}/document`, 'GET');
  },

  /**
   * Rechnungs-PDF herunterladen
   * @param {string} documentFileId - Document-File-ID aus finalizeInvoice
   * @returns {Blob} PDF als Blob
   */
  async getInvoicePdf(documentFileId) {
    return this.requestBlob(`files/${documentFileId}`);
  },

  // =============================================
  // Hilfsfunktionen: Datenformat-Konvertierung
  // =============================================

  /**
   * Lokalen Kunden-Datensatz in Lexoffice-Kontakt-Format umwandeln
   */
  kundeZuKontakt(kunde) {
    const kontakt = {
      version: 0,
      roles: {
        customer: {}
      },
      person: {
        salutation: '',
        firstName: kunde.name.split(' ').slice(0, -1).join(' ') || kunde.name,
        lastName: kunde.name.split(' ').slice(-1)[0] || ''
      },
      addresses: {
        billing: [{
          street: kunde.strasse || '',
          zip: kunde.plz || '',
          city: kunde.ort || '',
          countryCode: 'DE'
        }]
      },
      emailAddresses: kunde.email ? {
        business: [kunde.email]
      } : undefined,
      phoneNumbers: kunde.telefon ? {
        business: [kunde.telefon]
      } : undefined,
      note: [
        kunde.versichertennummer ? `VersNr: ${kunde.versichertennummer}` : '',
        kunde.pflegekasse ? `Kasse: ${kunde.pflegekasse}` : '',
        kunde.pflegegrad ? `PG: ${kunde.pflegegrad}` : '',
        kunde.besonderheiten || ''
      ].filter(Boolean).join(' | ')
    };

    return kontakt;
  },

  /**
   * Lexoffice-Kontakt in lokales Kunden-Format umwandeln
   */
  kontaktZuKunde(kontakt) {
    const person = kontakt.person || {};
    const billing = (kontakt.addresses && kontakt.addresses.billing && kontakt.addresses.billing[0]) || {};
    const emails = kontakt.emailAddresses || {};
    const phones = kontakt.phoneNumbers || {};

    return {
      name: [person.firstName, person.lastName].filter(Boolean).join(' '),
      strasse: billing.street || '',
      plz: billing.zip || '',
      ort: billing.city || '',
      telefon: (phones.business && phones.business[0]) || '',
      email: (emails.business && emails.business[0]) || '',
      lexofficeId: kontakt.id,
      lexofficeVersion: kontakt.version
    };
  },

  /**
   * Lokale Rechnung + Leistungen in Lexoffice-Rechnungs-Format umwandeln
   * Erstellt eine Rechnung an die Pflegekasse (nicht an den Kunden direkt)
   */
  rechnungZuLexoffice(rechnung, kunde, leistungen) {
    // Leistungspositionen aufbauen
    const positionen = leistungen.map(l => {
      const stunden = App.stundenBerechnen(l.startzeit, l.endzeit);
      const leistungsArten = [];
      if (l.betreuung) leistungsArten.push('Betreuung');
      if (l.alltagsbegleitung) leistungsArten.push('Alltagsbegleitung');
      if (l.pflegebegleitung) leistungsArten.push('Pflegebegleitung');
      if (l.hauswirtschaft) leistungsArten.push('Hauswirtschaft');
      if (l.freitext) leistungsArten.push(l.freitext);

      return {
        type: 'custom',
        name: `Entlastungsleistung ${App.formatDatum(l.datum)} (${leistungsArten.join(', ')})`,
        description: `${App.formatZeit(l.startzeit)} - ${App.formatZeit(l.endzeit)} Uhr, ${kunde.name}, VersNr: ${kunde.versichertennummer || '-'}`,
        quantity: stunden,
        unitName: 'Stunde',
        unitPrice: {
          currency: 'EUR',
          netAmount: FIRMA.stundensatz,
          taxRatePercentage: 0
        }
      };
    });

    // Lexoffice-Rechnungsformat
    const lexRechnung = {
      voucherDate: new Date().toISOString(),
      address: {
        // Empfänger ist die Pflegekasse (Freitext-Adresse)
        name: kunde.pflegekasse || 'Pflegekasse',
        supplement: `z.Hd. Leistungsabrechnung\nVers.: ${kunde.name}\nVersNr.: ${kunde.versichertennummer || '-'}`
      },
      lineItems: positionen,
      totalPrice: {
        currency: 'EUR'
      },
      taxConditions: {
        taxType: 'vatfree',
        taxTypeNote: 'Kleinunternehmer gemäß § 19 Abs. 1 UStG — keine Umsatzsteuer ausgewiesen.'
      },
      title: 'Rechnung',
      introduction: `Abrechnung Entlastungsleistungen nach § 45b SGB XI\nLeistungszeitraum: ${App.monatsName(rechnung.monat)} ${rechnung.jahr}\nIK-Nummer: ${FIRMA.ikNummer}`,
      remark: `Bitte überweisen Sie den Betrag auf:\n${FIRMA.bank} | IBAN: ${FIRMA.iban}\nKontoinhaberin: ${FIRMA.inhaber}\n\nVielen Dank!`,
      shippingConditions: {
        shippingType: 'none'
      }
    };

    // Wenn Kunde eine Lexoffice-ID hat, diese als Kontakt-Referenz verwenden
    if (kunde.lexofficeId) {
      lexRechnung.address.contactId = kunde.lexofficeId;
    }

    return lexRechnung;
  }
};
