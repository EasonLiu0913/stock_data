'use strict';

const { updateIndex: updateCanonicalIndex } = require('./generate_public_index');

function updateIndex() {
  return updateCanonicalIndex().changed;
}

if (require.main === module) {
  try {
    const changed = updateIndex();
    console.log(changed ? 'Regenerated public index from canonical page registry' : 'Public index already matches canonical page registry');
  } catch (error) {
    console.error(error?.stack || error);
    process.exitCode = 1;
  }
}

module.exports = { updateIndex };
