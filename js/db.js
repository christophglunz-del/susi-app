/**
 * Datenbank-Modul für Susi's Alltagshilfe
 * Verwendet Dexie.js als IndexedDB-Wrapper
 */

// Datenbank initialisieren
const db = new Dexie('SusiAlltagshilfe');

// Schema-Definition mit allen Stores und Indizes
db.version(1).stores({
  kunden: '++id, name, versichertennummer, pflegekasse, pflegegrad, strasse, plz, ort, telefon, email, faxKasse, besonderheiten, erstellt, aktualisiert',
  leistungen: '++id, kundeId, datum, startzeit, endzeit, betreuung, alltagsbegleitung, pflegebegleitung, hauswirtschaft, notizen, unterschrift, erstellt',
  fahrten: '++id, datum, wochentag, startAdresse, zielAdressen, strecken, gesamtKm, betrag, gpsTrack, erstellt',
  termine: '++id, kundeId, titel, datum, startzeit, endzeit, wiederkehrend, wiederholungsMuster, farbe, notizen, erstellt',
  abtretungen: '++id, kundeId, datum, ort, pflegekasse, unterschrift, pdfData, erstellt',
  rechnungen: '++id, kundeId, rechnungsnummer, monat, jahr, betrag, status, versandart, versandDatum, bezahltDatum, notizen, erstellt',
  settings: 'key'
});

db.version(2).stores({
  // v2: +geburtstag bei Kunden
  kunden: '++id, name, versichertennummer, pflegekasse, pflegegrad, strasse, plz, ort, telefon, email, faxKasse, geburtstag, besonderheiten, erstellt, aktualisiert',

  // Leistungsnachweise (freitext + objektLeistung als Felder, kein Index nötig)
  leistungen: '++id, kundeId, datum, startzeit, endzeit, betreuung, alltagsbegleitung, pflegebegleitung, hauswirtschaft, notizen, unterschrift, erstellt',

  // Fahrten
  fahrten: '++id, datum, wochentag, startAdresse, zielAdressen, strecken, gesamtKm, betrag, gpsTrack, erstellt',

  // Termine
  termine: '++id, kundeId, titel, datum, startzeit, endzeit, wiederkehrend, wiederholungsMuster, farbe, notizen, erstellt',

  // Abtretungserklärungen
  abtretungen: '++id, kundeId, datum, ort, pflegekasse, unterschrift, pdfData, erstellt',

  // Rechnungen
  rechnungen: '++id, kundeId, rechnungsnummer, monat, jahr, betrag, status, versandart, versandDatum, bezahltDatum, notizen, erstellt',

  // Einstellungen (Key-Value)
  settings: 'key'
});

db.version(3).stores({
  // v3: +lexofficeId bei Kunden und Rechnungen für Lexoffice-Integration
  kunden: '++id, name, versichertennummer, pflegekasse, pflegegrad, strasse, plz, ort, telefon, email, faxKasse, geburtstag, besonderheiten, lexofficeId, erstellt, aktualisiert',
  leistungen: '++id, kundeId, datum, startzeit, endzeit, betreuung, alltagsbegleitung, pflegebegleitung, hauswirtschaft, notizen, unterschrift, erstellt',
  fahrten: '++id, datum, wochentag, startAdresse, zielAdressen, strecken, gesamtKm, betrag, gpsTrack, erstellt',
  termine: '++id, kundeId, titel, datum, startzeit, endzeit, wiederkehrend, wiederholungsMuster, farbe, notizen, erstellt',
  abtretungen: '++id, kundeId, datum, ort, pflegekasse, unterschrift, pdfData, erstellt',
  rechnungen: '++id, kundeId, rechnungsnummer, monat, jahr, betrag, status, versandart, versandDatum, bezahltDatum, lexofficeInvoiceId, notizen, erstellt',
  settings: 'key'
});

// Standard-Firmendaten
const FIRMA = {
  name: "Susi's Alltagshilfe",
  inhaber: 'Susanne Schlosser',
  untertitel: 'Die freundliche Alltagshilfe',
  strasse: 'Kreisstraße 12',
  plz: '45525',
  ort: 'Hattingen',
  telefon: '01556 0117030',
  email: 'hallo@susisalltagshilfe.de',
  steuernummer: '323/5096/5116',
  ikNummer: '462524110',
  bank: 'N26',
  iban: 'DE73 1001 1001 2270 9718 12',
  stundensatz: 32.75,
  monatsBudget: 131.00,
  kmSatz: 0.30,
  kleinunternehmer: true,
  startAdresse: 'Kreisstraße 12, 45525 Hattingen'
};

