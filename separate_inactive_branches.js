const fs = require('fs');
const path = require('path');

const INACTIVE_DATE = '20251207';
const DATA_DIR = path.join(__dirname, 'data_fubon_brokers_trade');
const BRANCHES_FILE = path.join(__dirname, 'broker_branches.json');
const NAMES_FILE = path.join(__dirname, 'broker_names.json');
const INACTIVE_FILE = path.join(__dirname, 'inactive_broker_branches.json');

// Load data
const branchesMap = JSON.parse(fs.readFileSync(BRANCHES_FILE, 'utf8'));
const namesMap = JSON.parse(fs.readFileSync(NAMES_FILE, 'utf8'));

const inactiveBranchesMap = {};
let removedCount = 0;

console.log('Scanning for inactive branches (Date: ' + INACTIVE_DATE + ')...');

const brokerIds = Object.keys(branchesMap);

for (const brokerId of brokerIds) {
    const branches = branchesMap[brokerId];
    const brokerName = namesMap[brokerId] || brokerId;

    const activeBranches = [];
    const inactiveBranches = [];

    for (const branchId of branches) {
        const branchName = namesMap[branchId] || branchId;

        // Construct expected filename for inactive date
        // Filename format: BrokerName_BranchName_Date.csv
        const filename = `${brokerName}_${branchName}_${INACTIVE_DATE}.csv`;
        const filePath = path.join(DATA_DIR, filename);

        if (fs.existsSync(filePath)) {
            // File exists with inactive date -> Inactive
            inactiveBranches.push(branchId);
            removedCount++;
            // console.log(`  Found inactive: ${filename}`);
        } else {
            // File doesn't exist (or has different date) -> Active
            activeBranches.push(branchId);
        }
    }

    // Update maps
    branchesMap[brokerId] = activeBranches;
    if (inactiveBranches.length > 0) {
        inactiveBranchesMap[brokerId] = inactiveBranches;
    }
}

// Save files
fs.writeFileSync(BRANCHES_FILE, JSON.stringify(branchesMap, null, 2), 'utf8');
fs.writeFileSync(INACTIVE_FILE, JSON.stringify(inactiveBranchesMap, null, 2), 'utf8');

console.log(`✅ Separation complete.`);
console.log(`   Removed ${removedCount} inactive branches.`);
console.log(`   Updated: ${BRANCHES_FILE}`);
console.log(`   Created: ${INACTIVE_FILE}`);
