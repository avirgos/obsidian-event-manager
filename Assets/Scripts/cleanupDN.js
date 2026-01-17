modules.export = async function cleanupDN(tp) {
    const directory = "Journal/Daily Notes";
    const today = window.moment().startOf("day");

    const months = {
        "janvier": 0, "février": 1, "mars": 2, "avril": 3, "mai": 4, "juin": 5,
        "juillet": 6, "août": 7, "septembre": 8, "octobre": 9, "novembre": 10, "décembre": 11
    };

    const files = app.vault.getFiles().filter(f =>
        f.path.startsWith(directory)
    );

    const active = app.workspace.getActiveFile()?.path;

    for (const f of files) {
        if (f.path === active) continue;

        const match = f.basename.match(/^(\d{1,2}) ([a-zéû]+) (\d{4})$/i);
        if (!match) continue;

        const [_, day, monthTxt, year] = match;
        const monthIndex = months[monthTxt.toLowerCase()];
        if (monthIndex === undefined) continue;

        const fileDate = window.moment({ year, month: monthIndex, day });

        if (fileDate.isBefore(today)) {
            await app.vault.trash(f, true);
        }
    }
};
