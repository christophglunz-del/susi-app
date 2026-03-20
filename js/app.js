/**
 * Haupt-App-Modul für Susi's Alltagshilfe
 * Initialisierung, Navigation, globale Hilfsfunktionen
 */

const App = {
  isOnline: navigator.onLine,

  // App initialisieren
  init() {
    this.registerServiceWorker();
    this.setupOnlineStatus();
    this.updateSyncStatus();
    console.log("Susi's Alltagshilfe gestartet");
  },

  // Service Worker registrieren
  async registerServiceWorker() {
    if ('serviceWorker' in navigator) {
      try {
        const registration = await navigator.serviceWorker.register('./sw.js');
        console.log('Service Worker registriert:', registration.scope);
      } catch (err) {
        console.warn('Service Worker Registrierung fehlgeschlagen:', err);
      }
    }
  },

  // Online/Offline Status überwachen
  setupOnlineStatus() {
    window.addEventListener('online', () => {
      this.isOnline = true;
      this.updateSyncStatus();
      App.toast('Wieder online', 'success');
    });

    window.addEventListener('offline', () => {
      this.isOnline = false;
      this.updateSyncStatus();
      App.toast('Offline-Modus aktiv', 'info');
    });
  },

  // Sync-Anzeige aktualisieren
  updateSyncStatus() {
    const dot = document.querySelector('.sync-dot');
    const label = document.querySelector('.sync-label');
    if (dot) {
      dot.className = 'sync-dot' + (this.isOnline ? '' : ' offline');
    }
    if (label) {
      label.textContent = this.isOnline ? 'Online' : 'Offline';
    }
  },

  // Toast-Benachrichtigung
  toast(message, type = 'info', duration = 3000) {
    let container = document.querySelector('.toast-container');
    if (!container) {
      container = document.createElement('div');
      container.className = 'toast-container';
      document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;

    const icons = { success: '\u2713', error: '\u2717', info: '\u2139' };
    toast.innerHTML = `<span>${icons[type] || '\u2139'}</span><span>${message}</span>`;
    container.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateX(100%)';
      toast.style.transition = 'all 0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }, duration);
  },

  // Datum formatieren (deutsch)
  formatDatum(dateStr) {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    return d.toLocaleDateString('de-DE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  },

  // Datum für Input-Felder
  formatDatumInput(dateStr) {
    if (!dateStr) return new Date().toISOString().split('T')[0];
    return new Date(dateStr).toISOString().split('T')[0];
  },

  // Uhrzeit formatieren
  formatZeit(zeitStr) {
    if (!zeitStr) return '';
    return zeitStr.substring(0, 5);
  },

  // Wochentag-Name
  wochentagName(datum) {
    const tage = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'];
    return tage[new Date(datum).getDay()];
  },

  // Wochentag-Kürzel
  wochentagKurz(datum) {
    const tage = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];
    return tage[new Date(datum).getDay()];
  },

  // Montag der aktuellen Woche berechnen
  getMontag(datum) {
    const d = new Date(datum || new Date());
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    d.setDate(diff);
    d.setHours(0, 0, 0, 0);
    return d;
  },

  // Betrag formatieren
  formatBetrag(betrag) {
    return new Intl.NumberFormat('de-DE', {
      style: 'currency',
      currency: 'EUR'
    }).format(betrag || 0);
  },

  // Initialen aus Name
  initialen(name) {
    if (!name) return '?';
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  },

  // Modal öffnen
  openModal(modalId) {
    const overlay = document.getElementById(modalId);
    if (overlay) {
      overlay.classList.add('active');
      document.body.style.overflow = 'hidden';
    }
  },

  // Modal schließen
  closeModal(modalId) {
    const overlay = document.getElementById(modalId);
    if (overlay) {
      overlay.classList.remove('active');
      document.body.style.overflow = '';
    }
  },

  // Bestätigungsdialog
  async confirm(message) {
    return window.confirm(message);
  },

  // Monatsname
  monatsName(monat) {
    const monate = [
      'Januar', 'Februar', 'März', 'April', 'Mai', 'Juni',
      'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'
    ];
    return monate[(monat - 1) % 12];
  },

  // Aktuelles Datum als String
  heute() {
    return new Date().toISOString().split('T')[0];
  },

  // Aktuelle Uhrzeit als String
  jetztZeit() {
    return new Date().toTimeString().substring(0, 5);
  },

  // Debounce-Funktion
  debounce(fn, delay = 300) {
    let timer;
    return (...args) => {
      clearTimeout(timer);
      timer = setTimeout(() => fn(...args), delay);
    };
  },

  // Stunden berechnen aus Start-/Endzeit
  stundenBerechnen(startzeit, endzeit) {
    if (!startzeit || !endzeit) return 0;
    const [sh, sm] = startzeit.split(':').map(Number);
    const [eh, em] = endzeit.split(':').map(Number);
    const diffMinuten = (eh * 60 + em) - (sh * 60 + sm);
    return Math.max(0, diffMinuten / 60);
  },

  // Betrag berechnen
  betragBerechnen(stunden) {
    return Math.round(stunden * FIRMA.stundensatz * 100) / 100;
  }
};

// App beim Laden initialisieren
document.addEventListener('DOMContentLoaded', () => {
  App.init();
});
