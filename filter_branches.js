const fs = require('fs');
const path = require('path');

const opRuleSheet = path.join(__dirname, 'src/views/OperationRules/OperationRuleSheet.tsx');
let content = fs.readFileSync(opRuleSheet, 'utf8');

// The file has a query for branchData and then maps it to branchOptions.
// We also need to query operationRules to get the list of branches that already have rules.
const replacement = `
  const { data: opRulesData, isLoading: isLoadingRules } = useQuery({
    queryKey: ['operationrules'], // Use the same key used for listing
    queryFn: () => operationRulesService.list({ per_page: 100 }).then((r) => r.data),
  })
  const existingBranchIds = new Set(((opRulesData as any)?.data ?? []).map((r: any) => r.branch_id))

  const branchOptions = ((branchData as any)?.data ?? [])
    .filter((b: any) => !existingBranchIds.has(b.id) || (editData && editData.branch_id === b.id))
    .map((b: any) => ({
      value: b.id,
      label: b.name,
    }))
`;

content = content.replace(
  /const branchOptions = \(\(branchData as any\)\?\.data \?\? \[\]\)\.map\(\(b: any\) => \(\{\s*value: b\.id,\s*label: b\.name,\s*\}\)\)/,
  replacement
);

fs.writeFileSync(opRuleSheet, content);
console.log('Updated OperationRuleSheet');
