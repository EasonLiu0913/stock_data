const fs = require('fs');
const path = require('path');

const directories = [
    { path: 'data_fubon', output: 'data_fubon/files.json' },
    { path: 'data_twse', output: 'data_twse/files.json' }
];

directories.forEach(dir => {
    const dirPath = path.join(__dirname, '..', dir.path);
    const outputPath = path.join(__dirname, '..', dir.output);

    if (fs.existsSync(dirPath)) {
        const files = fs.readdirSync(dirPath).filter(file => file.endsWith('.csv') || file.endsWith('.json'));
        fs.writeFileSync(outputPath, JSON.stringify(files, null, 2));
        console.log(`✅ Generated ${dir.output} with ${files.length} files`);
    } else {
        console.log(`⚠️ Directory ${dir.path} does not exist`);
        // Write empty array if dir doesn't exist
        fs.writeFileSync(outputPath, JSON.stringify([], null, 2));
    }
});
