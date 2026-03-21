/**
 * LetterXpress API-Client für Susi's Alltagshilfe
 *
 * Kommunikation mit der LetterXpress REST-API v3 (http://api.letterxpress.de/v3/)
 * Auth: Username + API-Key als "auth"-Objekt im JSON-Body
 * Doku: lxp-api_dokumentation.pdf (Stand Dez. 2024)
 *
 * HINWEIS: Requests werden über den lokalen CORS-Proxy (Port 8484) geleitet.
 */

const LetterXpressAPI = {
  user: null,
  apiKey: null,
  proxyUrl: null,
  baseUrl: 'http://api.letterxpress.de/v3',

  async init() {
    this.user = await DB.settingLesen('letterxpress_user');
    this.apiKey = await DB.settingLesen('letterxpress_key');
    this.proxyUrl = await DB.settingLesen('lexoffice_proxy_url');

    if (!this.user || !this.apiKey) {
      console.warn('LetterXpress: Credentials nicht konfiguriert');
      return false;
    }
    console.log('LetterXpress API initialisiert' + (this.proxyUrl ? ' (via Proxy)' : ' (direkt)'));
    return true;
  },

  istKonfiguriert() {
    return !!(this.user && this.apiKey);
  },

  _buildUrl(endpoint) {
    if (this.proxyUrl) {
      const proxy = this.proxyUrl.replace(/\/+$/, '');
      return `${proxy}/letterxpress/${endpoint}`;
    }
    return `${this.baseUrl}/${endpoint}`;
  },

  /**
   * Auth-Objekt für jeden Request
   * @param {string} mode - 'test' oder 'live'
   */
  _authObj(mode = 'live') {
    return {
      username: this.user,
      apikey: this.apiKey,
      mode: mode
    };
  },

  /**
   * Basis-Request — LetterXpress nutzt immer JSON-Body mit auth-Objekt,
   * auch bei GET-Requests (via -d flag in curl)
   */
  async request(endpoint, method = 'GET', body = null, mode = 'live') {
    if (!this.user || !this.apiKey) {
      throw new Error('LetterXpress Credentials nicht konfiguriert.');
    }

    const url = this._buildUrl(endpoint);
    const requestBody = {
      auth: this._authObj(mode),
      ...(body || {})
    };

    const options = {
      method,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify(requestBody)
    };

    try {
      const response = await fetch(url, options);
      const data = await response.json();

      if (data.status && data.status !== 200 && data.status !== 'OK') {
        throw new Error(`LetterXpress: ${data.message || 'Fehler ' + data.status}`);
      }

      return data;
    } catch (err) {
      if (err.name === 'TypeError' && err.message.includes('Failed to fetch')) {
        throw new Error('LetterXpress API nicht erreichbar. Proxy-URL prüfen.');
      }
      throw err;
    }
  },

  /**
   * Brief versenden
   * POST /v3/printjobs
   *
   * @param {string} pdfBase64 - PDF als Base64-String
   * @param {Object} optionen
   * @param {boolean} optionen.farbe - Farbdruck (default: false = s/w)
   * @param {boolean} optionen.duplex - Doppelseitig (default: true)
   * @param {string} optionen.versandart - 'national' oder 'international'
   * @param {string} optionen.dateiname - Originaler Dateiname (optional)
   * @param {string} optionen.mode - 'test' oder 'live' (default: 'live')
   */
  async briefSenden(pdfBase64, optionen = {}) {
    // MD5-Checksum berechnen (Pflichtfeld)
    const checksum = await this._md5(pdfBase64);

    const letter = {
      base64_file: pdfBase64,
      base64_file_checksum: checksum,
      specification: {
        color: optionen.farbe ? '4' : '1',
        mode: optionen.duplex !== false ? 'duplex' : 'simplex',
        shipping: optionen.versandart === 'international' ? 'international' : 'national'
      }
    };

    if (optionen.dateiname) {
      letter.filename_original = optionen.dateiname;
    }

    const mode = optionen.mode || 'live';
    return this.request('printjobs', 'POST', { letter }, mode);
  },

  /**
   * Status eines Jobs abrufen
   * GET /v3/printjobs/(int)id
   */
  async briefStatus(jobId) {
    return this.request(`printjobs/${jobId}`, 'GET');
  },

  /**
   * Alle Jobs auflisten
   * GET /v3/printjobs
   * Optional mit Filter: ?filter=queue|hold|done|canceled|draft
   */
  async alleJobs(filter) {
    const endpoint = filter ? `printjobs?filter=${filter}` : 'printjobs';
    return this.request(endpoint, 'GET');
  },

  /**
   * Guthaben abfragen
   * GET /v3/balance
   */
  async guthaben() {
    return this.request('balance', 'GET');
  },

  /**
   * Preis berechnen
   * GET /v3/price
   */
  async preisBerechnen(seiten, farbe = false) {
    return this.request('price', 'GET', {
      letter: {
        specification: {
          pages: seiten,
          color: farbe ? '4' : '1',
          mode: 'simplex',
          shipping: 'national'
        }
      }
    });
  },

  /**
   * Job löschen (nur innerhalb 15 Min nach Übertragung, nicht bei Status "done")
   * DELETE /v3/printjobs/(int)id
   */
  async jobLoeschen(jobId) {
    return this.request(`printjobs/${jobId}`, 'DELETE');
  },

  /**
   * MD5-Checksum für Base64-String berechnen
   * Nutzt SubtleCrypto API im Browser
   */
  async _md5(base64String) {
    // SubtleCrypto hat kein MD5, daher einfache JS-Implementierung
    return this._md5Simple(base64String);
  },

  /**
   * Einfache MD5-Implementierung (für Checksummen)
   */
  _md5Simple(str) {
    function md5cycle(x, k) {
      let a = x[0], b = x[1], c = x[2], d = x[3];
      a = ff(a,b,c,d,k[0],7,-680876936);d = ff(d,a,b,c,k[1],12,-389564586);c = ff(c,d,a,b,k[2],17,606105819);b = ff(b,c,d,a,k[3],22,-1044525330);
      a = ff(a,b,c,d,k[4],7,-176418897);d = ff(d,a,b,c,k[5],12,1200080426);c = ff(c,d,a,b,k[6],17,-1473231341);b = ff(b,c,d,a,k[7],22,-45705983);
      a = ff(a,b,c,d,k[8],7,1770035416);d = ff(d,a,b,c,k[9],12,-1958414417);c = ff(c,d,a,b,k[10],17,-42063);b = ff(b,c,d,a,k[11],22,-1990404162);
      a = ff(a,b,c,d,k[12],7,1804603682);d = ff(d,a,b,c,k[13],12,-40341101);c = ff(c,d,a,b,k[14],17,-1502002290);b = ff(b,c,d,a,k[15],22,1236535329);
      a = gg(a,b,c,d,k[1],5,-165796510);d = gg(d,a,b,c,k[6],9,-1069501632);c = gg(c,d,a,b,k[11],14,643717713);b = gg(b,c,d,a,k[0],20,-373897302);
      a = gg(a,b,c,d,k[5],5,-701558691);d = gg(d,a,b,c,k[10],9,38016083);c = gg(c,d,a,b,k[15],14,-660478335);b = gg(b,c,d,a,k[4],20,-405537848);
      a = gg(a,b,c,d,k[9],5,568446438);d = gg(d,a,b,c,k[14],9,-1019803690);c = gg(c,d,a,b,k[3],14,-187363961);b = gg(b,c,d,a,k[8],20,1163531501);
      a = gg(a,b,c,d,k[13],5,-1444681467);d = gg(d,a,b,c,k[2],9,-51403784);c = gg(c,d,a,b,k[7],14,1735328473);b = gg(b,c,d,a,k[12],20,-1926607734);
      a = hh(a,b,c,d,k[5],4,-378558);d = hh(d,a,b,c,k[8],11,-2022574463);c = hh(c,d,a,b,k[11],16,1839030562);b = hh(b,c,d,a,k[14],23,-35309556);
      a = hh(a,b,c,d,k[1],4,-1530992060);d = hh(d,a,b,c,k[4],11,1272893353);c = hh(c,d,a,b,k[7],16,-155497632);b = hh(b,c,d,a,k[10],23,-1094730640);
      a = hh(a,b,c,d,k[13],4,681279174);d = hh(d,a,b,c,k[0],11,-358537222);c = hh(c,d,a,b,k[3],16,-722521979);b = hh(b,c,d,a,k[6],23,76029189);
      a = hh(a,b,c,d,k[9],4,-640364487);d = hh(d,a,b,c,k[12],11,-421815835);c = hh(c,d,a,b,k[15],16,530742520);b = hh(b,c,d,a,k[2],23,-995338651);
      a = ii(a,b,c,d,k[0],6,-198630844);d = ii(d,a,b,c,k[7],10,1126891415);c = ii(c,d,a,b,k[14],15,-1416354905);b = ii(b,c,d,a,k[5],21,-57434055);
      a = ii(a,b,c,d,k[12],6,1700485571);d = ii(d,a,b,c,k[3],10,-1894986606);c = ii(c,d,a,b,k[10],15,-1051523);b = ii(b,c,d,a,k[1],21,-2054922799);
      a = ii(a,b,c,d,k[8],6,1873313359);d = ii(d,a,b,c,k[15],10,-30611744);c = ii(c,d,a,b,k[6],15,-1560198380);b = ii(b,c,d,a,k[13],21,1309151649);
      a = ii(a,b,c,d,k[4],6,-145523070);d = ii(d,a,b,c,k[11],10,-1120210379);c = ii(c,d,a,b,k[2],15,718787259);b = ii(b,c,d,a,k[9],21,-343485551);
      x[0] = add32(a,x[0]);x[1] = add32(b,x[1]);x[2] = add32(c,x[2]);x[3] = add32(d,x[3]);
    }
    function cmn(q,a,b,x,s,t){a = add32(add32(a,q),add32(x,t));return add32((a<<s)|(a>>>(32-s)),b)}
    function ff(a,b,c,d,x,s,t){return cmn((b&c)|((~b)&d),a,b,x,s,t)}
    function gg(a,b,c,d,x,s,t){return cmn((b&d)|(c&(~d)),a,b,x,s,t)}
    function hh(a,b,c,d,x,s,t){return cmn(b^c^d,a,b,x,s,t)}
    function ii(a,b,c,d,x,s,t){return cmn(c^(b|(~d)),a,b,x,s,t)}
    function add32(a,b){return(a+b)&0xFFFFFFFF}

    const n = str.length;
    let state = [1732584193,-271733879,-1732584194,271733878], i;
    for(i=64;i<=n;i+=64){
      const k = [];
      for(let j=i-64;j<i;j+=4)
        k.push(str.charCodeAt(j)|(str.charCodeAt(j+1)<<8)|(str.charCodeAt(j+2)<<16)|(str.charCodeAt(j+3)<<24));
      md5cycle(state,k);
    }
    const tail = [];
    for(let j=i-64;j<n;j++) tail.push(str.charCodeAt(j));
    tail.push(0x80);
    while(tail.length<(tail.length<=56?56:120)) tail.push(0);
    const k = [];
    for(let j=0;j<tail.length;j+=4)
      k.push((tail[j]||0)|((tail[j+1]||0)<<8)|((tail[j+2]||0)<<16)|((tail[j+3]||0)<<24));
    k.push(n*8);k.push(0);
    md5cycle(state,k.slice(0,16));
    if(k.length>16) md5cycle(state,k.slice(16));

    const hex = '0123456789abcdef';
    let s = '';
    for(i=0;i<4;i++)
      for(let j=0;j<4;j++)
        s += hex.charAt((state[i]>>(j*8+4))&0xF) + hex.charAt((state[i]>>(j*8))&0xF);
    return s;
  }
};