// Pflegekassen-Verzeichnis
const PFLEGEKASSEN = [
  { name: 'AOK Nordwest', fax: '' },
  { name: 'Barmer', fax: '' },
  { name: 'DAK-Gesundheit', fax: '' },
  { name: 'Techniker Krankenkasse', fax: '' },
  { name: 'Knappschaft', fax: '' },
  { name: 'Novitas BKK', fax: '' },
  { name: 'energie-BKK', fax: '' },
  { name: 'IKK classic', fax: '' },
  { name: 'VIACTIV Krankenkasse', fax: '' },
  { name: 'BKK VBU', fax: '' },
  { name: 'Sonstige', fax: '' }
];

/**
 * Datenbank-Hilfsfunktionen
 */
const DB = {
  // --- Kunden ---
  async alleKunden() {
    return db.kunden.orderBy('name').toArray();
  },

  async kundeById(id) {
    return db.kunden.get(id);
  },

  async kundeHinzufuegen(kunde) {
    kunde.erstellt = new Date().toISOString();
    kunde.aktualisiert = new Date().toISOString();
    return db.kunden.add(kunde);
  },

  async kundeAktualisieren(id, daten) {
    daten.aktualisiert = new Date().toISOString();
    return db.kunden.update(id, daten);
  },

  async kundeLoeschen(id) {
    return db.kunden.delete(id);
  },

  async kundenSuchen(suchbegriff) {
    const lower = suchbegriff.toLowerCase();
    return db.kunden.filter(k =>
      k.name.toLowerCase().includes(lower) ||
      (k.ort && k.ort.toLowerCase().includes(lower)) ||
      (k.pflegekasse && k.pflegekasse.toLowerCase().includes(lower))
    ).toArray();
  },

  // --- Leistungen ---
  async alleLeistungen() {
    return db.leistungen.orderBy('datum').reverse().toArray();
  },

  async leistungenFuerKunde(kundeId) {
    return db.leistungen.where('kundeId').equals(kundeId).reverse().sortBy('datum');
  },

  async leistungenFuerMonat(monat, jahr) {
    const start = `${jahr}-${String(monat).padStart(2, '0')}-01`;
    const endMonat = monat === 12 ? 1 : monat + 1;
    const endJahr = monat === 12 ? jahr + 1 : jahr;
    const end = `${endJahr}-${String(endMonat).padStart(2, '0')}-01`;
    return db.leistungen.where('datum').between(start, end).toArray();
  },

  async leistungHinzufuegen(leistung) {
    leistung.erstellt = new Date().toISOString();
    return db.leistungen.add(leistung);
  },

  async leistungAktualisieren(id, daten) {
    return db.leistungen.update(id, daten);
  },

  async leistungLoeschen(id) {
    return db.leistungen.delete(id);
  },

  // --- Fahrten ---
  async alleFahrten() {
    return db.fahrten.orderBy('datum').reverse().toArray();
  },

  async fahrtenFuerWoche(startDatum) {
    const start = startDatum;
    const endDate = new Date(startDatum);
    endDate.setDate(endDate.getDate() + 7);
    const end = endDate.toISOString().split('T')[0];
    return db.fahrten.where('datum').between(start, end).toArray();
  },

  async fahrtHinzufuegen(fahrt) {
    fahrt.erstellt = new Date().toISOString();
    return db.fahrten.add(fahrt);
  },

  async fahrtAktualisieren(id, daten) {
    return db.fahrten.update(id, daten);
  },

  async fahrtLoeschen(id) {
    return db.fahrten.delete(id);
  },

  // --- Termine ---
  async alleTermine() {
    return db.termine.orderBy('datum').toArray();
  },

  async termineFuerDatum(datum) {
    return db.termine.where('datum').equals(datum).toArray();
  },

  async termineFuerWoche(startDatum) {
    const start = startDatum;
    const endDate = new Date(startDatum);
    endDate.setDate(endDate.getDate() + 7);
    const end = endDate.toISOString().split('T')[0];
    // Normale Termine + wiederkehrende
    const normale = await db.termine.where('datum').between(start, end).toArray();
    const wiederkehrend = await db.termine.where('wiederkehrend').equals(1).toArray();
    return [...normale, ...wiederkehrend];
  },

  async terminHinzufuegen(termin) {
    termin.erstellt = new Date().toISOString();
    return db.termine.add(termin);
  },

  async terminAktualisieren(id, daten) {
    return db.termine.update(id, daten);
  },

  async terminLoeschen(id) {
    return db.termine.delete(id);
  },

  // --- Abtretungen ---
  async alleAbtretungen() {
    return db.abtretungen.orderBy('datum').reverse().toArray();
  },

  async abtretungFuerKunde(kundeId) {
    return db.abtretungen.where('kundeId').equals(kundeId).toArray();
  },

  async abtretungHinzufuegen(abtretung) {
    abtretung.erstellt = new Date().toISOString();
    return db.abtretungen.add(abtretung);
  },

  async abtretungLoeschen(id) {
    return db.abtretungen.delete(id);
  },

  // --- Rechnungen ---
  async alleRechnungen() {
    return db.rechnungen.orderBy('erstellt').reverse().toArray();
  },

  async rechnungenFuerKunde(kundeId) {
    return db.rechnungen.where('kundeId').equals(kundeId).toArray();
  },

  async rechnungHinzufuegen(rechnung) {
    rechnung.erstellt = new Date().toISOString();
    return db.rechnungen.add(rechnung);
  },

  async rechnungAktualisieren(id, daten) {
    return db.rechnungen.update(id, daten);
  },

  // --- Settings ---
  async settingLesen(key) {
    const entry = await db.settings.get(key);
    return entry ? entry.value : null;
  },

  async settingSpeichern(key, value) {
    return db.settings.put({ key, value });
  },

  async alleSettings() {
    return db.settings.toArray();
  },

  // --- Export/Import ---
  async exportAlles() {
    const data = {
      kunden: await db.kunden.toArray(),
      leistungen: await db.leistungen.toArray(),
      fahrten: await db.fahrten.toArray(),
      termine: await db.termine.toArray(),
      abtretungen: await db.abtretungen.toArray(),
      rechnungen: await db.rechnungen.toArray(),
      settings: await db.settings.toArray(),
      exportDatum: new Date().toISOString(),
      version: 1
    };
    return JSON.stringify(data, null, 2);
  },

  async importAlles(jsonString) {
    const data = JSON.parse(jsonString);
    await db.transaction('rw', db.kunden, db.leistungen, db.fahrten, db.termine, db.abtretungen, db.rechnungen, db.settings, async () => {
      // Alte Daten löschen
      await db.kunden.clear();
      await db.leistungen.clear();
      await db.fahrten.clear();
      await db.termine.clear();
      await db.abtretungen.clear();
      await db.rechnungen.clear();
      await db.settings.clear();
      // Neue Daten einfügen
      if (data.kunden) await db.kunden.bulkAdd(data.kunden);
      if (data.leistungen) await db.leistungen.bulkAdd(data.leistungen);
      if (data.fahrten) await db.fahrten.bulkAdd(data.fahrten);
      if (data.termine) await db.termine.bulkAdd(data.termine);
      if (data.abtretungen) await db.abtretungen.bulkAdd(data.abtretungen);
      if (data.rechnungen) await db.rechnungen.bulkAdd(data.rechnungen);
      if (data.settings) await db.settings.bulkAdd(data.settings);
    });
  },

  // --- Statistiken ---
  async statistiken() {
    const kundenAnzahl = await db.kunden.count();
    const leistungenAnzahl = await db.leistungen.count();
    const offeneRechnungen = await db.rechnungen.where('status').equals('offen').count();
    const heute = new Date().toISOString().split('T')[0];
    const heuteTermine = await db.termine.where('datum').equals(heute).count();

    return {
      kunden: kundenAnzahl,
      leistungen: leistungenAnzahl,
      offeneRechnungen,
      heuteTermine
    };
  }
};

// Datenbank öffnen und Testdaten anlegen wenn leer
db.open().then(async () => {
  console.log('Datenbank erfolgreich geöffnet');

  // Testkunde anlegen wenn DB leer
  const count = await db.kunden.count();
  if (count === 0) {
    console.log('Erstbenutzung — Testkunde wird angelegt');
    await db.kunden.add({
      name: 'Erika Mustermann',
      strasse: 'Bahnhofstr. 15',
      plz: '45525',
      ort: 'Hattingen',
      telefon: '02324 12345',
      email: 'erika@example.de',
      versichertennummer: 'A123456789',
      pflegekasse: 'AOK Nordwest',
      pflegegrad: '2',
      faxKasse: '0800 1234567',
      besonderheiten: 'Testkunde — kann gelöscht werden',
      erstellt: new Date().toISOString(),
      aktualisiert: new Date().toISOString()
    });
  }
}).catch(err => {
  console.error('Datenbankfehler:', err);
});
