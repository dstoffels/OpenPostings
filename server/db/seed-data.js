const fs = require('fs');
const path = require('path');

const SEED_DIR = path.resolve(__dirname, '..', '..', 'seed');

// Reference/lookup tables only — never personal or runtime data (Postings,
// applications, PersonalInformation, McpSettings, etc. are created empty by
// server/index.js's own schema bootstrap and populated by normal app usage).
const SEED_TABLES = [
	{
		name: 'companies',
		columns: ['id', 'company_name', 'url_string', 'ATS_name'],
		ddl: `
      CREATE TABLE IF NOT EXISTS companies (
        id INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
        company_name TEXT NOT NULL,
        url_string TEXT NOT NULL,
        ATS_name TEXT NOT NULL
      );
    `,
	},
	{
		name: 'job_industry_categories',
		columns: ['id', 'industry_key', 'industry_label', 'priority', 'created_at'],
		ddl: `
      CREATE TABLE IF NOT EXISTS job_industry_categories (
        id INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
        industry_key TEXT NOT NULL UNIQUE,
        industry_label TEXT NOT NULL,
        priority INTEGER NOT NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
    `,
	},
	{
		name: 'job_position_industry',
		columns: [
			'id',
			'job_title',
			'normalized_job_title',
			'industry_key',
			'industry_label',
			'matched_rules',
			'confidence_score',
			'rule_version',
			'created_at',
			'updated_at',
		],
		ddl: `
      CREATE TABLE IF NOT EXISTS job_position_industry (
        id INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
        job_title TEXT NOT NULL,
        normalized_job_title TEXT NOT NULL UNIQUE,
        industry_key TEXT NOT NULL,
        industry_label TEXT NOT NULL,
        matched_rules TEXT NOT NULL,
        confidence_score REAL NOT NULL,
        rule_version TEXT NOT NULL DEFAULT 'rule_bootstrap_v4',
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now')),
        FOREIGN KEY (industry_key) REFERENCES job_industry_categories(industry_key)
      );
    `,
	},
	{
		name: 'state_location_index',
		columns: [
			'id',
			'location_type',
			'state_usps',
			'state_geoid',
			'location_geoid',
			'ansicode',
			'location_name',
			'search_location_name',
			'normalized_location_name',
			'normalized_search_location_name',
			'lsad_code',
			'funcstat',
			'aland',
			'awater',
			'aland_sqmi',
			'awater_sqmi',
			'intptlat',
			'intptlong',
			'source_file',
			'created_at',
		],
		ddl: `
      CREATE TABLE IF NOT EXISTS state_location_index (
        id INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
        location_type TEXT NOT NULL CHECK (location_type IN ('city', 'county')),
        state_usps TEXT NOT NULL,
        state_geoid TEXT,
        location_geoid TEXT NOT NULL,
        ansicode TEXT,
        location_name TEXT NOT NULL,
        search_location_name TEXT NOT NULL,
        normalized_location_name TEXT NOT NULL,
        normalized_search_location_name TEXT NOT NULL,
        lsad_code TEXT,
        funcstat TEXT,
        aland INTEGER,
        awater INTEGER,
        aland_sqmi REAL,
        awater_sqmi REAL,
        intptlat REAL,
        intptlong REAL,
        source_file TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        UNIQUE(location_type, location_geoid)
      );
    `,
	},
];

function escapeTsvValue(value) {
	if (value === null || value === undefined) return '\\N';
	return String(value)
		.replace(/\\/g, '\\\\')
		.replace(/\t/g, '\\t')
		.replace(/\n/g, '\\n')
		.replace(/\r/g, '\\r');
}

function unescapeTsvValue(raw) {
	if (raw === '\\N') return null;
	return raw.replace(/\\r/g, '\r').replace(/\\n/g, '\n').replace(/\\t/g, '\t').replace(/\\\\/g, '\\');
}

async function importSeedDataIfEmpty(db) {
	for (const table of SEED_TABLES) {
		await db.exec(table.ddl);

		const countRow = await db.get(`SELECT COUNT(*) AS c FROM "${table.name}";`);
		if (Number(countRow?.c || 0) > 0) continue;

		const filePath = path.join(SEED_DIR, `${table.name}.tsv`);
		if (!fs.existsSync(filePath)) continue;

		const lines = fs
			.readFileSync(filePath, 'utf8')
			.split('\n')
			.filter((line) => line.length > 0);
		if (lines.length <= 1) continue;

		const header = lines[0].split('\t');
		const insertSql = `INSERT INTO "${table.name}" (${header.map((c) => `"${c}"`).join(', ')}) VALUES (${header
			.map(() => '?')
			.join(', ')});`;

		await db.exec('BEGIN TRANSACTION;');
		try {
			const stmt = await db.prepare(insertSql);
			for (let i = 1; i < lines.length; i += 1) {
				const values = lines[i].split('\t').map(unescapeTsvValue);
				await stmt.run(values);
			}
			await stmt.finalize();
			await db.exec('COMMIT;');
		} catch (error) {
			await db.exec('ROLLBACK;');
			throw error;
		}
		console.log(`[seed] imported ${lines.length - 1} rows into ${table.name}`);
	}
}

module.exports = { SEED_DIR, SEED_TABLES, escapeTsvValue, unescapeTsvValue, importSeedDataIfEmpty };
