const fs = require('fs');
const path = require('path');

// Update OperationSheet.tsx
const opSheetPath = path.join(__dirname, 'src/views/Operations/OperationSheet.tsx');
let opSheet = fs.readFileSync(opSheetPath, 'utf8');

if (!opSheet.includes('operationRulesService')) {
  opSheet = opSheet.replace(
    "import { branchesService } from '@/services/branches.service'",
    "import { branchesService } from '@/services/branches.service'\nimport { operationRulesService } from '@/services/operation-rules.service'"
  );
}

if (!opSheet.includes('operationRuleOptions')) {
  const queryCode = `
  const { data: opRuleData, isLoading: isLoadingOpRules } = useQuery({
    queryKey: ['operation-rules-select'],
    queryFn: () => operationRulesService.list({ per_page: 100 }).then((r) => r.data),
  })
  const operationRuleOptions = ((opRuleData as any)?.data ?? []).map((r: any) => ({
    value: r.id,
    label: \`Rule #\${r.id}\`, // Adjust label if 'name' exists on operation rules
  }))
`;
  opSheet = opSheet.replace(
    "const branchOptions = ((branchData as any)?.data ?? []).map((b: any) => ({\n    value: b.id,\n    label: b.name,\n  }))",
    "const branchOptions = ((branchData as any)?.data ?? []).map((b: any) => ({\n    value: b.id,\n    label: b.name,\n  }))\n" + queryCode
  );
}

const opRuleInputRegex = /<input\s+\{\.\.\.register\('operation_rule_id'\)\}[^>]+>/;
if (opRuleInputRegex.test(opSheet)) {
  opSheet = opSheet.replace(opRuleInputRegex, `
              <Controller
                name="operation_rule_id"
                control={control}
                render={({ field }) => (
                  <SearchableSelect
                    value={field.value ?? 0}
                    onChange={field.onChange}
                    options={operationRuleOptions}
                    placeholder="Select operation rule..."
                    loading={isLoadingOpRules}
                  />
                )}
              />
  `);
}
fs.writeFileSync(opSheetPath, opSheet);

// Update ShiftSheet.tsx
const shiftSheetPath = path.join(__dirname, 'src/views/Shifts/ShiftSheet.tsx');
let shiftSheet = fs.readFileSync(shiftSheetPath, 'utf8');

if (!shiftSheet.includes('shiftRulesService')) {
  shiftSheet = shiftSheet.replace(
    "import { branchesService } from '@/services/branches.service'",
    "import { branchesService } from '@/services/branches.service'\nimport { operationsService } from '@/services/operations.service'\nimport { shiftRulesService } from '@/services/shift-rules.service'"
  );
}

if (!shiftSheet.includes('operationOptions')) {
  const queryCode = `
  const { data: opData, isLoading: isLoadingOps } = useQuery({
    queryKey: ['operations-select'],
    queryFn: () => operationsService.list({ per_page: 100 }).then((r) => r.data),
  })
  const operationOptions = ((opData as any)?.data ?? []).map((o: any) => ({
    value: o.id,
    label: \`Operation #\${o.id}\` + (o.date ? \` (\${o.date})\` : ''),
  }))

  const { data: srData, isLoading: isLoadingSr } = useQuery({
    queryKey: ['shift-rules-select'],
    queryFn: () => shiftRulesService.list({ per_page: 100 }).then((r) => r.data),
  })
  const shiftRuleOptions = ((srData as any)?.data ?? []).map((s: any) => ({
    value: s.id,
    label: s.name || \`Rule #\${s.id}\`,
  }))
`;
  shiftSheet = shiftSheet.replace(
    "const branchOptions = ((branchData as any)?.data ?? []).map((b: any) => ({\n    value: b.id,\n    label: b.name,\n  }))",
    "const branchOptions = ((branchData as any)?.data ?? []).map((b: any) => ({\n    value: b.id,\n    label: b.name,\n  }))\n" + queryCode
  );
}

const opInputRegex = /<input\s+\{\.\.\.register\('operation_id'\)\}[^>]+>/;
if (opInputRegex.test(shiftSheet)) {
  shiftSheet = shiftSheet.replace(opInputRegex, `
              <Controller
                name="operation_id"
                control={control}
                render={({ field }) => (
                  <SearchableSelect
                    value={field.value ?? 0}
                    onChange={field.onChange}
                    options={operationOptions}
                    placeholder="Select operation..."
                    loading={isLoadingOps}
                  />
                )}
              />
  `);
}

const srInputRegex = /<input\s+\{\.\.\.register\('shift_rule_id'\)\}[^>]+>/;
if (srInputRegex.test(shiftSheet)) {
  shiftSheet = shiftSheet.replace(srInputRegex, `
              <Controller
                name="shift_rule_id"
                control={control}
                render={({ field }) => (
                  <SearchableSelect
                    value={field.value ?? 0}
                    onChange={field.onChange}
                    options={shiftRuleOptions}
                    placeholder="Select shift rule..."
                    loading={isLoadingSr}
                  />
                )}
              />
  `);
}

fs.writeFileSync(shiftSheetPath, shiftSheet);
console.log('Done');
