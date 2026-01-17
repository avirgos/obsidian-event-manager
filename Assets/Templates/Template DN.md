<%* await tp.user.cleanupDN(tp) %>
```button
name 🞧 Ajouter un événement
type append template
action Template New Event
class event-button
```
## Tableau de bord
```dataviewjs
const escapeHtml = s => s == null ? "" : String(s)
  .replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;")
  .replace(/"/g,"&quot;").replace(/'/g,"&#039;");

function regexEscape(s){ return String(s).replace(/[.*+?^${}()|[\]\\]/g,'\\$&'); }

function parseMoment(v) {
  if (v === null || v === undefined) return null;
  if (v instanceof Date && !isNaN(v)) return moment(v);
  if (moment.isMoment && moment.isMoment(v) && v.isValid()) return v;
  const s = String(v).trim();
  let m = moment(s, "YYYY-MM-DD", true);
  if (m.isValid()) return m.startOf('day');
  m = moment(s, moment.ISO_8601, true);
  if (m.isValid()) return m;
  m = moment(s, "YYYY-MM-DDTHH:mm", true);
  if (m.isValid()) return m;
  m = moment(s);
  return m.isValid() ? m : null;
}

function normalizeText(v) {
  if (v === null || v === undefined) return "-";
  const s = String(v).trim();
  if (!s || s.toLowerCase() === "null" || s.toLowerCase() === "undefined") return "-";
  return s;
}

function isDoneLabel(s) {
  if (s === null || s === undefined) return false;
  const t = String(s).trim().toLowerCase();
  return ['terminé','termine','terminee','done','finished','true','✓','yes','y'].includes(t);
}

/* Delete event block identified by `EventID::` (or fallback id) */
async function deleteEventById(filePath, eventId) {
  try {
    const file = app.vault.getAbstractFileByPath(filePath);
    if (!file) { new Notice("Fichier introuvable: " + filePath); return; }
    const content = await app.vault.read(file);
    const lines = content.split(/\r?\n/);

    // Find `EventID::` line (exact match)
    let idLine = -1;
    const idRegex = new RegExp(`^\\s*EventID::\\s*${regexEscape(eventId)}\\s*$`);
    for (let i = 0; i < lines.length; i++) if (idRegex.test(lines[i])) { idLine = i; break; }
    if (idLine === -1) { new Notice("EventID non trouvé dans la note."); return; }

    // Find the nearest `Event::` line above the `EventID`
    let eventLine = -1;
    for (let j = idLine - 1; j >= 0; j--) if (/^\s*Event::\s*/i.test(lines[j])) { eventLine = j; break; }
    if (eventLine === -1) { new Notice("`Event::` correspondant non trouvé au-dessus de `EventID`."); return; }

    // Find the next `Event::` after `eventLine` (or EOF)
    let nextEventLine = lines.length;
    for (let k = eventLine + 1; k < lines.length; k++) {
      if (/^\s*Event::\s*/i.test(lines[k])) { nextEventLine = k; break; }
    }

    // Remove lines in the block `[eventLine .. nextEventLine-1]` that are per-event fields
    const keep = [];
    for (let i = 0; i < lines.length; i++) {
      if (i >= eventLine && i < nextEventLine) {
        // If this is the block we want to delete, skip lines that start with these keys
        if (/^\s*(Event::|EventID::|Description::|Statut::|AllDay::|Étiquettes::)\s*/i.test(lines[i])) {
          continue; // Drop this line
        } else {
          // Keep other lines inside the block (in case user has other content)
          keep.push(lines[i]);
        }
      } else {
        keep.push(lines[i]);
      }
    }

    // If nothing changed, abort
    if (keep.length === lines.length) { new Notice("Aucune ligne supprimée (format inattendu)."); return; }

    await app.vault.modify(file, keep.join("\n"));
    new Notice("Événement supprimé.");

    // Reopen file to force refresh
    const leaf = app.workspace.activeLeaf;
    if (leaf) await leaf.openFile(file);
  } catch (err) {
    console.error(err);
    new Notice("Erreur lors de la suppression de l'événement.");
  }
}

/* Build and render the table */
const page = dv.current();

if (!page) {
  dv.paragraph("Impossible de lire la note courante.");
} else {
  const filePath = page.file.path;

  const rawEvents = page.Event ? (Array.isArray(page.Event) ? page.Event : [page.Event]) : [];
  const rawDescs  = page.Description ? (Array.isArray(page.Description) ? page.Description : [page.Description]) : [];
  const tagsField = page.Étiquettes;
  const rawIds    = page.EventID ? (Array.isArray(page.EventID) ? page.EventID : [page.EventID]) : [];
  const rawStatus = page.Statut ? (Array.isArray(page.Statut) ? page.Statut : [page.Statut]) : [];
  const rawAllDay = page.AllDay ? (Array.isArray(page.AllDay) ? page.AllDay : [page.AllDay]) : [];

  let noteTags = [];
  if (Array.isArray(tagsField)) noteTags = tagsField.flatMap(t => (typeof t === "string" ? t.split(/[,;\s]+/) : [String(t)])).map(x => x.trim()).filter(Boolean);
  else if (typeof tagsField === "string") noteTags = tagsField.split(/[,;\s]+/).map(x => x.trim()).filter(Boolean);
  else if (tagsField) noteTags = [String(tagsField).trim()];

  const entries = [];
  for (let i = 0; i < rawEvents.length; i++) {
    const ev = rawEvents[i];
    const m = parseMoment(ev);
    if (!m) continue;

    let allDay = false;
    if (rawAllDay.length > i && rawAllDay[i] !== undefined) {
      const v = rawAllDay[i];
      allDay = (String(v).toLowerCase() === 'true' || String(v).toLowerCase() === 'yes' || String(v).toLowerCase() === '1');
    } else {
      const s = String(ev).trim();
      if (/^\d{4}-\d{2}-\d{2}$/.test(s)) allDay = true;
    }

    let desc = "-";
    if (rawDescs.length > i && rawDescs[i] !== undefined && rawDescs[i] !== null && String(rawDescs[i]).trim() !== "") {
      desc = normalizeText(String(rawDescs[i]).replace(/\n/g, " "));
    } else if (rawDescs.length === 1 && String(rawDescs[0]).trim() !== "") {
      desc = normalizeText(String(rawDescs[0]).replace(/\n/g, " "));
    }

    let tags = [];
    if (Array.isArray(tagsField) && tagsField[i] !== undefined) {
      const t = tagsField[i];
      if (Array.isArray(t)) tags = t.map(x => String(x).trim()).filter(Boolean);
      else if (typeof t === "string") tags = t.split(/[,;\s]+/).map(x => x.trim()).filter(Boolean);
      else tags = [String(t).trim()];
    } else tags = noteTags.slice();

    let id = rawIds.length > i ? String(rawIds[i]).trim() : (rawIds.length === 1 ? String(rawIds[0]).trim() : null);
    if (!id) id = String(ev).trim().replace(/\s+/g, '_') + `_idx${i}`;

    let statusRaw = null;
    if (rawStatus.length > i && rawStatus[i] !== undefined) statusRaw = rawStatus[i];
    else if (rawStatus.length === 1) statusRaw = rawStatus[0];
    const statusLabel = statusRaw ? String(statusRaw).trim() : "En cours";
    const done = isDoneLabel(statusLabel);

    entries.push({ moment: m, desc, tags, statusLabel, done, id, index: i, allDay });
  }

  if (entries.length === 0) {
    dv.paragraph("Aucun événement.");
  } else {
    entries.sort((a,b) => a.moment.valueOf() - b.moment.valueOf());

    let html = `<table class="ev-table"><thead><tr>
      <th>Heure</th><th>Description</th><th>Étiquettes</th><th>Statut</th><th></th>
    </tr></thead><tbody>`;

    for (const e of entries) {
      const timeOnly = e.allDay ? "Toute la journée" : e.moment.format("HH:mm");
      const fullDate = e.allDay ? e.moment.format("DD MMM YYYY") + " | Toute la journée" : e.moment.format("DD MMM YYYY | HH:mm");
      const dateCell = `<span title="${escapeHtml(fullDate)}">${escapeHtml(timeOnly)}</span>`;
      const descCell = escapeHtml(normalizeText(e.desc));
      const tagsHtml = (e.tags || []).length ? (e.tags.map(t => `<span class="tag-badge">${escapeHtml(normalizeText(t))}</span>`).join(" ")) : "-";

      const safeId = e.id.replace(/[^a-z0-9]/gi, '_');
      const checkboxId = `chk_${safeId}_${e.index}`;
      const checked = e.done ? "checked" : "";
      const checkboxHtml = `<input type="checkbox" id="${checkboxId}" ${checked} />`;
      const statusHtml = `${checkboxHtml} <label for="${checkboxId}" class="status-label">${escapeHtml(e.statusLabel)}</label>`;

      // Small delete button (icon)
      const delBtn = `<button class="del-btn" data-id="${escapeHtml(e.id)}" data-idx="${e.index}" title="Supprimer" style="border:none;background:transparent;cursor:pointer;font-size:14px;line-height:1;padding:2px 6px;">🗑️</button>`;

      html += `<tr${e.done ? ' class="done-row"' : ''}>
        <td class="col-date">${dateCell}</td>
        <td class="col-desc">${descCell}</td>
        <td class="col-tags">${tagsHtml}</td>
        <td class="col-status">${statusHtml}</td>
        <td class="col-action">${delBtn}</td>
      </tr>`;
    }

    html += `</tbody></table>`;
    dv.paragraph(html);

    setTimeout(() => {
      for (const e of entries) {
        const safeId = e.id.replace(/[^a-z0-9]/gi, '_');
        const checkboxId = `chk_${safeId}_${e.index}`;
        const el = document.getElementById(checkboxId);
        if (el && !el.dataset.bound) {
          el.dataset.bound = "1";
          el.addEventListener('click', async () => {
            el.disabled = true;
            await toggleStatusById(filePath, e.id);
            el.disabled = false;
          });
        }

        // Delete button binding
        const delSelector = `.markdown-preview-view .ev-table button.del-btn[data-id="${e.id.replace(/"/g,'\\"')}"]`;
        const delEl = document.querySelector(delSelector);
        if (delEl && !delEl.dataset.bound) {
          delEl.dataset.bound = "1";
          delEl.addEventListener('click', async (evClick) => {
            evClick.preventDefault();
            if (!confirm('Supprimer cet événement ?')) return;
            delEl.disabled = true;
            await deleteEventById(filePath, e.id);
            delEl.disabled = false;
          });
        }
      }

      const tbody = document.querySelector('.markdown-preview-view .ev-table tbody');
      if (tbody) {
        Array.from(tbody.querySelectorAll('tr')).forEach(row => {
          const chk = row.querySelector('input[type="checkbox"]');
          const apply = () => chk && chk.checked ? row.classList.add('done-row') : row.classList.remove('done-row');
          if (chk) { apply(); chk.addEventListener('change', apply); }
        });
      }
    }, 150);
  }
}

