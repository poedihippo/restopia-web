const fs = require('fs');
const path = require('path');

// 1. Update useDataTable.ts
const useDataTablePath = path.join(__dirname, 'src/hooks/useDataTable.ts');
let useDataTableContent = fs.readFileSync(useDataTablePath, 'utf8');

useDataTableContent = useDataTableContent.replace('defaultPerPage = 10,', 'defaultPerPage = 1000,');
useDataTableContent = useDataTableContent.replace(
`  const buildPagination = useCallback(
    (meta?: Meta) => ({
      current: meta?.current_page ?? 1,
      pageSize: meta?.per_page ?? perPage,
      total: meta?.total ?? 0,
    }),
    [perPage],
  );`,
`  const buildPagination = useCallback(
    (meta?: Meta) => ({
      current: meta?.current_page ?? 1,
      pageSize: meta?.per_page ?? perPage,
      total: meta?.total ?? 0,
      onChange: handlePageChange,
      onPageSizeChange: handlePerPageChange,
    }),
    [perPage, handlePageChange, handlePerPageChange],
  );`
);

fs.writeFileSync(useDataTablePath, useDataTableContent);

// 2. Update data-table.tsx
const dataTablePath = path.join(__dirname, 'src/components/ui/data-table.tsx');
let dataTableContent = fs.readFileSync(dataTablePath, 'utf8');

// Add useState and Input imports
if (!dataTableContent.includes('useState')) {
  dataTableContent = dataTableContent.replace(`import React from 'react'`, `import React, { useState } from 'react'`);
}
if (!dataTableContent.includes(`import { Input }`)) {
  dataTableContent = dataTableContent.replace(`import { Card, CardContent } from './card'`, `import { Card, CardContent } from './card'\nimport { Input } from './input'`);
}

// Add onPageSizeChange to pagination interface
dataTableContent = dataTableContent.replace(
`  pagination?: {
    current: number
    pageSize: number
    total: number
    onChange: (page: number) => void
  }`,
`  pagination?: {
    current: number
    pageSize: number
    total: number
    onChange: (page: number) => void
    onPageSizeChange?: (pageSize: number) => void
  }`
);

// Replace pagination UI
const oldPaginationUI = `{pagination && !loading && data.length > 0 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="text-sm text-muted-foreground text-center sm:text-left">
            Showing {((pagination.current - 1) * pagination.pageSize) + 1} to{' '}
            {Math.min(pagination.current * pagination.pageSize, pagination.total)} of{' '}
            {pagination.total} entries
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => pagination.onChange(pagination.current - 1)}
              disabled={!canPrevious}
            >
              Previous
            </Button>
            <div className="hidden sm:flex items-center gap-1">
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                <Button
                  key={page}
                  variant={page === pagination.current ? 'default' : 'outline'}
                  size="icon-sm"
                  onClick={() => pagination.onChange(page)}
                >
                  {page}
                </Button>
              ))}
            </div>
            <span className="sm:hidden text-sm text-muted-foreground">
              {pagination.current} / {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => pagination.onChange(pagination.current + 1)}
              disabled={!canNext}
            >
              Next
            </Button>
          </div>
        </div>
      )}`;

const newPaginationUI = `{pagination && !loading && data.length > 0 && (
        <div className="flex flex-col gap-4">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="text-sm text-muted-foreground text-center sm:text-left">
              Showing {((pagination.current - 1) * pagination.pageSize) + 1} to{' '}
              {Math.min(pagination.current * pagination.pageSize, pagination.total)} of{' '}
              {pagination.total} entries
            </div>
            
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => pagination.onChange(pagination.current - 1)}
                disabled={!canPrevious}
              >
                Previous
              </Button>
              <div className="hidden sm:flex items-center gap-1">
                {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                  <Button
                    key={page}
                    variant={page === pagination.current ? 'default' : 'outline'}
                    size="icon-sm"
                    onClick={() => pagination.onChange(page)}
                  >
                    {page}
                  </Button>
                ))}
              </div>
              <span className="sm:hidden text-sm text-muted-foreground">
                {pagination.current} / {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => pagination.onChange(pagination.current + 1)}
                disabled={!canNext}
              >
                Next
              </Button>
            </div>
          </div>
          
          {pagination.onPageSizeChange && (
            <div className="flex flex-col sm:flex-row items-center gap-3">
              <span className="text-sm font-medium">Per Page:</span>
              <div className="flex gap-2">
                {[50, 100, 300, 1000].map(size => (
                  <Button
                    key={size}
                    variant={pagination.pageSize === size ? "default" : "outline"}
                    size="sm"
                    onClick={() => pagination.onPageSizeChange!(size)}
                  >
                    {size}
                  </Button>
                ))}
              </div>
              <div className="flex items-center gap-2 ml-0 sm:ml-2">
                <span className="text-sm text-muted-foreground">Custom:</span>
                <Input 
                  type="number"
                  className="w-24 h-9"
                  placeholder="Count"
                  defaultValue={pagination.pageSize}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      const val = parseInt((e.target as HTMLInputElement).value, 10);
                      if (!isNaN(val) && val > 0) {
                        pagination.onPageSizeChange!(val);
                      }
                    }
                  }}
                  onBlur={(e) => {
                    const val = parseInt(e.target.value, 10);
                    if (!isNaN(val) && val > 0) {
                      pagination.onPageSizeChange!(val);
                    }
                  }}
                />
              </div>
            </div>
          )}
        </div>
      )}`;

dataTableContent = dataTableContent.replace(oldPaginationUI, newPaginationUI);
fs.writeFileSync(dataTablePath, dataTableContent);

// 3. Update all views
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

for (const file of viewFiles) {
  let content = fs.readFileSync(file, 'utf8');
  if (content.includes('pagination={{') && content.includes('onChange: handlePageChange')) {
    // We need to replace the pagination object block with `pagination={pagination}`
    // A simple regex approach could work since the structure is fairly predictable
    const regex = /pagination=\{\{[\s\S]*?onChange: handlePageChange,?\s*\}\}/g;
    content = content.replace(regex, 'pagination={pagination}');
    fs.writeFileSync(file, content);
    console.log('Updated', file);
  }
}
