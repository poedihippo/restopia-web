const fs = require('fs');
const path = require('path');

const allowedIncludes = JSON.parse(fs.readFileSync('scratch/allowed_includes.json', 'utf8'));

// Helper to get all ts/tsx files
function getFiles(dir, filesList = []) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      getFiles(fullPath, filesList);
    } else if (fullPath.endsWith('.ts') || fullPath.endsWith('.tsx')) {
      filesList.push(fullPath);
    }
  }
  return filesList;
}

const frontendFiles = getFiles('src');
const issues = [];

const includeRegex = /include:\s*(['"`])(.*?)\1/g;

for (const file of frontendFiles) {
  const content = fs.readFileSync(file, 'utf8');
  let match;
  while ((match = includeRegex.exec(content)) !== null) {
    const includeStr = match[2];
    const includes = includeStr.split(',').map(s => s.trim()).filter(Boolean);
    issues.push({
      file,
      includeString: includeStr,
      includes
    });
  }
}

fs.writeFileSync('scratch/frontend_issues.json', JSON.stringify(issues, null, 2));
console.log('Saved frontend issues to scratch/frontend_issues.json');