/* Keep existing `toggleStatusById` function */
async function toggleStatusById(filePath, eventId) {
  try {
    const file = app.vault.getAbstractFileByPath(filePath);
    if (!file) { new Notice("Fichier introuvable: " + filePath); return; }
    const content = await app.vault.read(file);
    const lines = content.split(/\r?\n/);

    let idLine = -1;
    const idRegex = new RegExp(`^\\s*EventID::\\s*${regexEscape(eventId)}\\s*$`);
    for (let i = 0; i < lines.length; i++) if (idRegex.test(lines[i])) { idLine = i; break; }
    if (idLine === -1) { new Notice("`EventID` non trouvé dans la note."); return; }

    let eventLine = -1;
    for (let j = idLine - 1; j >= 0; j--) if (/^\s*Event::\s*/i.test(lines[j])) { eventLine = j; break; }
    if (eventLine === -1) { new Notice("`Event::` correspondant non trouvé au-dessus de `EventID`."); return; }

    let statutLine = -1;
    for (let k = eventLine + 1; k < lines.length; k++) {
      if (/^\s*Event::\s*/i.test(lines[k])) break;
      if (/^\s*Statut::\s*/i.test(lines[k])) { statutLine = k; break; }
    }

    const current = statutLine !== -1 ? lines[statutLine].replace(/^\s*Statut::\s*/i, "").trim() : null;
    const newStatut = isDoneLabel(current) ? "En cours" : "Terminé";

    if (statutLine !== -1) lines[statutLine] = `Statut:: ${newStatut}`;
    else lines.splice(idLine + 1, 0, `Statut:: ${newStatut}`);

    await app.vault.modify(file, lines.join("\n"));
    new Notice(`Statut mis à jour → ${newStatut}`);

    const leaf = app.workspace.activeLeaf;
    if (leaf) await leaf.openFile(file);
  } catch (err) {
    console.error(err);
    new Notice("Erreur lors de la mise à jour du statut.");
  }
}
```