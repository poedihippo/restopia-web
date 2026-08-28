const fs = require('fs');
const path = require('path');

function walkSync(dir, filelist) {
  const files = fs.readdirSync(dir);
  filelist = filelist || [];
  files.forEach(function(file) {
    const filepath = path.join(dir, file);
    if (fs.statSync(filepath).isDirectory()) {
      filelist = walkSync(filepath, filelist);
    }
    else {
      filelist.push(filepath);
    }
  });
  return filelist;
}

const viewFiles = walkSync(path.join(__dirname, 'src/views'), []).filter(f => f.endsWith('.tsx'));

let modifiedCount = 0;

for (const file of viewFiles) {
  let content = fs.readFileSync(file, 'utf8');

  // Check if it's a file with custom pagination
  if (content.includes('const [page, setPage] = useState') && content.includes('setPage((p) => Math.max(1, p - 1))')) {
    
    // 1. Add import
    if (!content.includes('CustomPagination')) {
      const importRegex = /import\s+.*?\s+from\s+['"][^'"]+['"];?/g;
      let lastImportMatch;
      let match;
      while ((match = importRegex.exec(content)) !== null) {
        lastImportMatch = match;
      }
      if (lastImportMatch) {
        const importIdx = lastImportMatch.index + lastImportMatch[0].length;
        content = content.slice(0, importIdx) + '\nimport { CustomPagination } from \'@/components/ui/CustomPagination\'' + content.slice(importIdx);
      } else {
        content = 'import { CustomPagination } from \'@/components/ui/CustomPagination\'\n' + content;
      }
    }

    // 2. Add perPage state
    if (!content.includes('const [perPage, setPerPage] = useState')) {
      content = content.replace(/const\s+\[page,\s*setPage\]\s*=\s*useState\(1\)/g, 'const [page, setPage] = useState(1)\n  const [perPage, setPerPage] = useState(1000)');
    }

    // 3. Replace per_page: X with per_page: perPage
    content = content.replace(/per_page:\s*\d+/g, 'per_page: perPage');

    // 4. Update queryKey to include perPage (if it exists)
    // usually: queryKey: ['some-key', page, search], -> queryKey: ['some-key', page, perPage, search],
    // Let's just find queryKey array and if it has `page` but not `perPage`, inject it.
    const queryKeyRegex = /queryKey:\s*\[([^\]]+)\]/g;
    content = content.replace(queryKeyRegex, (match, p1) => {
      if (p1.includes('page') && !p1.includes('perPage')) {
        return `queryKey: [${p1.replace('page', 'page, perPage')}]`;
      }
      return match;
    });

    // 5. Replace the pagination HTML
    // We look for the block starting with `{meta && ...}` containing `Math.max(1, p - 1)`
    // Since regex over multiple lines for HTML can be tricky, we find the index of the start and end.
    
    // There are a few variations:
    // {meta && (meta.last_page ?? meta.total_pages) > 1 && ( ... )}
    // {meta && meta.last_page > 1 && ( ... )}
    // Let's use a simpler approach: replace the entire `{meta && ... }` block if we can find it.
    
    // Find the start: `{meta &&`
    let metaStartIndex = content.indexOf('{meta &&');
    // If not found, look for `<div ... > ... Math.max(1, p - 1) ... </div>`
    if (metaStartIndex !== -1) {
      // Find where this block ends. We can count curly braces.
      let bracesCount = 0;
      let endIndex = -1;
      for (let i = metaStartIndex; i < content.length; i++) {
        if (content[i] === '{') bracesCount++;
        else if (content[i] === '}') {
          bracesCount--;
          if (bracesCount === 0) {
            endIndex = i;
            break;
          }
        }
      }
      
      if (endIndex !== -1) {
        const block = content.slice(metaStartIndex, endIndex + 1);
        if (block.includes('Math.max(1, p - 1)')) {
          content = content.slice(0, metaStartIndex) + '<CustomPagination page={page} setPage={setPage} perPage={perPage} setPerPage={setPerPage} meta={meta} />' + content.slice(endIndex + 1);
        }
      }
    } else {
      // Sometimes it might not be wrapped in {meta && ...}.
      // Try finding the div that contains it.
      const matchHtml = content.match(/<div[^>]*>[\s\S]*?setPage\(\(p\)\s*=>\s*Math\.max\(1,\s*p\s*-\s*1\)\)[\s\S]*?<\/div>/);
      if (matchHtml) {
        // Just replacing the first found div might be risky if it's deeply nested, but usually it's a top-level div for pagination.
        // Let's leave this for manual if {meta && is not found.
      }
    }

    fs.writeFileSync(file, content);
    modifiedCount++;
    console.log('Modified', file);
  }
}

console.log(`Refactored ${modifiedCount} files.`);
