const fs = require('fs');
const path = require('path');

const files = [
  'src/views/OperationRules/OperationRuleSheet.tsx',
  'src/views/Operations/OperationSheet.tsx',
  'src/views/ShiftRules/ShiftRuleSheet.tsx',
  'src/views/Shifts/ShiftSheet.tsx',
];

files.forEach(file => {
  const filePath = path.join(__dirname, file);
  if (!fs.existsSync(filePath)) return;
  
  let content = fs.readFileSync(filePath, 'utf8');

  // Add imports
  if (!content.includes('Controller')) {
    content = content.replace("import { useForm } from 'react-hook-form'", "import { useForm, Controller } from 'react-hook-form'");
  }
  if (!content.includes('SearchableSelect')) {
    content = content.replace("import { X, Loader2 } from 'lucide-react'", "import { X, Loader2 } from 'lucide-react'\nimport SearchableSelect from '@/components/SearchableSelect'\nimport { branchesService } from '@/services/branches.service'");
  }
  if (!content.includes('useQuery')) {
    content = content.replace("import { useMutation, useQueryClient }", "import { useMutation, useQuery, useQueryClient }");
  } else if (!content.includes('useQuery,')) {
    content = content.replace("useMutation, useQueryClient", "useMutation, useQuery, useQueryClient");
  }

  // Add query for branches inside the component
  const queryCode = `
  const { data: branchData, isLoading: isLoadingBranches } = useQuery({
    queryKey: ['branches-select'],
    queryFn: () => branchesService.list({ per_page: 100 }).then((r) => r.data),
  })
  const branchOptions = ((branchData as any)?.data ?? []).map((b: any) => ({
    value: b.id,
    label: b.name,
  }))
`;
  if (!content.includes('isLoadingBranches')) {
    content = content.replace("const qc = useQueryClient()", "const qc = useQueryClient()\n" + queryCode);
  }

  // Replace branch_id input
  const branchInputRegex = /<input\s+\{\.\.\.register\('branch_id'\)\}\s+style=\{\{[^}]+\}\}\s+\/>/;
  if (branchInputRegex.test(content)) {
    content = content.replace(branchInputRegex, `
              <Controller
                name="branch_id"
                control={control}
                render={({ field }) => (
                  <SearchableSelect
                    value={field.value ?? 0}
                    onChange={field.onChange}
                    options={branchOptions}
                    placeholder="Select branch..."
                    loading={isLoadingBranches}
                  />
                )}
              />
    `);
    
    // Also we need to extract `control` from useForm
    if (!content.includes('control,')) {
      content = content.replace("register,", "register,\n    control,");
    }
  }

  // Add type="date" to date fields
  content = content.replace(/\{\.\.\.register\('date'\)\}/, "{...register('date')} type=\"date\"");
  
  // Add type="time" to time fields
  content = content.replace(/\{\.\.\.register\('start_time'\)\}/, "{...register('start_time')} type=\"time\"");
  content = content.replace(/\{\.\.\.register\('end_time'\)\}/, "{...register('end_time')} type=\"time\"");
  
  // Add type="time" to cron-like time fields if they are meant to be time, or just let them be text. The user didn't specify.

  fs.writeFileSync(filePath, content);
  console.log('Updated ' + file);
});
