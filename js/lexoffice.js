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

  /**
   * Offene/überfällige Rechnungen aus Lexoffice laden (paginiert)
   */
  async getOffeneRechnungen() {
    const alle = [];
    let page = 0, totalPages = 1;
    while (page < totalPages) {
      const result = await this.request(`voucherlist?page=${page}&size=250&voucherType=invoice&voucherStatus=open`);
      if (result.content) alle.push(...result.content);
      totalPages = result.totalPages || 1;
      page++;
    }
    return alle;
  },

  /**
   * Alle Rechnungen aus Lexoffice laden (open + paidoff, getrennte API-Calls)
   */
  async getAlleRechnungen() {
    const alle = [];
    for (const status of ['open', 'paid']) {
      let page = 0, totalPages = 1;
      while (page < totalPages) {
        const result = await this.request(`voucherlist?page=${page}&size=250&voucherType=invoice&voucherStatus=${status}`);
        if (result.content) alle.push(...result.content);
        totalPages = result.totalPages || 1;
        page++;
      }
    }
    return alle;
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
   * Variante der Rechnung ermitteln basierend auf Kundendaten
   * @param {Object} kunde - Kundendatensatz
   * @returns {string} 'kasse' | 'privat' | 'lbv'
   */
  varianteErmitteln(kunde) {
    const besonderheiten = (kunde.besonderheiten || '').toLowerCase();
    if (besonderheiten.includes('lbv')) return 'lbv';
    if (!kunde.pflegekasse || kunde.pflegekasse === 'Sonstige') return 'privat';
    return 'kasse';
  },

  /**
   * Leistungszeitraum (erstes und letztes Datum) aus Leistungen ermitteln
   * @param {Array} leistungen - Array von Leistungsdatensätzen
   * @returns {{ start: string, end: string }} ISO-Datumsstrings
   */
  _leistungszeitraum(leistungen) {
    const daten = leistungen.map(l => l.datum).sort();
    return {
      start: daten[0],
      end: daten[daten.length - 1]
    };
  },

  /**
   * Fälligkeitsdatum berechnen (30 Tage ab heute)
   * @returns {string} Formatiertes Datum (DD.MM.YYYY)
   */
  _faelligkeitsDatum() {
    const d = new Date();
    d.setDate(d.getDate() + 30);
    return `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}.${d.getFullYear()}`;
  },

  /**
   * Lokale Rechnung + Leistungen in Lexoffice-Rechnungs-Format umwandeln
   *
   * Unterstützt drei Varianten:
   *   - 'kasse':  Kassenrechnung (Direktabrechnung an Pflegekasse)
   *   - 'privat': Privatrechnung (Selbstzahler, an Person)
   *   - 'lbv':    LBV-Splitting (Rechnung an Person, separates Anschreiben an Kasse)
   *
   * @param {Object} rechnung - Lokaler Rechnungsdatensatz
   * @param {Object} kunde - Kundendatensatz
   * @param {Array} leistungen - Leistungen des Monats für diesen Kunden
   * @param {string} [variante] - 'kasse', 'privat' oder 'lbv' (auto-detect wenn nicht angegeben)
   * @returns {Object} Rechnung im Lexoffice-API-Format
   */
  rechnungZuLexoffice(rechnung, kunde, leistungen, variante) {
    // Variante automatisch ermitteln falls nicht übergeben
    if (!variante) {
      variante = this.varianteErmitteln(kunde);
    }

    const zeitraum = this._leistungszeitraum(leistungen);
    const faelligkeitsDatum = this._faelligkeitsDatum();

    // Gesamtstunden für lineItem-Zusammenfassung
    let gesamtStunden = 0;
    leistungen.forEach(l => {
      gesamtStunden += App.stundenBerechnen(l.startzeit, l.endzeit);
    });

    // --- Adresse je nach Variante ---
    let address;
    if (variante === 'kasse') {
      // Kassenrechnung: Empfänger ist die Pflegekasse
      address = {
        name: kunde.pflegekasse || 'Pflegekasse',
        supplement: 'Pflegekasse'
      };
      if (kunde.pflegekasseAdresse) {
        address.supplement += `\n${kunde.pflegekasseAdresse}`;
      }
    } else {
      // Privat + LBV: Empfänger ist die Person direkt
      address = {
        name: kunde.name,
        street: kunde.strasse || '',
        zip: kunde.plz || '',
        city: kunde.ort || '',
        countryCode: 'DE'
      };
    }

    // Wenn Kunde eine Lexoffice-ID hat, als Kontakt-Referenz verwenden
    if (kunde.lexofficeId) {
      address.contactId = kunde.lexofficeId;
    }

    // --- Leistungsposition (eine zusammengefasste Zeile) ---
    let positionName, positionDescription;
    if (variante === 'kasse') {
      positionName = kunde.name;
      positionDescription = 'Betreuung im Alltag nach § 45b SGB XI';
    } else {
      // privat + lbv
      positionName = 'Alltagshilfe';
      positionDescription = 'Betreuung im Alltag';
    }

    const lineItems = [{
      type: 'custom',
      name: positionName,
      description: positionDescription,
      quantity: gesamtStunden,
      unitName: 'Stunde(n)',
      unitPrice: {
        currency: 'EUR',
        netAmount: FIRMA.stundensatz,
        taxRatePercentage: 0
      }
    }];

    // --- Remark je nach Variante ---
    let remark;
    if (variante === 'kasse') {
      remark = 'Die Abrechnung erfolgt im Rahmen der Direktabrechnung gemäß der vorliegenden ' +
        'Abtretungserklärung. Die Leistungen wurden nach § 45b SGB XI (Entlastungsbetrag) als ' +
        'anerkanntes Angebot zur Unterstützung im Alltag gemäß § 45a SGB XI erbracht. ' +
        'Die Abtretung der Ansprüche erfolgte nach § 13 SGB V i.\u202fV.\u202fm. § 190 BGB. ' +
        'Ich bitte um Überweisung auf die in der Rechnung genannte Bankverbindung.';
    } else {
      // privat + lbv
      remark = 'Vielen Dank für die gute Zusammenarbeit.';
    }

    // --- paymentTermLabel je nach Variante ---
    let paymentTermLabel;
    if (variante === 'kasse') {
      paymentTermLabel = `Ich bitte um umgehende Zahlung, spätestens jedoch bis zum ${faelligkeitsDatum} (§ 36 Abs. 2 SGB XI).`;
    } else {
      paymentTermLabel = `Ich bitte um umgehende Zahlung, spätestens jedoch bis zum ${faelligkeitsDatum}.`;
    }

    // --- Lexoffice-Rechnungsformat zusammenbauen ---
    const lexRechnung = {
      voucherDate: new Date().toISOString(),
      address,
      lineItems,
      totalPrice: {
        currency: 'EUR'
      },
      taxConditions: {
        taxType: 'vatfree',
        taxTypeNote: 'Umsatzsteuer wird nicht berechnet (§ 19 Abs. 1 UStG)'
      },
      title: 'Rechnung',
      introduction: 'Meine Leistungen stelle ich Ihnen wie folgt in Rechnung.',
      remark,
      shippingConditions: {
        shippingType: 'service',
        shippingDate: zeitraum.start + 'T00:00:00.000+01:00',
        shippingEndDate: zeitraum.end + 'T00:00:00.000+01:00'
      },
      paymentConditions: {
        paymentTermLabel,
        paymentTermDuration: 30
      }
    };

    return lexRechnung;
  },

  /**
   * LBV-Anschreiben an die Pflegekasse generieren (Kletzing-Sonderfall)
   *
   * Wird als separates Dokument erstellt — NICHT Teil der Lexoffice-Rechnung.
   * Die Lexoffice-Rechnung geht an die Person (wie Privatrechnung),
   * das Anschreiben geht an die Kasse mit dem Hinweis auf 50% LBV-Übernahme.
   *
   * @param {Object} rechnung - Lokaler Rechnungsdatensatz (mit rechnungsnummer, monat, jahr, betrag)
   * @param {Object} kunde - Kundendatensatz (mit name, versichertennummer, pflegekasse, etc.)
   * @returns {string} Textinhalt des LBV-Anschreibens
   */
  generateLBVAnschreiben(rechnung, kunde) {
    const zeitraum = `${App.monatsName(rechnung.monat)} ${rechnung.jahr}`;
    const halberBetrag = (rechnung.betrag / 2).toFixed(2).replace('.', ',');
    const gesamtBetrag = rechnung.betrag.toFixed(2).replace('.', ',');
    const rechnungsnummer = rechnung.rechnungsnummer || '(wird nach Finalisierung vergeben)';

    const text = [
      `${FIRMA.inhaber}`,
      `${FIRMA.name}`,
      `${FIRMA.strasse}`,
      `${FIRMA.plz} ${FIRMA.ort}`,
      `Tel.: ${FIRMA.telefon}`,
      `E-Mail: ${FIRMA.email}`,
      `IK-Nummer: ${FIRMA.ikNummer}`,
      '',
      `${kunde.pflegekasse || 'Pflegekasse'}`,
      `${kunde.pflegekasseAdresse || ''}`,
      '',
      `Datum: ${new Date().toLocaleDateString('de-DE')}`,
      '',
      `Betreff: Einreichung der Rechnung ${rechnungsnummer} zur Direktabrechnung gemäß § 45b SGB XI – ${kunde.name}, Vers.-Nr. ${kunde.versichertennummer || '-'}`,
      '',
      'Sehr geehrte Damen und Herren,',
      '',
      `anbei übersende ich Ihnen die Rechnung Nr. ${rechnungsnummer} über Leistungen ` +
        `der Betreuung im Alltag für den Leistungszeitraum ${zeitraum} ` +
        `in Höhe von ${gesamtBetrag} Euro zur Direktabrechnung.`,
      '',
      `Für ${kunde.name} (Vers.-Nr. ${kunde.versichertennummer || '-'}) liegt eine ` +
        'unterzeichnete Abtretungserklärung vor, auf deren Grundlage ich die Abrechnung ' +
        'direkt mit Ihnen vornehme.',
      '',
      'Die Abrechnung erfolgt im Rahmen der Direktabrechnung gemäß der vorliegenden ' +
        'Abtretungserklärung. Die Leistungen wurden nach § 45b SGB XI (Entlastungsbetrag) als ' +
        'anerkanntes Angebot zur Unterstützung im Alltag gemäß § 45a SGB XI erbracht. ' +
        'Die Abtretung der Ansprüche erfolgte nach § 13 SGB V i.\u202fV.\u202fm. § 190 BGB.',
      '',
      `Die Hälfte der Aufwendungen wird von der Landesbeamtenversorgung (LBV) übernommen. ` +
        `Ich bitte daher um Erstattung in Höhe von 50 % des Rechnungsbetrags, ` +
        `entsprechend ${halberBetrag} Euro.`,
      '',
      'Ich bitte um Überweisung auf folgende Bankverbindung:',
      `${FIRMA.bank} | IBAN: ${FIRMA.iban}`,
      `Kontoinhaberin: ${FIRMA.inhaber}`,
      '',
      'Mit freundlichen Grüßen',
      '',
      FIRMA.inhaber,
      FIRMA.name
    ].join('\n');

    return text;
  }
};
