/**
 * data.js — Capa de datos de la aplicación.
 *
 * Toda la app llama únicamente a los métodos de "DataService".
 * Hoy los datos viven en localStorage (para poder mostrar el proyecto
 * funcionando sin backend). El día que haya API/base de datos real,
 * basta con reescribir el CUERPO de estos métodos para que hagan
 * fetch() al servidor — el resto del código (páginas y UI) no cambia
 * porque ya se consume como Promesas.
 *
 * Fotos: hoy se guardan reducidas (data URL) dentro del registro. Con base
 * de datos real irían a un almacenamiento de archivos y aquí solo la URL.
 */

const DataService = (function () {
  const PREFIX = 'vsp_';
  const SEED_VERSION = '1';

  const COLLECTIONS = [
    'owners', 'pets', 'services', 'groomers', 'appointments', 'waitlist',
    'visits', 'packageTypes', 'packages', 'products', 'lots',
    'expenses', 'closings', 'reminders', 'activity'
  ];

  function read(name, fallback) {
    try {
      const raw = localStorage.getItem(PREFIX + name);
      return raw ? JSON.parse(raw) : fallback;
    } catch (e) {
      console.error('Error leyendo', name, e);
      return fallback;
    }
  }

  function write(name, value) {
    localStorage.setItem(PREFIX + name, JSON.stringify(value));
  }

  function uid(prefix) {
    return prefix + '_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
  }

  /** CRUD genérico: list / get / add / update / remove. Todo devuelve Promesas. */
  function collection(name) {
    return {
      list() { return Promise.resolve(read(name, [])); },
      get(id) { return Promise.resolve(read(name, []).find(x => x.id === id) || null); },
      add(obj) {
        return new Promise(resolve => {
          const list = read(name, []);
          const item = Object.assign({ id: uid(name.slice(0, 4)), createdAt: Date.now() }, obj);
          list.push(item);
          write(name, list);
          resolve(item);
        });
      },
      update(id, patch) {
        return new Promise(resolve => {
          const list = read(name, []);
          const i = list.findIndex(x => x.id === id);
          if (i < 0) throw new Error('Registro no encontrado: ' + id);
          list[i] = Object.assign({}, list[i], patch, { id });
          write(name, list);
          resolve(list[i]);
        });
      },
      remove(id) {
        return new Promise(resolve => {
          write(name, read(name, []).filter(x => x.id !== id));
          resolve(true);
        });
      }
    };
  }

  const api = {};
  COLLECTIONS.forEach(n => { api[n] = collection(n); });

  /** Carga varias colecciones de una vez: all(['pets','owners']).then(d => d.pets ...) */
  function all(names) {
    return Promise.all(names.map(n => api[n].list())).then(results => {
      const out = {};
      names.forEach((n, i) => { out[n] = results[i]; });
      return out;
    });
  }

  /* ------------------------------ Configuración ------------------------------ */

  function getSettings() {
    const saved = read('settings', {});
    const d = Logic.DEFAULT_SETTINGS;
    return Promise.resolve(Object.assign({}, d, saved, {
      loyalty: Object.assign({}, d.loyalty, saved.loyalty),
      sizeDurations: Object.assign({}, d.sizeDurations, saved.sizeDurations)
    }));
  }

  function saveSettings(patch) {
    return getSettings().then(current => {
      const next = Object.assign({}, current, patch);
      write('settings', next);
      return next;
    });
  }

  /* ------------------------------ Registro de actividad ------------------------------ */

  function logActivity({ user, role, action, details }) {
    return api.activity.add({
      user: user || 'desconocido',
      role: role || 'empleado',
      action,
      details: details || '',
      timestamp: Date.now()
    }).then(() => true);
  }

  function getActivityLog() {
    return api.activity.list().then(log => log.slice().sort((a, b) => b.timestamp - a.timestamp));
  }

  /* ------------------------------ Respaldo ------------------------------ */

  function exportAll() {
    const dump = { app: 'VenuSpaPets', exportedAt: new Date().toISOString(), settings: read('settings', {}) };
    COLLECTIONS.forEach(n => { dump[n] = read(n, []); });
    return Promise.resolve(dump);
  }

  function importAll(dump) {
    if (!dump || dump.app !== 'VenuSpaPets') return Promise.reject(new Error('Archivo de respaldo no válido'));
    COLLECTIONS.forEach(n => write(n, Array.isArray(dump[n]) ? dump[n] : []));
    write('settings', dump.settings || {});
    write('seed_version', SEED_VERSION);
    return Promise.resolve(true);
  }

  function resetDemo() {
    Object.keys(localStorage).filter(k => k.startsWith(PREFIX) && k !== PREFIX + 'session').forEach(k => localStorage.removeItem(k));
    seed();
    return Promise.resolve(true);
  }

  /* ------------------------------ Semilla de demostración ------------------------------ */

  function seed() {
    const T = Util.today();
    const off = n => Util.addDays(T, n);
    const bday = (inDays, yearsAgo) => {
      const d = Util.parse(off(inDays));
      return (d.getFullYear() - yearsAgo) + '-' + Util.pad(d.getMonth() + 1) + '-' + Util.pad(d.getDate());
    };

    const groomers = [
      { id: 'gro_miguel', name: 'Miguel Angel', commission: 0, active: true, createdAt: Date.now() },
      { id: 'gro_camila', name: 'Camila Rojas', commission: 40, active: true, createdAt: Date.now() }
    ];

    const S = (id, name, type, prices, extraMin, breedPrices) => ({
      id, name, type, extraMin, active: true, createdAt: Date.now(),
      prices: { pequeno: prices[0], mediano: prices[1], grande: prices[2], gigante: prices[3] },
      breedPrices: breedPrices || []
    });
    const services = [
      S('srv_bano', 'Baño completo', 'base', [35000, 45000, 60000, 80000], 0),
      S('srv_banocorte', 'Baño y corte', 'base', [55000, 70000, 90000, 120000], 30, [{ breed: 'Schnauzer', price: 60000 }]),
      S('srv_higienico', 'Corte higiénico', 'base', [25000, 30000, 40000, 50000], 0),
      S('srv_unas', 'Corte de uñas', 'adicional', [8000, 8000, 10000, 12000], 0),
      S('srv_oidos', 'Limpieza de oídos', 'adicional', [8000, 8000, 10000, 10000], 0),
      S('srv_dientes', 'Cepillado dental', 'adicional', [10000, 10000, 12000, 15000], 0),
      S('srv_deslanado', 'Deslanado', 'adicional', [20000, 30000, 40000, 55000], 20),
      S('srv_antipulgas', 'Tratamiento antipulgas', 'adicional', [18000, 25000, 32000, 40000], 0),
      S('srv_perfume', 'Perfume y moño', 'adicional', [5000, 5000, 5000, 5000], 0)
    ];
    const srv = Util.byId(services);

    const O = (n, name, phone, address, birthday, extra) => Object.assign({
      id: 'own_' + n, name, whatsapp: phone, address, birthday, consent: true, consentDate: off(-90 - n),
      referredBy: null, referralRewardsUsed: 0, createdAt: Date.now()
    }, extra || {});
    const owners = [
      O(1, 'Carolina Restrepo', '3001234567', 'Cra 45 #12-30, Apto 301', '1988-' + Util.pad(Util.parse(off(5)).getMonth() + 1) + '-' + Util.pad(Util.parse(off(5)).getDate())),
      O(2, 'Andrés Felipe Gómez', '3109876543', 'Calle 10 #34-20', '1990-03-22'),
      O(3, 'Luisa Fernanda Ortiz', '3157654321', 'Cll 33 #78-15', '1985-11-02'),
      O(4, 'Juan Camilo Duque', '3205550123', 'Cra 70 #44-10', '1992-07-30'),
      O(5, 'Mariana Torres', '3112223344', 'Av. Oriental #25-60', '1995-01-17', { referredBy: 'own_3' }),
      O(6, 'Sebastián Vélez', '3176667788', 'Cra 50 #8-45', '1987-09-09'),
      O(7, 'Paola Henao', '3143334455', 'Cll 12 #20-05', '1993-05-25'),
      O(8, 'Daniel Cardona', '3228889900', 'Cra 80 #30-22', '1991-12-12'),
      O(9, 'Natalia Giraldo', '3014445566', 'Cll 45 #67-12', '1989-04-03'),
      O(10, 'Esteban Salazar', '3187770011', 'Cra 25 #14-80', '1994-08-19', { referredBy: 'own_1' }),
      O(11, 'Valentina Ríos', '3129990022', 'Cll 100 #15-40', '1996-02-27'),
      O(12, 'Camilo Arango', '3236661133', 'Cra 65 #52-18', '1986-10-30')
    ];

    // id, dueño, nombre, raza, tamaño, cumpleaños, temperamento, alergias, corte, frecuencia, hace cuántos días fue su última visita, # de visitas
    const P = (n, own, name, breed, size, birthdate, temper, allergies, cut, freq, lastAgo, nVisits, vaccines, notes) => ({
      id: 'pet_' + n, ownerId: 'own_' + own, name, breed, size, birthdate, temperament: temper, allergies,
      preferredCut: cut, frequencyDays: freq, notes: notes || '', photo: null, vaccines: vaccines || [],
      createdAt: Date.now(), _lastAgo: lastAgo, _n: nVisits
    });
    const pets = [
      P(1, 1, 'Nieve', 'Schnauzer', 'pequeno', bday(3, 4), 'Juguetón', '', 'Corte schnauzer clásico', 30, 26, 4,
        [{ name: 'Rabia', date: off(-350), next: off(15) }, { name: 'Parvovirus', date: off(-200), next: off(165) }], 'Le encanta el secador. Barba siempre larga.'),
      P(2, 2, 'Max', 'Golden Retriever', 'grande', bday(120, 3), 'Tranquilo', '', 'Deslanado y cepillado', 30, 0, 3,
        [{ name: 'Rabia', date: off(-357), next: off(8) }]),
      P(3, 3, 'Luna', 'Poodle', 'pequeno', bday(200, 5), 'Nervioso', 'Champús con avena', 'Corte cachorro', 21, 0, 5),
      P(4, 3, 'Toby', 'Yorkshire', 'pequeno', bday(60, 2), 'Juguetón', '', 'Corte tipo cachorro', 30, 31, 3),
      P(5, 4, 'Rocky', 'Labrador', 'grande', bday(250, 4), 'Tranquilo', '', 'Baño y deslanado', 30, 12, 3),
      P(6, 5, 'Coco', 'Shih Tzu', 'pequeno', bday(90, 3), 'Nervioso', 'Piel sensible', 'Corte lazo', 25, 24, 4),
      P(7, 6, 'Bruno', 'Pastor Alemán', 'grande', bday(300, 6), 'Agresivo', '', 'Solo baño', 30, 72, 2,
        [{ name: 'Rabia', date: off(-380), next: off(-15) }], 'Usar bozal. Solo Miguel lo atiende.'),
      P(8, 7, 'Mila', 'Maltés', 'pequeno', bday(150, 2), 'Tranquilo', '', 'Corte corto', 30, 8, 4),
      P(9, 8, 'Zeus', 'Husky', 'grande', bday(45, 5), 'Juguetón', '', 'Deslanado profundo', 45, 38, 2),
      P(10, 2, 'Lola', 'Beagle', 'mediano', bday(310, 3), 'Tranquilo', 'Alergia a perfumes fuertes', 'Baño completo', 30, 40, 3),
      P(11, 1, 'Thor', 'Bulldog Francés', 'mediano', bday(220, 2), 'Juguetón', 'Piel sensible en pliegues', 'Baño y limpieza de pliegues', 30, 33, 2),
      P(12, 4, 'Kira', 'Criollo', 'mediano', bday(100, 4), 'Nervioso', '', 'Baño completo', 30, 15, 2),
      P(13, 9, 'Simón', 'Pug', 'pequeno', bday(180, 3), 'Juguetón', 'Limpiar pliegues del rostro', 'Baño completo', 7, 3, 10),
      P(14, 9, 'Canela', 'Cocker Spaniel', 'mediano', bday(75, 5), 'Tranquilo', '', 'Corte cocker clásico', 10, 6, 7),
      P(15, 10, 'Oso', 'Pomerania', 'pequeno', bday(140, 2), 'Nervioso', '', 'Corte tipo oso', 8, 1, 9),
      P(16, 11, 'Frida', 'West Highland', 'pequeno', bday(260, 4), 'Juguetón', '', 'Corte westie', 7, 5, 10),
      P(17, 11, 'Sasha', 'Border Collie', 'mediano', bday(30, 3), 'Juguetón', '', 'Deslanado y baño', 14, 9, 5),
      P(18, 12, 'Ron', 'Rottweiler', 'grande', bday(330, 6), 'Tranquilo', '', 'Solo baño', 20, 5, 3),
      P(19, 10, 'Pelusa', 'Poodle', 'pequeno', bday(110, 7), 'Tranquilo', 'Piel sensible', 'Corte poodle moderno', 7, 2, 10),
      P(20, 12, 'Chispa', 'Pinscher', 'pequeno', bday(210, 2), 'Nervioso', '', 'Baño completo', 10, 8, 7)
    ];

    const line = (s, pet) => ({ serviceId: s.id, name: s.name, type: s.type, price: Logic.priceFor(s, pet) });
    const pays = ['efectivo', 'nequi', 'daviplata', 'transferencia', 'efectivo', 'nequi'];
    const visits = [];
    const appointments = [];
    let seq = 0;

    pets.forEach((pet, pi) => {
      for (let k = 0; k < pet._n; k++) {
        const daysAgo = pet._lastAgo + k * pet.frequencyDays;
        const date = off(-daysAgo);
        const base = (k + pi) % 3 === 0 ? srv.srv_banocorte : srv.srv_bano;
        const items = [line(base, pet)];
        if ((k + pi) % 2 === 0) items.push(line(srv.srv_unas, pet));
        if ((k + pi) % 4 === 0) items.push(line(srv.srv_perfume, pet));
        if (pet.size === 'grande' && (k + pi) % 3 === 1) items.push(line(srv.srv_deslanado, pet));
        const subtotal = Util.sum(items, i => i.price);
        const hour = 9 + ((seq * 3) % 8);
        const groomer = pet.id === 'pet_7' || seq % 3 !== 0 ? groomers[0] : groomers[1];
        const visit = {
          id: 'vis_seed_' + (++seq), date, time: Util.pad(hour) + ':00', petId: pet.id, ownerId: pet.ownerId,
          groomerId: groomer.id, items, subtotal, discountKey: null, discountPct: 0, discountAmount: 0,
          total: subtotal, tip: seq % 4 === 0 ? 5000 : 0, payMethod: pays[seq % pays.length],
          beforePhoto: null, afterPhoto: null, notes: '', appointmentId: null, usedPackage: false,
          createdAt: new Date(date + 'T' + Util.pad(hour) + ':30:00').getTime()
        };
        visits.push(visit);

        if (daysAgo <= 6) {
          const apptId = 'app_seed_' + seq;
          visit.appointmentId = apptId;
          appointments.push({
            id: apptId, petId: pet.id, ownerId: pet.ownerId, date, time: visit.time,
            duration: Logic.durationFor(pet, items.map(i => srv[i.serviceId]), Logic.DEFAULT_SETTINGS),
            serviceIds: items.map(i => i.serviceId), groomerId: groomer.id, status: 'atendida',
            visitId: visit.id, notes: '', createdAt: Date.now()
          });
        }
      }
    });

    const futureAppt = (n, petId, date, time, serviceIds, groomerId, status, notes) => {
      const pet = pets.find(p => p.id === petId);
      appointments.push({
        id: 'app_demo_' + n, petId, ownerId: pet.ownerId, date, time,
        duration: Logic.durationFor(pet, serviceIds.map(id => srv[id]), Logic.DEFAULT_SETTINGS),
        serviceIds, groomerId, status: status || 'agendada', visitId: null, notes: notes || '', createdAt: Date.now()
      });
    };
    futureAppt(1, 'pet_8', off(0), '15:00', ['srv_banocorte', 'srv_unas'], 'gro_miguel');
    futureAppt(2, 'pet_11', off(0), '16:30', ['srv_bano', 'srv_oidos'], 'gro_camila', 'agendada', 'Limpiar bien los pliegues');
    futureAppt(3, 'pet_1', off(1), '09:00', ['srv_banocorte', 'srv_unas', 'srv_perfume'], 'gro_miguel', 'agendada', 'Barba larga, corte clásico');
    futureAppt(4, 'pet_6', off(1), '11:00', ['srv_banocorte'], 'gro_miguel');
    futureAppt(5, 'pet_5', off(1), '14:00', ['srv_bano', 'srv_deslanado'], 'gro_camila');
    futureAppt(6, 'pet_12', off(2), '10:00', ['srv_bano'], 'gro_camila');
    futureAppt(7, 'pet_10', off(4), '09:00', ['srv_bano', 'srv_oidos'], 'gro_miguel');
    futureAppt(8, 'pet_9', off(-3), '10:00', ['srv_bano', 'srv_deslanado'], 'gro_miguel', 'noasistio');
    futureAppt(9, 'pet_4', off(-1), '12:00', ['srv_banocorte'], 'gro_camila', 'cancelada', 'Canceló por lluvia');

    const waitlist = [
      { id: 'wl_1', petId: 'pet_7', name: 'Bruno (Sebastián Vélez)', phone: '3176667788', note: 'Quiere cupo esta semana, mejor en la mañana', preferredDate: off(3), createdAt: Date.now() }
    ];

    const packageTypes = [
      { id: 'pkt_4p', name: 'Paquete 4 baños (pequeño)', qty: 4, price: 130000, createdAt: Date.now() },
      { id: 'pkt_4m', name: 'Paquete 4 baños (mediano)', qty: 4, price: 165000, createdAt: Date.now() },
      { id: 'pkt_4g', name: 'Paquete 4 baños (grande)', qty: 4, price: 220000, createdAt: Date.now() }
    ];
    const packages = [
      { id: 'pak_1', petId: 'pet_8', ownerId: 'own_7', typeId: 'pkt_4p', name: 'Paquete 4 baños (pequeño)', total: 4, remaining: 3, price: 130000, payMethod: 'nequi', purchasedAt: off(-8), createdAt: Date.now() }
    ];

    const products = [
      { id: 'prd_champu', name: 'Champú hipoalergénico (galón)', unit: 'galón', minStock: 1, createdAt: Date.now() },
      { id: 'prd_acond', name: 'Acondicionador', unit: 'galón', minStock: 1, createdAt: Date.now() },
      { id: 'prd_perfume', name: 'Perfume canino', unit: 'frasco', minStock: 1, createdAt: Date.now() },
      { id: 'prd_desinf', name: 'Desinfectante de mesa', unit: 'galón', minStock: 1, createdAt: Date.now() },
      { id: 'prd_toallas', name: 'Toallas desechables', unit: 'paquete', minStock: 1, createdAt: Date.now() }
    ];
    const lot = (n, productId, daysAgo, cost, supplier, finishedAgo) => ({
      id: 'lot_' + n, productId, date: off(-daysAgo), cost, supplier,
      finishedDate: finishedAgo === null ? null : off(-finishedAgo), createdAt: Date.now()
    });
    const lots = [
      lot(1, 'prd_champu', 70, 85000, 'Distri Mascotas', 38),
      lot(2, 'prd_champu', 38, 85000, 'Distri Mascotas', 5),
      lot(3, 'prd_champu', 5, 88000, 'Distri Mascotas', null),
      lot(4, 'prd_acond', 50, 62000, 'Distri Mascotas', 12),
      lot(5, 'prd_acond', 12, 62000, 'Distri Mascotas', null),
      lot(6, 'prd_acond', 12, 62000, 'Distri Mascotas', null),
      lot(7, 'prd_perfume', 45, 24000, 'Pet Shop Centro', 10),
      lot(8, 'prd_perfume', 10, 25000, 'Pet Shop Centro', null),
      lot(9, 'prd_desinf', 20, 18000, 'Aseo Total', null),
      lot(10, 'prd_desinf', 20, 18000, 'Aseo Total', null),
      lot(11, 'prd_toallas', 15, 22000, 'Aseo Total', null),
      lot(12, 'prd_toallas', 15, 22000, 'Aseo Total', null),
      lot(13, 'prd_toallas', 15, 22000, 'Aseo Total', null)
    ];

    const monthStart = Util.startOfMonth(T);
    const prevStart = Util.startOfMonth(Util.addDays(monthStart, -3));
    const exp = (n, date, category, description, amount, payMethod) => ({ id: 'exp_' + n, date, category, description, amount, payMethod: payMethod || 'efectivo', createdAt: Date.now() });
    const expenses = [
      exp(1, Util.addDays(prevStart, 4), 'Arriendo', 'Arriendo del local', 600000, 'transferencia'),
      exp(2, Util.addDays(prevStart, 9), 'Servicios públicos', 'Agua, luz e internet', 210000, 'transferencia'),
      exp(3, Util.addDays(prevStart, 27), 'Sueldos', 'Pago Camila (quincena)', 400000),
      exp(4, Util.addDays(monthStart, 2), 'Arriendo', 'Arriendo del local', 600000, 'transferencia'),
      exp(5, Util.addDays(monthStart, 3), 'Publicidad', 'Pauta en redes', 40000, 'nequi')
    ];

    pets.forEach(p => { delete p._lastAgo; delete p._n; });

    const data = { owners, pets, services, groomers, appointments, waitlist, visits, packageTypes, packages, products, lots, expenses, closings: [], reminders: [], activity: [] };
    COLLECTIONS.forEach(n => write(n, data[n]));
    write('settings', {});
    write('seed_version', SEED_VERSION);
  }

  function seedIfNeeded() {
    if (read('seed_version', null) !== SEED_VERSION) seed();
  }

  seedIfNeeded();

  return Object.assign({}, api, { all, getSettings, saveSettings, logActivity, getActivityLog, exportAll, importAll, resetDemo });
})();
