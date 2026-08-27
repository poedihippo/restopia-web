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
  // It should manage `page` and have `per_page: \d+` or something similar, and NOT already have CustomPagination (or if it has, we might need to fix it if it's half done)
  // Let's just target files that have `setPage` and `ChevronRight` inside `{meta &&` or similar.

  if (content.includes('const [page, setPage]') && !content.includes('setPerPage(size)')) {
    
    // We only process if it has a hardcoded per_page (e.g. per_page: 10, per_page: 15) and NOT per_page: perPage
    if (/per_page:\s*\d+/.test(content)) {
      
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
        // Try different spacing and typings
        content = content.replace(/const\s+\[page,\s*setPage\]\s*=\s*useState(?:<number>)?\(\s*1\s*\)/g, 'const [page, setPage] = useState<number>(1)\n  const [perPage, setPerPage] = useState<number>(1000)');
      }

      // 3. Replace per_page: X with per_page: perPage
      content = content.replace(/per_page:\s*\d+/g, 'per_page: perPage');

      // 4. Update queryKey to include perPage (if it exists)
      const queryKeyRegex = /queryKey:\s*\[([^\]]+)\]/g;
      content = content.replace(queryKeyRegex, (match, p1) => {
        if (p1.includes('page') && !p1.includes('perPage')) {
          return `queryKey: [${p1.replace('page', 'page, perPage')}]`;
        }
        return match;
      });

      // 5. Replace the pagination HTML
      // Find the start: `{meta &&`
      let metaStartIndex = content.indexOf('{meta &&');
      if (metaStartIndex !== -1) {
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
          // If it contains page turning logic (ChevronLeft / Next / setPage)
          if (block.includes('setPage') || block.includes('ChevronLeft')) {
            content = content.slice(0, metaStartIndex) + '<CustomPagination page={page} setPage={setPage} perPage={perPage} setPerPage={setPerPage} meta={meta} />' + content.slice(endIndex + 1);
          }
        }
      }

      fs.writeFileSync(file, content);
      modifiedCount++;
      console.log('Modified', file);
    }
  }
}

console.log(`Refactored ${modifiedCount} files.`);
