const fs = require('fs');
const report = JSON.parse(fs.readFileSync('scratch/report.json', 'utf8'));

let filesChanged = 0;

for (const item of report) {
  const filePath = item.file;
  if (!fs.existsSync(filePath)) continue;

  let content = fs.readFileSync(filePath, 'utf8');
  const originalInclude = item.fullIncludeString;
  
  // Create fixed include string
  let parts = originalInclude.split(',').map(s => s.trim());
  const invalidSet = new Set(item.invalidIncludes);
  parts = parts.filter(p => p && !invalidSet.has(p));
  const newInclude = parts.join(',');

  // Replace all occurrences of the original include string in the file
  if (content.includes(originalInclude)) {
    content = content.split(originalInclude).join(newInclude);
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`Patched ${filePath}`);
    filesChanged++;
  } else {
    console.warn(`Could not find exact string '${originalInclude}' in ${filePath}`);
  }
}

console.log(`Finished patching ${filesChanged} files.`);
