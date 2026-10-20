/**
 * logic.js — Reglas de negocio puras (precios, duración, fidelización,
 * finanzas y mensajes). No toca localStorage ni el DOM: recibe los datos
 * por parámetro, así se reutiliza igual contra una API o base de datos.
 */

const Logic = (function () {
  const SIZES = [
    { key: 'pequeno', label: 'Pequeño', hint: 'hasta ~10 kg' },
    { key: 'mediano', label: 'Mediano', hint: '10 a 25 kg' },
    { key: 'grande', label: 'Grande', hint: '25 a 40 kg' },
    { key: 'gigante', label: 'Gigante', hint: 'más de 40 kg' }
  ];

  const PAY_METHODS = [
    { key: 'efectivo', label: 'Efectivo' },
    { key: 'nequi', label: 'Nequi' },
    { key: 'daviplata', label: 'Daviplata' },
    { key: 'transferencia', label: 'Transferencia' },
    { key: 'paquete', label: 'Paquete prepagado' }
  ];

  const STATUSES = [
    { key: 'agendada', label: 'Agendada' },
    { key: 'atendida', label: 'Atendida' },
    { key: 'cancelada', label: 'Cancelada' },
    { key: 'noasistio', label: 'No asistió' }
  ];

  const EXPENSE_CATEGORIES = ['Arriendo', 'Servicios públicos', 'Sueldos', 'Publicidad', 'Transporte', 'Mantenimiento', 'Otros'];

  const DEFAULT_SETTINGS = {
    businessName: 'VenuSpa Pets',
    ownerName: 'Miguel Angel',
    ownerPhone: '573212678592',
    address: '',
    loyalty: { everyN: 5, pct: 50, birthdayPct: 10, referralPct: 10 },
    sizeDurations: { pequeno: 60, mediano: 75, grande: 90, gigante: 120 },
    inactiveDays: [30, 60]
  };

  function label(list, key) {
    const f = list.find(x => x.key === key);
    return f ? f.label : key;
  }
  const sizeLabel = key => label(SIZES, key);
  const payLabel = key => label(PAY_METHODS, key);
  const statusLabel = key => label(STATUSES, key);

  /* --------------------------- Precios y duración --------------------------- */

  /** Precio de un servicio para una mascota: precio especial por raza, si existe; si no, por tamaño. */
  function priceFor(service, pet) {
    if (!service) return 0;
    if (pet && pet.breed && Array.isArray(service.breedPrices)) {
      const special = service.breedPrices.find(b => Util.norm(b.breed) === Util.norm(pet.breed));
      if (special) return Number(special.price) || 0;
    }
    const size = pet && pet.size ? pet.size : 'pequeno';
    return Number((service.prices || {})[size]) || 0;
  }

  /** Duración sugerida: tiempo base según tamaño + minutos extra de cada servicio. */
  function durationFor(pet, services, settings) {
    const base = (settings.sizeDurations || DEFAULT_SETTINGS.sizeDurations)[(pet && pet.size) || 'pequeno'] || 60;
    return base + Util.sum(services, s => s.extraMin || 0);
  }

  /* --------------------------- Visitas e historial --------------------------- */

  function visitsOfPet(visits, petId) {
    return visits.filter(v => v.petId === petId).sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
  }

  function lastVisitDate(visits, petId) {
    const list = visitsOfPet(visits, petId);
    return list.length ? list[0].date : null;
  }

  function lastVisitOfOwner(visits, ownerId) {
    let last = null;
    visits.forEach(v => { if (v.ownerId === ownerId && (!last || v.date > last)) last = v.date; });
    return last;
  }

  /* --------------------------- Fidelización --------------------------- */

  /** Progreso del contador de baños de una mascota. */
  function loyaltyInfo(petId, visits, settings) {
    const n = settings.loyalty.everyN;
    const done = visits.filter(v => v.petId === petId).length;
    const inCycle = done % n;
    const nextNumber = done + 1;
    return { done, everyN: n, inCycle, remaining: n - inCycle, nextNumber, nextIsReward: nextNumber % n === 0 };
  }

  /** Descuentos que se pueden ofrecer hoy a una mascota. */
  function eligibleDiscounts(ctx) {
    const { pet, owner, owners, visits, settings } = ctx;
    const date = ctx.date || Util.today();
    const L = settings.loyalty;
    const list = [];

    const info = loyaltyInfo(pet.id, visits, settings);
    if (info.nextIsReward) {
      list.push({ key: 'loyalty', pct: L.pct, label: 'Fidelización: baño #' + info.nextNumber + ' (' + L.pct + '%)' });
    }

    const dist = Util.birthdayDistance(pet.birthdate, date);
    if (dist !== null && Math.abs(dist) <= 7) {
      const year = date.slice(0, 4);
      const already = visits.some(v => v.petId === pet.id && v.discountKey === 'birthday' && v.date.slice(0, 4) === year);
      if (!already) list.push({ key: 'birthday', pct: L.birthdayPct, label: 'Cumpleaños de ' + pet.name + ' (' + L.birthdayPct + '%)' });
    }

    if (owner) {
      const ownerHasVisits = visits.some(v => v.ownerId === owner.id);
      if (owner.referredBy && !ownerHasVisits) {
        list.push({ key: 'referral-new', pct: L.referralPct, label: 'Cliente referido, primera visita (' + L.referralPct + '%)' });
      }
      const credits = referralCredits(owner, owners, visits);
      if (credits > 0) {
        list.push({ key: 'referral-referrer', pct: L.referralPct, label: 'Por referir clientes: ' + credits + ' disponible(s) (' + L.referralPct + '%)' });
      }
    }
    return list;
  }

  /** Referidos que ya tuvieron al menos una visita menos las recompensas ya usadas. */
  function referralCredits(owner, owners, visits) {
    const referred = owners.filter(o => o.referredBy === owner.id && visits.some(v => v.ownerId === o.id));
    return Math.max(0, referred.length - (owner.referralRewardsUsed || 0));
  }

  /* --------------------------- Finanzas --------------------------- */

  function inRange(date, from, to) {
    return (!from || date >= from) && (!to || date <= to);
  }

  /** Ingresos, insumos, gastos y utilidad real de un rango. */
  function financials(data, from, to) {
    const visits = data.visits.filter(v => inRange(v.date, from, to));
    const pkgSales = data.packages.filter(p => inRange(p.purchasedAt, from, to));
    const lots = data.lots.filter(l => inRange(l.date, from, to));
    const expenses = data.expenses.filter(e => inRange(e.date, from, to));

    const incomeServices = Util.sum(visits, v => v.total);
    const incomePackages = Util.sum(pkgSales, p => p.price);
    const tips = Util.sum(visits, v => v.tip);
    const supplies = Util.sum(lots, l => l.cost);
    const otherExpenses = Util.sum(expenses, e => e.amount);
    const income = incomeServices + incomePackages;

    return {
      visits, pkgSales, lots, expenses,
      incomeServices, incomePackages, income, tips, supplies, otherExpenses,
      profit: income - supplies - otherExpenses,
      count: visits.length,
      avgTicket: visits.length ? Math.round(incomeServices / visits.length) : 0
    };
  }

  /* --------------------------- Mensajes y calendario --------------------------- */

  function firstName(name) { return String(name || '').trim().split(/\s+/)[0] || ''; }

  const Messages = {
    appointment(owner, pet, appt, settings) {
      return 'Hola ' + firstName(owner.name) + ' 🐶, te recordamos la cita de ' + pet.name + ' en ' + settings.businessName +
        ' el ' + Util.formatLong(appt.date) + ' a las ' + Util.formatTime(appt.time) + ' ¡Los esperamos! 💜 Por favor responde para confirmar.';
    },
    dueBath(owner, pet, days, settings) {
      return 'Hola ' + firstName(owner.name) + ' 🐾, ya toca el baño de ' + pet.name + ' (último baño hace ' + days + ' días). ' +
        '¿Te agendo una cita en ' + settings.businessName + '? 🛁💜';
    },
    petBirthday(owner, pet, settings, pct) {
      return '¡Hola ' + firstName(owner.name) + '! 🎂🐶 Esta semana ' + pet.name + ' está de cumpleaños. ' +
        'En ' + settings.businessName + ' queremos celebrarlo con un ' + pct + '% de descuento en su baño. ¡Escríbenos para agendar! 💜';
    },
    ownerBirthday(owner, settings) {
      return '¡Feliz cumpleaños ' + firstName(owner.name) + '! 🎉 De parte de todos en ' + settings.businessName + ' te deseamos un día increíble junto a tus peludos 💜';
    },
    vaccine(owner, pet, vaccine, settings) {
      return 'Hola ' + firstName(owner.name) + ' 💉, te recordamos que la vacuna de ' + vaccine.name + ' de ' + pet.name +
        ' vence el ' + Util.formatShort(vaccine.next) + '. Cuéntanos si necesitas algo de ' + settings.businessName + ' 🐶';
    },
    reactivation(owner, pet, days, settings) {
      return 'Hola ' + firstName(owner.name) + ' 🐶, ¡hace ' + days + ' días no vemos a ' + pet.name + ' por ' + settings.businessName +
        '! Lo extrañamos 💜 ¿Le agendamos un baño esta semana?';
    },
    ownerAgenda(items, dateStr, settings) {
      if (!items.length) return 'Agenda de ' + Util.formatLong(dateStr) + ': sin citas agendadas.';
      const lines = items.map(i => '• ' + Util.formatTime(i.appt.time) + ' — ' + i.pet.name + ' (' + i.owner.name + ') — ' + i.serviceNames);
      return '📅 Agenda de ' + Util.formatLong(dateStr) + ' — ' + settings.businessName + '\n' + lines.join('\n');
    },
    ownerNewAppointment(owner, pet, appt, serviceNames) {
      return '🐶 Cita: ' + pet.name + ' (' + owner.name + ') el ' + Util.formatLong(appt.date) + ' a las ' + Util.formatTime(appt.time) + ' — ' + serviceNames;
    }
  };

  /** Enlace para agregar la cita a Google Calendar (hora local de Colombia). */
  function googleCalendarUrl(appt, pet, owner, serviceNames, settings) {
    const stamp = (d, t) => d.replace(/-/g, '') + 'T' + t.replace(':', '') + '00';
    const end = Util.addMinutes(appt.time, appt.duration || 60);
    const params = new URLSearchParams({
      action: 'TEMPLATE',
      text: '🐶 ' + pet.name + ' — ' + serviceNames,
      dates: stamp(appt.date, appt.time) + '/' + stamp(appt.date, end),
      ctz: 'America/Bogota',
      details: 'Cliente: ' + owner.name + '\nWhatsApp: ' + owner.whatsapp + '\nMascota: ' + pet.name + ' (' + (pet.breed || '') + ')\n' + (appt.notes || ''),
      location: settings.businessName
    });
    return 'https://calendar.google.com/calendar/render?' + params.toString();
  }

  return {
    SIZES, PAY_METHODS, STATUSES, EXPENSE_CATEGORIES, DEFAULT_SETTINGS,
    sizeLabel, payLabel, statusLabel,
    priceFor, durationFor,
    visitsOfPet, lastVisitDate, lastVisitOfOwner,
    loyaltyInfo, eligibleDiscounts, referralCredits,
    inRange, financials,
    Messages, googleCalendarUrl, firstName
  };
})();
