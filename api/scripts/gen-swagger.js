const fs = require('fs');
const path = require('path');
const swaggerSpec = require('../src/config/swagger');

const outPath = path.join(__dirname, '..', 'swagger.json');
fs.writeFileSync(outPath, JSON.stringify(swaggerSpec, null, 2));
const schemaCount = swaggerSpec?.components?.schemas
  ? Object.keys(swaggerSpec.components.schemas).length
  : 0;
console.log(`swagger.json generated successfully (schemas: ${schemaCount})`);
