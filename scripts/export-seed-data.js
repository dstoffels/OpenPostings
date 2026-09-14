const fs = require('fs');
const path = require('path');
const sqlite3 = require('sqlite3');
const { open } = require('sqlite');
const { SEED_DIR, SEED_TABLES, escapeTsvValue } = require('../server/db/seed-data.js');

async function main() {
	const dbPath = process.env.DB_PATH || path.resolve(__dirname, '..', 'jobs.db');
	const db = await open({ filename: dbPath, driver: sqlite3.Database });
	fs.mkdirSync(SEED_DIR, { recursive: true });

	for (const table of SEED_TABLES) {
		const columnList = table.columns.map((c) => `"${c}"`).join(', ');
		const rows = await db.all(`SELECT ${columnList} FROM "${table.name}" ORDER BY id ASC;`);

		const lines = [table.columns.join('\t')];
		for (const row of rows) {
			lines.push(table.columns.map((c) => escapeTsvValue(row[c])).join('\t'));
		}

		const outPath = path.join(SEED_DIR, `${table.name}.tsv`);
		fs.writeFileSync(outPath, `${lines.join('\n')}\n`, 'utf8');
		console.log(`Wrote ${rows.length} rows to ${outPath}`);
	}

	await db.close();
}

main().catch((error) => {
	console.error(error);
	process.exit(1);
});
