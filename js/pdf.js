/**
 * PDF-Generierung für Susi's Alltagshilfe
 * Verwendet jsPDF
 */

const PDFHelper = {
  // Standard-Schriften und -Farben
  PINK: [233, 30, 123],
  BLACK: [26, 26, 26],
  GRAY: [117, 117, 117],
  WHITE: [255, 255, 255],
  LIGHT_GRAY: [240, 240, 240],

  /**
   * Neues PDF-Dokument erstellen
   */
  createDoc(orientation = 'portrait') {
    const doc = new jspdf.jsPDF({
      orientation,
      unit: 'mm',
      format: 'a4'
    });
    doc.setFont('helvetica');
    return doc;
  },

  /**
   * Briefkopf mit Firmendaten
   */
  addLetterhead(doc) {
    const pageWidth = doc.internal.pageSize.getWidth();

    // Logo (falls geladen)
    if (this._logoData) {
      try {
        doc.addImage(this._logoData, 'JPEG', 15, 10, 18, 18);
      } catch (e) { /* Logo nicht verfügbar */ }
    }

    // Firmenname
    doc.setFontSize(16);
    doc.setTextColor(...this.PINK);
    doc.setFont('helvetica', 'bold');
    doc.text("Susi's Alltagshilfe", pageWidth / 2, 20, { align: 'center' });

    // Untertitel
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text('Die freundliche Alltagshilfe', pageWidth / 2, 26, { align: 'center' });

    // Adresszeile
    doc.setFontSize(8);
    doc.setTextColor(...this.GRAY);
    doc.text('Susanne Schlosser | Kreisstraße 12 | 45525 Hattingen | Tel: 01556 0117030 | hallo@susisalltagshilfe.de', pageWidth / 2, 32, { align: 'center' });

    // Trennlinie
    doc.setDrawColor(...this.PINK);
    doc.setLineWidth(0.5);
    doc.line(15, 35, pageWidth - 15, 35);

    return 40; // Y-Position nach Briefkopf
  },

  /**
   * Fußzeile
   */
  addFooter(doc) {
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();

    doc.setDrawColor(...this.PINK);
    doc.setLineWidth(0.3);
    doc.line(15, pageHeight - 20, pageWidth - 15, pageHeight - 20);

    doc.setFontSize(7);
    doc.setTextColor(...this.GRAY);
    doc.text(
      "Susi's Alltagshilfe | Susanne Schlosser | Kreisstr. 12 | 45525 Hattingen | StNr: 323/5096/5116 | IK: 462524110",
      pageWidth / 2, pageHeight - 16, { align: 'center' }
    );
    doc.text(
      'N26 | IBAN: DE73 1001 1001 2270 9718 12 | Kleinunternehmer gem. § 19 Abs. 1 UStG',
      pageWidth / 2, pageHeight - 12, { align: 'center' }
    );
  },

  /**
   * Leistungsnachweis-PDF generieren
   * Akzeptiert einzelne Leistung oder Array von Leistungen (Monatsübersicht)
   */
  async generateLeistungsnachweis(leistungOrArray, kunde) {
    const doc = this.createDoc();
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    let y = 15;

    const leistungen = Array.isArray(leistungOrArray) ? leistungOrArray : [leistungOrArray];

    // Titel
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...this.BLACK);
    doc.text('LEISTUNGSNACHWEIS', pageWidth / 2, y, { align: 'center' });
    y += 6;

    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.text(
      'Nachweis von Leistungen der Angebote zur Unterstützung im Alltag',
      pageWidth / 2, y, { align: 'center' }
    );
    y += 5;
    doc.text(
      'nach § 45b Abs. 1 Satz 3 Nr. 4 SGB XI',
      pageWidth / 2, y, { align: 'center' }
    );
    y += 10;

    // Info-Tabelle
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.text('Name des Versicherten:', 15, y);
    doc.setFont('helvetica', 'normal');
    doc.text(kunde.name || '', 70, y);
    y += 7;

    doc.setFont('helvetica', 'bold');
    doc.text('Versichertennummer:', 15, y);
    doc.setFont('helvetica', 'normal');
    doc.text(kunde.versichertennummer || '', 70, y);
    y += 7;

    doc.setFont('helvetica', 'bold');
    doc.text('Pflegekasse:', 15, y);
    doc.setFont('helvetica', 'normal');
    doc.text(kunde.pflegekasse || '', 70, y);
    y += 7;

    doc.setFont('helvetica', 'bold');
    doc.text('Pflegegrad:', 15, y);
    doc.setFont('helvetica', 'normal');
    doc.text(String(kunde.pflegegrad || ''), 70, y);
    y += 7;

    doc.setFont('helvetica', 'bold');
    doc.text('Leistungserbringer:', 15, y);
    doc.setFont('helvetica', 'normal');
    doc.text("Susi's Alltagshilfe - Kreisstr. 12 - 45525 Hattingen", 70, y);
    y += 7;

    doc.setFont('helvetica', 'bold');
    doc.text('IK-Nummer:', 15, y);
    doc.setFont('helvetica', 'normal');
    doc.text(FIRMA.ikNummer, 70, y);
    y += 12;

    // Leistungs-Tabelle Header
    doc.setFillColor(...this.PINK);
    doc.rect(15, y, pageWidth - 30, 8, 'F');
    doc.setTextColor(...this.WHITE);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.text('Datum', 17, y + 5.5);
    doc.text('Zeitraum', 45, y + 5.5);
    doc.text('Leistungen', 80, y + 5.5);
    doc.text('Stunden', 155, y + 5.5);
    doc.text('Betrag', 175, y + 5.5);
    y += 10;

    // Leistungszeilen
    doc.setTextColor(...this.BLACK);
    doc.setFont('helvetica', 'normal');
    let gesamtStunden = 0;
    let gesamtBetrag = 0;

    leistungen.forEach((leistung, idx) => {
      const leistungsArten = [];
      if (leistung.betreuung) leistungsArten.push('Betreuung');
      if (leistung.alltagsbegleitung) leistungsArten.push('Alltagsbegl.');
      if (leistung.pflegebegleitung) leistungsArten.push('Pflegebegl.');
      if (leistung.hauswirtschaft) leistungsArten.push('Hauswi.');
      if (leistung.objektInnen) leistungsArten.push('Obj.innen');
      if (leistung.objektAussen) leistungsArten.push('Obj.außen');
      if (leistung.freitext) leistungsArten.push(leistung.freitext);

      const stunden = App.stundenBerechnen(leistung.startzeit, leistung.endzeit);
      const betrag = App.betragBerechnen(stunden);
      gesamtStunden += stunden;
      gesamtBetrag += betrag;

      // Zeile mit abwechselndem Hintergrund
      if (idx % 2 === 0) {
        doc.setFillColor(...this.LIGHT_GRAY);
        doc.rect(15, y - 1, pageWidth - 30, 8, 'F');
      }
      doc.setFontSize(8);
      doc.text(App.formatDatum(leistung.datum), 17, y + 4);
      doc.text(`${App.formatZeit(leistung.startzeit)} - ${App.formatZeit(leistung.endzeit)}`, 45, y + 4);
      doc.text(leistungsArten.join(', '), 80, y + 4, { maxWidth: 70 });
      doc.text(stunden.toFixed(2).replace('.', ','), 155, y + 4);
      doc.text(App.formatBetrag(betrag), 175, y + 4);
      y += 9;

      // Seitenumbruch wenn nötig
      if (y > pageHeight - 60) {
        this.addFooter(doc);
        doc.addPage();
        y = 20;
      }
    });

    // Summenzeile
    doc.setDrawColor(...this.PINK);
    doc.setLineWidth(0.5);
    doc.line(15, y, pageWidth - 15, y);
    y += 6;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.text('Gesamt:', 130, y);
    doc.text(gesamtStunden.toFixed(2).replace('.', ',') + ' Std.', 155, y);
    doc.text(App.formatBetrag(gesamtBetrag), 175, y);
    y += 15;

    // Unterschrift (letzte Leistung mit Unterschrift verwenden)
    const mitUnterschrift = leistungen.find(l => l.unterschrift);
    if (mitUnterschrift) {
      y += 5;
      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      doc.text('Datum, Unterschrift des Versicherten:', 15, y);
      y += 3;

      try {
        doc.addImage(mitUnterschrift.unterschrift, 'PNG', 15, y, 60, 25);
      } catch (e) {
        console.warn('Unterschrift konnte nicht eingefügt werden:', e);
      }
      y += 28;

      doc.setDrawColor(...this.GRAY);
      doc.setLineWidth(0.2);
      doc.line(15, y, 80, y);
    }

    // Kleinunternehmer-Hinweis
    doc.setFontSize(7);
    doc.setTextColor(...this.GRAY);
    doc.text(
      'Gemäß § 19 Abs. 1 UStG wird keine Umsatzsteuer berechnet.',
      15, pageHeight - 25
    );

    this.addFooter(doc);
    return doc;
  },

  /**
   * Kilometeraufzeichnung Wochendossier PDF
   * (Alias für Rückwärtskompatibilität)
   */
  async generateFahrtenbuch(fahrten, wochenStart) {
    return this.generateKilometerWoche(fahrten, wochenStart);
  },

  async generateKilometerWoche(fahrten, wochenStart) {
    const doc = this.createDoc('landscape');
    const pageWidth = doc.internal.pageSize.getWidth();
    let y = this.addLetterhead(doc);

    // Titel
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...this.BLACK);
    doc.text('Kilometeraufzeichnung — Wochenübersicht', pageWidth / 2, y, { align: 'center' });
    y += 8;

    // Zeitraum
    const endDate = new Date(wochenStart);
    endDate.setDate(endDate.getDate() + 4);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(
      `Woche: ${App.formatDatum(wochenStart)} - ${App.formatDatum(endDate.toISOString().split('T')[0])}`,
      pageWidth / 2, y, { align: 'center' }
    );
    y += 12;

    // Tabelle Header
    const colWidths = [25, 60, 80, 50, 25, 30];
    const colX = [15];
    for (let i = 1; i < colWidths.length; i++) {
      colX.push(colX[i-1] + colWidths[i-1]);
    }
    const headers = ['Tag', 'Startadresse', 'Zieladresse(n)', 'Route', 'km', 'Betrag'];

    doc.setFillColor(...this.PINK);
    doc.rect(15, y, colWidths.reduce((a,b) => a+b), 8, 'F');
    doc.setTextColor(...this.WHITE);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    headers.forEach((h, i) => {
      doc.text(h, colX[i] + 2, y + 5.5);
    });
    y += 10;

    // Tabellenzeilen
    let gesamtKm = 0;
    let gesamtBetrag = 0;

    doc.setTextColor(...this.BLACK);
    doc.setFont('helvetica', 'normal');

    if (fahrten.length === 0) {
      doc.setFontSize(9);
      doc.text('Keine Fahrten in dieser Woche eingetragen.', 15, y + 5);
      y += 15;
    } else {
      fahrten.forEach((fahrt, idx) => {
        if (idx % 2 === 0) {
          doc.setFillColor(...this.LIGHT_GRAY);
          doc.rect(15, y - 1, colWidths.reduce((a,b) => a+b), 8, 'F');
        }
        doc.setFontSize(7);
        doc.text(App.wochentagKurz(fahrt.datum), colX[0] + 2, y + 4);
        doc.text(fahrt.startAdresse || FIRMA.startAdresse, colX[1] + 2, y + 4, { maxWidth: colWidths[1] - 4 });

        const ziele = (fahrt.zielAdressen || []).join(' > ');
        doc.text(ziele || '-', colX[2] + 2, y + 4, { maxWidth: colWidths[2] - 4 });
        doc.text(fahrt.routeBeschreibung || '', colX[3] + 2, y + 4, { maxWidth: colWidths[3] - 4 });

        const km = fahrt.gesamtKm || 0;
        const betrag = km * FIRMA.kmSatz;
        gesamtKm += km;
        gesamtBetrag += betrag;

        doc.text(km.toFixed(1), colX[4] + 2, y + 4);
        doc.text(App.formatBetrag(betrag), colX[5] + 2, y + 4);
        y += 9;
      });
    }

    // Summenzeile
    y += 3;
    doc.setDrawColor(...this.PINK);
    doc.setLineWidth(0.5);
    doc.line(15, y, 15 + colWidths.reduce((a,b) => a+b), y);
    y += 6;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.text('Gesamt:', colX[3] + 2, y);
    doc.text(gesamtKm.toFixed(1) + ' km', colX[4] + 2, y);
    doc.text(App.formatBetrag(gesamtBetrag), colX[5] + 2, y);
    y += 6;
    doc.text(`Kilometerpreis: ${FIRMA.kmSatz.toFixed(2).replace('.', ',')} €/km`, colX[3] + 2, y);

    this.addFooter(doc);
    return doc;
  },

  /**
   * Abtretungserklärung PDF
   */
  async generateAbtretung(abtretung, kunde) {
    const doc = this.createDoc();
    const pageWidth = doc.internal.pageSize.getWidth();
    let y = this.addLetterhead(doc);

    // Empfänger (Pflegekasse)
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...this.BLACK);
    doc.text(kunde.pflegekasse || 'Pflegekasse', 15, y);
    y += 5;
    if (kunde.faxKasse) {
      doc.text(`Fax: ${kunde.faxKasse}`, 15, y);
      y += 5;
    }
    y += 10;

    // Datum
    doc.text(`${abtretung.ort || 'Hattingen'}, den ${App.formatDatum(abtretung.datum)}`, pageWidth - 15, y, { align: 'right' });
    y += 15;

    // Titel
    doc.setFontSize(13);
    doc.setFont('helvetica', 'bold');
    doc.text('Abtretungserklärung', pageWidth / 2, y, { align: 'center' });
    y += 8;

    doc.setFontSize(11);
    doc.setFont('helvetica', 'normal');
    doc.text('gemäß § 45b Abs. 1 Satz 3 SGB XI', pageWidth / 2, y, { align: 'center' });
    y += 12;

    // Haupttext
    doc.setFontSize(10);
    doc.text('Hiermit trete ich,', 15, y);
    y += 8;

    // Versicherten-Daten
    doc.setFont('helvetica', 'bold');
    doc.text(kunde.name || '____________', 15, y); y += 5;
    doc.setFont('helvetica', 'normal');
    const gebDatum = kunde.geburtstag ? App.formatDatum(kunde.geburtstag) : '____________';
    doc.text(`geb. am ${gebDatum}`, 15, y); y += 5;
    const adresse = [kunde.strasse, kunde.plz, kunde.ort].filter(Boolean).join(', ') || '____________';
    doc.text(`wohnhaft: ${adresse}`, 15, y); y += 5;
    doc.text(`Versichertennummer: ${kunde.versichertennummer || '____________'}`, 15, y); y += 5;
    doc.text(`Pflegekasse: ${kunde.pflegekasse || '____________'}`, 15, y); y += 8;

    const text1 = 'den mir zustehenden Anspruch auf Erstattung von Aufwendungen im Rahmen des ' +
      'Entlastungsbetrages gemäß § 45b Abs. 1 Satz 3 SGB XI in Höhe von bis zu 125,00 Euro ' +
      'monatlich an den nachfolgend genannten zugelassenen Leistungserbringer ab:';
    const lines1 = doc.splitTextToSize(text1, pageWidth - 30);
    doc.text(lines1, 15, y);
    y += lines1.length * 5 + 10;

    // Leistungserbringer
    doc.setFont('helvetica', 'bold');
    doc.text('Leistungserbringer:', 15, y);
    y += 6;
    doc.setFont('helvetica', 'normal');
    doc.text(FIRMA.name, 15, y); y += 5;
    doc.text(FIRMA.inhaber, 15, y); y += 5;
    doc.text(FIRMA.strasse, 15, y); y += 5;
    doc.text(`${FIRMA.plz} ${FIRMA.ort}`, 15, y); y += 5;
    doc.text(`IK-Nummer: ${FIRMA.ikNummer}`, 15, y); y += 10;

    // Einverständnis
    const text2 = 'Ich erkläre mein Einverständnis, dass der Leistungserbringer die Abrechnung der ' +
      'von mir in Anspruch genommenen Leistungen direkt mit meiner Pflegekasse vornimmt.';
    const lines2 = doc.splitTextToSize(text2, pageWidth - 30);
    doc.text(lines2, 15, y);
    y += lines2.length * 5 + 8;

    const text3 = 'Diese Abtretungserklärung gilt bis auf Widerruf. Ein Widerruf ist jederzeit in Textform möglich.';
    const lines3 = doc.splitTextToSize(text3, pageWidth - 30);
    doc.text(lines3, 15, y);
    y += lines3.length * 5 + 25;

    // Unterschriften — Wert ÜBER der Linie, Beschriftung DARUNTER
    doc.setDrawColor(...this.GRAY);
    doc.setLineWidth(0.2);

    // Ort/Datum-Wert über der Linie
    doc.setFontSize(10);
    doc.text(`${abtretung.ort || 'Hattingen'}, ${App.formatDatum(abtretung.datum)}`, 15, y - 3);

    // Unterschriftsbild über der rechten Linie
    if (abtretung.unterschrift) {
      try {
        doc.addImage(abtretung.unterschrift, 'PNG', 110, y - 22, 60, 20);
      } catch (e) {
        console.warn('Unterschrift konnte nicht eingefügt werden:', e);
      }
    }

    // Linien
    doc.line(15, y, 80, y);
    doc.line(110, y, pageWidth - 15, y);

    // Beschriftungen unter der Linie
    doc.setFontSize(8);
    doc.text('Ort, Datum', 15, y + 4);
    doc.text('Unterschrift Pflegebedürftige/r', 110, y + 4);

    this.addFooter(doc);
    return doc;
  },

  /**
   * Rechnungsanschreiben PDF
   */
  async generateAnschreiben(rechnung, kunde, leistungen) {
    const doc = this.createDoc();
    const pageWidth = doc.internal.pageSize.getWidth();
    let y = this.addLetterhead(doc);

    // Empfänger
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...this.BLACK);
    doc.text(kunde.pflegekasse || 'Pflegekasse', 15, y);
    y += 5;
    if (kunde.faxKasse) {
      doc.text(`Fax: ${kunde.faxKasse}`, 15, y);
      y += 5;
    }
    y += 10;

    // Datum rechts
    doc.text(`Hattingen, den ${App.formatDatum(new Date().toISOString())}`, pageWidth - 15, y, { align: 'right' });
    y += 12;

    // Betreff
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.text(`Betr.: Abrechnung Entlastungsleistungen nach § 45b SGB XI`, 15, y);
    y += 6;
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(`Versicherte/r: ${kunde.name}`, 15, y);
    y += 5;
    doc.text(`Versichertennummer: ${kunde.versichertennummer || ''}`, 15, y);
    y += 5;
    doc.text(`Zeitraum: ${App.monatsName(rechnung.monat)} ${rechnung.jahr}`, 15, y);
    y += 12;

    // Anrede
    doc.text('Sehr geehrte Damen und Herren,', 15, y);
    y += 8;

    // Haupttext
    let text = `hiermit reiche ich die Abrechnung für die im o.g. Zeitraum erbrachten ` +
      `Entlastungsleistungen nach § 45b Abs. 1 Satz 3 Nr. 4 SGB XI für die/den ` +
      `oben genannte/n Versicherte/n ein.`;

    let lines = doc.splitTextToSize(text, pageWidth - 30);
    doc.text(lines, 15, y);
    y += lines.length * 5 + 8;

    text = `Die Leistungen wurden im Rahmen der Angebote zur Unterstützung im Alltag gemäß ` +
      `§ 45a SGB XI erbracht. Eine Abtretungserklärung der/des Versicherten liegt Ihnen vor.`;
    lines = doc.splitTextToSize(text, pageWidth - 30);
    doc.text(lines, 15, y);
    y += lines.length * 5 + 8;

    // Besonderheiten für Knappschaft
    if (kunde.besonderheiten && kunde.besonderheiten.includes('50% LBV')) {
      text = `Hinweis: Bei der/dem Versicherten besteht eine 50% Leistungsberechtigung ` +
        `für Verhinderungspflegemittel (LBV). Bitte berücksichtigen Sie dies bei der Abrechnung.`;
      lines = doc.splitTextToSize(text, pageWidth - 30);
      doc.setFont('helvetica', 'bold');
      doc.text(lines, 15, y);
      doc.setFont('helvetica', 'normal');
      y += lines.length * 5 + 8;
    }

    // Rechtsgrundlagen
    text = `Rechtsgrundlage: § 45b SGB XI (Entlastungsbetrag), § 45a SGB XI ` +
      `(Angebote zur Unterstützung im Alltag), § 13 Abs. 3 SGB V, § 190 BGB.`;
    lines = doc.splitTextToSize(text, pageWidth - 30);
    doc.setFontSize(8);
    doc.setTextColor(...this.GRAY);
    doc.text(lines, 15, y);
    doc.setFontSize(10);
    doc.setTextColor(...this.BLACK);
    y += lines.length * 4 + 8;

    // Rechnungsbetrag
    const gesamtBetrag = leistungen.reduce((sum, l) => {
      const std = App.stundenBerechnen(l.startzeit, l.endzeit);
      return sum + App.betragBerechnen(std);
    }, 0);

    doc.setFont('helvetica', 'bold');
    doc.text(`Rechnungsbetrag: ${App.formatBetrag(gesamtBetrag)}`, 15, y);
    y += 8;

    doc.setFont('helvetica', 'normal');
    doc.text('Bitte überweisen Sie den Betrag auf folgendes Konto:', 15, y);
    y += 6;
    doc.text(`Bank: ${FIRMA.bank}`, 15, y); y += 5;
    doc.text(`IBAN: ${FIRMA.iban}`, 15, y); y += 5;
    doc.text(`Kontoinhaber: ${FIRMA.inhaber}`, 15, y); y += 12;

    // Grußformel
    doc.text('Mit freundlichen Grüßen', 15, y);
    y += 12;
    doc.text('Susanne Schlosser', 15, y);
    y += 5;
    doc.setFontSize(8);
    doc.text("Susi's Alltagshilfe", 15, y);

    // Anlagen
    y += 12;
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.text('Anlagen:', 15, y);
    y += 5;
    doc.setFont('helvetica', 'normal');
    doc.text('- Leistungsnachweis(e)', 15, y);
    y += 4;
    doc.text('- Rechnung (Lexoffice)', 15, y);

    // Kleinunternehmer-Hinweis
    doc.setFontSize(7);
    doc.setTextColor(...this.GRAY);
    const pageHeight = doc.internal.pageSize.getHeight();
    doc.text(
      'Gemäß § 19 Abs. 1 UStG wird keine Umsatzsteuer berechnet.',
      15, pageHeight - 25
    );

    this.addFooter(doc);
    return doc;
  },

  /**
   * Kilometeraufzeichnung — Monatsauswertung (Querformat, kleine Schrift, viele Details)
   */
  async generateKilometerMonat(fahrten, monat, jahr) {
    const doc = this.createDoc('landscape');
    const pw = doc.internal.pageSize.getWidth();
    const ph = doc.internal.pageSize.getHeight();
    let y = 12;

    // Kompakter Header mit Logo-Hinweis
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...this.PINK);
    doc.text("Susi's Alltagshilfe — Kilometeraufzeichnung", pw / 2, y, { align: 'center' });
    y += 6;
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...this.GRAY);
    doc.text(`${FIRMA.inhaber} | ${FIRMA.strasse}, ${FIRMA.plz} ${FIRMA.ort} | IK: ${FIRMA.ikNummer}`, pw / 2, y, { align: 'center' });
    y += 4;
    doc.setDrawColor(...this.PINK);
    doc.setLineWidth(0.4);
    doc.line(10, y, pw - 10, y);
    y += 6;

    // Zeitraum
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...this.BLACK);
    doc.text(`${App.monatsName(monat)} ${jahr}`, pw / 2, y, { align: 'center' });
    y += 8;

    // Zusammenfassung
    let gesamtKm = 0, gesamtBetrag = 0, anzahlFahrten = fahrten.length;
    const tageSet = new Set();
    fahrten.forEach(f => {
      gesamtKm += f.gesamtKm || 0;
      gesamtBetrag += (f.gesamtKm || 0) * FIRMA.kmSatz;
      if (f.datum) tageSet.add(f.datum);
    });

    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...this.BLACK);
    const summaryText = `${anzahlFahrten} Fahrten | ${tageSet.size} Tage | ${gesamtKm.toFixed(1)} km gesamt | ${FIRMA.kmSatz.toFixed(2).replace('.', ',')} €/km | Gesamt: ${App.formatBetrag(gesamtBetrag)}`;
    doc.text(summaryText, pw / 2, y, { align: 'center' });
    y += 8;

    // Tabelle
    const cols = [
      { label: 'Nr.',      w: 10, x: 10 },
      { label: 'Datum',    w: 22, x: 20 },
      { label: 'Tag',      w: 14, x: 42 },
      { label: 'Start',    w: 50, x: 56 },
      { label: 'Ziel(e)',  w: 80, x: 106 },
      { label: 'Notiz',    w: 44, x: 186 },
      { label: 'km',       w: 16, x: 230 },
      { label: 'GPS km',   w: 16, x: 246 },
      { label: 'Betrag',   w: 22, x: 262 },
    ];

    // Header
    doc.setFillColor(...this.PINK);
    doc.rect(10, y, pw - 20, 6, 'F');
    doc.setTextColor(...this.WHITE);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.5);
    cols.forEach(c => doc.text(c.label, c.x + 1, y + 4.2));
    y += 7;

    // Zeilen
    doc.setTextColor(...this.BLACK);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6);

    fahrten.forEach((f, idx) => {
      // Seitenumbruch
      if (y > ph - 22) {
        this.addFooter(doc);
        doc.addPage('landscape');
        y = 12;
        // Header wiederholen
        doc.setFillColor(...this.PINK);
        doc.rect(10, y, pw - 20, 6, 'F');
        doc.setTextColor(...this.WHITE);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(6.5);
        cols.forEach(c => doc.text(c.label, c.x + 1, y + 4.2));
        y += 7;
        doc.setTextColor(...this.BLACK);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(6);
      }

      if (idx % 2 === 0) {
        doc.setFillColor(248, 248, 248);
        doc.rect(10, y - 1.5, pw - 20, 6, 'F');
      }

      const km = f.gesamtKm || 0;
      const betrag = km * FIRMA.kmSatz;
      const ziele = (f.zielAdressen || []).join(' → ');

      doc.text(String(idx + 1), cols[0].x + 1, y + 2.5);
      doc.text(App.formatDatum(f.datum), cols[1].x + 1, y + 2.5);
      doc.text(App.wochentagKurz(f.datum), cols[2].x + 1, y + 2.5);
      doc.text((f.startAdresse || FIRMA.startAdresse).substring(0, 30), cols[3].x + 1, y + 2.5);
      doc.text(ziele.substring(0, 48) || '-', cols[4].x + 1, y + 2.5);
      doc.text((f.notiz || '').substring(0, 26), cols[5].x + 1, y + 2.5);
      doc.text(km.toFixed(1), cols[6].x + 1, y + 2.5);
      doc.text(f.trackingKm ? f.trackingKm.toFixed(1) : '-', cols[7].x + 1, y + 2.5);
      doc.text(App.formatBetrag(betrag), cols[8].x + 1, y + 2.5);

      y += 6;
    });

    // Summenzeile
    y += 2;
    doc.setDrawColor(...this.PINK);
    doc.setLineWidth(0.5);
    doc.line(10, y, pw - 10, y);
    y += 5;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.text('GESAMT', cols[4].x + 1, y);
    doc.text(gesamtKm.toFixed(1) + ' km', cols[6].x + 1, y);
    doc.text(App.formatBetrag(gesamtBetrag), cols[8].x + 1, y);
    y += 6;
    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    doc.text(`Kilometerpreis: ${FIRMA.kmSatz.toFixed(2).replace('.', ',')} €/km | Fahrzeug: privater PKW | Kleinunternehmer gem. § 19 Abs. 1 UStG`, 10, y);

    // Wochenweise Aufschlüsselung
    y += 10;
    if (y < ph - 50) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.text('Wochenweise Aufschlüsselung:', 10, y);
      y += 5;

      // Nach KW gruppieren
      const wochen = {};
      fahrten.forEach(f => {
        const d = new Date(f.datum);
        d.setHours(0, 0, 0, 0);
        d.setDate(d.getDate() + 3 - (d.getDay() + 6) % 7);
        const w1 = new Date(d.getFullYear(), 0, 4);
        const kw = 1 + Math.round(((d - w1) / 86400000 - 3 + (w1.getDay() + 6) % 7) / 7);
        if (!wochen[kw]) wochen[kw] = { fahrten: 0, km: 0 };
        wochen[kw].fahrten++;
        wochen[kw].km += f.gesamtKm || 0;
      });

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7);
      Object.entries(wochen).sort((a, b) => a[0] - b[0]).forEach(([kw, data]) => {
        doc.text(`KW ${kw}: ${data.fahrten} Fahrten, ${data.km.toFixed(1)} km, ${App.formatBetrag(data.km * FIRMA.kmSatz)}`, 12, y);
        y += 4;
      });
    }

    this.addFooter(doc);
    return doc;
  },

  /**
   * PDF herunterladen
   */
  download(doc, filename) {
    doc.save(filename);
  },

  /**
   * PDF als Blob
   */
  toBlob(doc) {
    return doc.output('blob');
  },

  /**
   * PDF in neuem Tab öffnen
   */
  openInNewTab(doc) {
    const blob = doc.output('blob');
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank');
  },

  /**
   * Logo vorladen (einmalig beim Start)
   */
  async loadLogo() {
    try {
      const resp = await fetch('./assets/logo.jpg');
      if (!resp.ok) return;
      const blob = await resp.blob();
      const reader = new FileReader();
      reader.onload = () => { this._logoData = reader.result; };
      reader.readAsDataURL(blob);
    } catch (e) { /* Logo nicht verfügbar — kein Problem */ }
  }
};

// Logo beim Laden vorladen
PDFHelper.loadLogo();
