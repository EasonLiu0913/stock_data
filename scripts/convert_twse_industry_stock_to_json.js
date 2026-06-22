const fs = require('fs');
const path = require('path');

const inputPath = path.join(__dirname, '../data_twse/twse_industry_Stock.csv');
const outputPath = path.join(__dirname, '../data_twse/twse_industry_Stock.json');

function parseCsvLine(line) {
    const values = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
        const char = line[i];
        const nextChar = line[i + 1];

        if (char === '"' && inQuotes && nextChar === '"') {
            current += '"';
            i++;
        } else if (char === '"') {
            inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
            values.push(current);
            current = '';
        } else {
            current += char;
        }
    }

    values.push(current);
    return values;
}

function convert() {
    if (!fs.existsSync(inputPath)) {
        throw new Error(`Input file not found: ${inputPath}`);
    }

    const csv = fs.readFileSync(inputPath, 'utf8').trim();
    const lines = csv.split(/\r?\n/).filter(Boolean);
    const headers = parseCsvLine(lines.shift() || '');
    const codeIndex = headers.indexOf('Code');
    const nameIndex = headers.indexOf('Name');
    const industryIndex = headers.indexOf('Industry');

    if (codeIndex === -1 || nameIndex === -1 || industryIndex === -1) {
        throw new Error('CSV must include Code, Name, and Industry headers');
    }

    const result = {};

    for (const line of lines) {
        const columns = parseCsvLine(line);
        const code = (columns[codeIndex] || '').trim();
        const name = (columns[nameIndex] || '').trim();
        const industry = (columns[industryIndex] || '').trim();

        if (!code) continue;

        result[code] = {
            Name: name,
            Industry: industry
        };
    }

    fs.writeFileSync(outputPath, `${JSON.stringify(result, null, 2)}\n`, 'utf8');
    console.log(`Converted ${Object.keys(result).length} records to ${outputPath}`);
}

convert();
