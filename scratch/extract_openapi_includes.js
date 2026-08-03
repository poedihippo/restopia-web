const fs = require('fs');
const yaml = require('js-yaml');

try {
  const file = fs.readFileSync('newopenapi.yaml', 'utf8');
  const doc = yaml.load(file);
  
  const endpointIncludes = {};
  
  for (const [path, pathItem] of Object.entries(doc.paths || {})) {
    for (const [method, operation] of Object.entries(pathItem)) {
      if (operation.parameters) {
        const includeParam = operation.parameters.find(p => p.name === 'include' && p.in === 'query');
        if (includeParam && includeParam.description) {
          const match = includeParam.description.match(/relations?: (.*)/i);
          if (match) {
             const key = `${method.toUpperCase()} ${path}`;
             const includes = match[1].split(',').map(s => s.trim().replace(/['"]/g, '')).filter(Boolean);
             endpointIncludes[key] = includes;
          }
        }
      }
    }
  }
  
  fs.writeFileSync('scratch/allowed_includes.json', JSON.stringify(endpointIncludes, null, 2));
  console.log('Successfully extracted allowed includes.');
} catch (e) {
  console.error(e);
}
