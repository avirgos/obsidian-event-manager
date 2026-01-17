<%*
const pad = n => String(n).padStart(2, '0');
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2,8);

const generateOptions = (start=7, end=22, step=30) => {
  const opts = ['Maintenant', 'Toute la journée'];
  for (let h = start; h <= end; h++) {
    for (let m = 0; m < 60; m += step) opts.push(`${pad(h)}:${pad(m)}`);
  }
  opts.push('Personnalisée', 'Annuler');
  return opts;
};

const parseCustomTime = (input, now) => {
  if (!input) return null;
  const s = input.trim();
  const rel = s.match(/^([+-])\s*(\d+)$/);
  if (rel) {
    const sign = rel[1] === '+' ? 1 : -1;
    const dt = new Date(now.getTime() + sign * parseInt(rel[2],10) * 60000);
    return `${pad(dt.getHours())}:${pad(dt.getMinutes())}`;
  }
  if (s.includes(':')) {
    const [hh, mm='0'] = s.split(':').map(Number);
    if (hh>=0 && hh<=23 && mm>=0 && mm<=59) return `${pad(hh)}:${pad(mm)}`;
    return null;
  }
  if (s.length <= 2) {
    const hh = Number(s);
    if (hh>=0 && hh<=23) return `${pad(hh)}:00`;
    return null;
  }
  const hh = Number(s.slice(0,-2));
  const mm = Number(s.slice(-2));
  if (hh>=0 && hh<=23 && mm>=0 && mm<=59) return `${pad(hh)}:${pad(mm)}`;
  return null;
};

const buildIsoForToday = (hhmm, base) => {
  const [hh, mm] = hhmm.split(':').map(Number);
  const dt = new Date(base.getFullYear(), base.getMonth(), base.getDate(), hh, mm);
  return `${dt.getFullYear()}-${pad(dt.getMonth()+1)}-${pad(dt.getDate())}T${pad(dt.getHours())}:${pad(dt.getMinutes())}`;
};

const now = new Date();
const options = generateOptions();
const choice = await tp.system.suggester(options, options);

let output = '<!-- Ajout annulé -->';

if (choice && choice !== 'Annuler') {
  let iso = null;
  let allDayFlag = false;

  if (choice === 'Maintenant') {
    const chosenTime = `${pad(now.getHours())}:${pad(now.getMinutes())}`;
    iso = buildIsoForToday(chosenTime, now);
  } else if (choice === 'Toute la journée') {
    // Use date-only format for all-day events
    const yyyy = now.getFullYear();
    const mm = pad(now.getMonth()+1);
    const dd = pad(now.getDate());
    iso = `${yyyy}-${mm}-${dd}`; // date-only
    allDayFlag = true;
  } else if (choice === 'Personnalisée') {
    const raw = await tp.system.prompt('Horaire personnalisée (9 | 930 | 09:30 | +15 | -30)', '');
    const parsed = parseCustomTime(raw, now);
    const chosenTime = parsed || `${pad(now.getHours())}:${pad(now.getMinutes())}`;
    iso = buildIsoForToday(chosenTime, now);
  } else {
    // fixed time choice like "09:30"
    iso = buildIsoForToday(choice, now);
  }

  const descRaw = await tp.system.prompt('Description (optionnel):', '') || '';
  const desc = descRaw.trim() === '' ? '' : descRaw.replace(/\n/g, ' ');
  const tagsInput = await tp.system.prompt('Étiquettes (séparées par des virgules):', '') || '';
  const tags = tagsInput ? tagsInput.split(',').map(t => t.trim()).filter(Boolean) : [];
  const statut = await tp.system.suggester(['En cours','Terminé'], ['En cours','Terminé']) || 'En cours';
  const id = `evt_${uid()}`;

  output = `
%%
Event:: ${iso}
Description:: ${desc}
Étiquettes:: ${tags.join(', ')}
Statut:: ${statut}
EventID:: ${id}
${allDayFlag ? 'AllDay:: true' : ''}
%%
`;
}

tR = output;
%>