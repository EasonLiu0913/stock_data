'use strict';

const { updateIndex } = require('./generate_public_index');

try {
  const result = updateIndex();
  console.log(result.changed ? 'Regenerated public index from canonical page registry' : 'Public index already matches canonical page registry');
} catch (error) {
  console.error(error?.stack || error);
  process.exitCode = 1;
}
