/**
 * Sipgate API-Client für Susi's Alltagshilfe
 *
 * Faxversand über die Sipgate REST-API (https://api.sipgate.com/v2/)
 * Auth: HTTP Basic (base64(tokenId:token))
 *
 * HINWEIS: Die Sipgate API unterstützt kein CORS aus dem Browser.
 * Der gleiche Proxy wie für Lexoffice wird verwendet (Port 8484),
 * Sipgate-Requests gehen über den Pfad /sipgate/...
 */

const SipgateAPI = {
  tokenId: null,
  token: null,
  faxlineId: 'f0',
  proxyUrl: null,
  baseUrl: 'https://api.sipgate.com/v2',

  /**
   * API-Client initialisieren — Token-ID, Token, Faxline-ID und Proxy-URL aus Einstellungen laden
   */
  async init() {
    this.tokenId = await DB.settingLesen('sipgate_token_id');
    this.token = await DB.settingLesen('sipgate_token');
    this.faxlineId = await DB.settingLesen('sipgate_faxline_id') || 'f0';
    this.proxyUrl = await DB.settingLesen('lexoffice_proxy_url');

    if (!this.tokenId || !this.token) {
      console.warn('Sipgate: Keine Zugangsdaten konfiguriert (Einstellungen → API-Einstellungen)');
      return false;
    }
    console.log('Sipgate API initialisiert' + (this.proxyUrl ? ' (via Proxy)' : ' (direkt)'));
    return true;
  },

  /**
   * Prüfen ob API konfiguriert ist
   */
  istKonfiguriert() {
    return !!(this.tokenId && this.token);
  },

  /**
   * Effektive URL berechnen (direkt oder via Proxy)
   */
  _buildUrl(endpoint) {
    if (this.proxyUrl) {
      // Proxy-URL: z.B. http://192.168.31.211:8484
      // Sipgate-Requests gehen über /sipgate/...
      const proxy = this.proxyUrl.replace(/\/+$/, '');
      return `${proxy}/sipgate/${endpoint}`;
    }
    return `${this.baseUrl}/${endpoint}`;
  },

  /**
   * Auth-Header für HTTP Basic Authentication
   */
  _authHeader() {
    return 'Basic ' + btoa(this.tokenId + ':' + this.token);
  },

  /**
   * Basis-Request mit Auth und Fehlerbehandlung
   * @param {string} endpoint - API-Endpunkt (z.B. "sessions/fax")
   * @param {string} method - HTTP-Methode (GET, POST)
   * @param {Object|null} body - Request-Body (wird als JSON gesendet)
   * @returns {Object} Geparste JSON-Antwort
   */
  async request(endpoint, method = 'GET', body = null) {
    if (!this.tokenId || !this.token) {
      throw new Error('Sipgate Zugangsdaten nicht konfiguriert. Bitte unter Einstellungen hinterlegen.');
    }

    const url = this._buildUrl(endpoint);
    const headers = {
      'Authorization': this._authHeader(),
      'Accept': 'application/json'
    };

    const options = { method, headers };

    if (body && (method === 'POST' || method === 'PUT')) {
      headers['Content-Type'] = 'application/json';
      options.body = JSON.stringify(body);
    }

    try {
      const response = await fetch(url, options);

      // Kein Inhalt
      if (response.status === 204) {
        return { success: true };
      }

      // Fehlerhafte Antworten
      if (!response.ok) {
        let fehlerText = `HTTP ${response.status}`;
        try {
          const fehlerBody = await response.json();
          if (fehlerBody.message) fehlerText += `: ${fehlerBody.message}`;
        } catch (e) {
          fehlerText += `: ${response.statusText}`;
        }
        throw new Error(`Sipgate API-Fehler: ${fehlerText}`);
      }

      // Manche Sipgate-Responses haben keinen Body (z.B. 202)
      const text = await response.text();
      if (!text) return { success: true, status: response.status };
      return JSON.parse(text);
    } catch (err) {
      if (err.name === 'TypeError' && err.message.includes('Failed to fetch')) {
        throw new Error(
          'Sipgate API nicht erreichbar. Mögliche Ursachen:\n' +
          '- CORS-Blockierung (Proxy-URL in Einstellungen konfigurieren)\n' +
          '- Keine Internetverbindung\n' +
          '- Zugangsdaten ungültig'
        );
      }
      throw err;
    }
  },

  /**
   * Fax versenden über Sipgate
   * @param {string} faxNummer - Faxnummer im Format +49...
   * @param {string} pdfBase64 - PDF-Inhalt als Base64-String
   * @param {string} dateiname - Dateiname für das PDF
   * @returns {Object} Sipgate-Antwort mit sessionId
   */
  async faxSenden(faxNummer, pdfBase64, dateiname) {
    const body = {
      faxlineId: this.faxlineId,
      recipient: faxNummer,
      filename: dateiname || 'Rechnung.pdf',
      base64Content: pdfBase64
    };

    console.log(`Sipgate: Fax senden an ${faxNummer}...`);
    const ergebnis = await this.request('sessions/fax', 'POST', body);
    console.log('Sipgate: Fax gesendet, Session:', ergebnis);
    return ergebnis;
  },

  /**
   * Fax-Status abfragen
   * @param {string} sessionId - Session-ID vom Fax-Versand
   * @returns {Object} Status-Informationen
   */
  async faxStatus(sessionId) {
    return this.request(`history/${sessionId}`);
  },

  /**
   * Faxnummer normalisieren: 0-Prefix zu +49 umwandeln
   * @param {string} nummer - Faxnummer (z.B. "0800123456" oder "+49800123456")
   * @returns {string} Normalisierte Nummer mit +49-Prefix
   */
  faxNummerNormalisieren(nummer) {
    if (!nummer) return '';
    // Leerzeichen, Bindestriche, Schrägstriche entfernen
    let clean = nummer.replace(/[\s\-\/\(\)]/g, '');
    // 00 am Anfang → +
    if (clean.startsWith('00')) {
      clean = '+' + clean.substring(2);
    }
    // 0 am Anfang → +49
    if (clean.startsWith('0')) {
      clean = '+49' + clean.substring(1);
    }
    // Falls kein + am Anfang, +49 voranstellen
    if (!clean.startsWith('+')) {
      clean = '+49' + clean;
    }
    return clean;
  }
};
