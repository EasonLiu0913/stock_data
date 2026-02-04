const fs = require('fs');
const path = require('path');

const dataDir = path.join(__dirname, '../data_fubon');
const outputFile = path.join(dataDir, 'files.json');

try {
 if (!fs.existsSync(dataDir)) {
  console.error(`❌ Data directory not found: ${dataDir}`);
  process.exit(1);
 }

 const files = fs.readdirSync(dataDir)
  .filter(file => (file.endsWith('.json') || file.endsWith('.csv')) && file !== 'files.json')
  .sort();

 fs.writeFileSync(outputFile, JSON.stringify(files, null, 2), 'utf8');
 console.log(`✅ Generated ${outputFile} with ${files.length} files.`);
} catch (error) {
 console.error(`❌ Error generating files.json: ${error.message}`);
 process.exit(1);
}
