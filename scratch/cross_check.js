const fs = require('fs');

const allowedIncludesRaw = JSON.parse(fs.readFileSync('scratch/allowed_includes.json', 'utf8'));
const frontendIssues = JSON.parse(fs.readFileSync('scratch/frontend_issues.json', 'utf8'));

// Create a Set of all valid includes across ALL endpoints for a loose check
// or we can map files to endpoints. For now, let's do a strict check by 
// trying to guess the endpoint from the file name / path.
const allValidIncludes = new Set();
for (const includes of Object.values(allowedIncludesRaw)) {
  for (const inc of includes) {
    allValidIncludes.add(inc);
  }
}

const report = [];

for (const item of frontendIssues) {
  const file = item.file;
  const usedIncludes = item.includes;
  
  const invalidIncludes = [];
  for (const inc of usedIncludes) {
    // If it's completely missing from OpenAPI across all endpoints, it's definitely hallucinated.
    if (!allValidIncludes.has(inc)) {
      invalidIncludes.push(inc);
    }
  }
  
  if (invalidIncludes.length > 0) {
    report.push({
      file,
      invalidIncludes,
      fullIncludeString: item.includeString
    });
  }
}

fs.writeFileSync('scratch/report.json', JSON.stringify(report, null, 2));
console.log('Report saved to scratch/report.json');
