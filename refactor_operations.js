const fs = require('fs');
const path = require('path');

// --- Operations ---
const opIndex = path.join(__dirname, 'src/views/Operations/index.tsx');
let opIdx = fs.readFileSync(opIndex, 'utf8');

opIdx = opIdx.replace('const canCreate = true;', 'const canOpen = true;\n  const canRollover = true;\n  const [sheetMode, setSheetMode] = useState<"open" | "rollover">("open");');
opIdx = opIdx.replace('const canEdit = true;', '');
opIdx = opIdx.replace('const canDelete = true;', '');

const opButtons = `
        <div style={{ display: 'flex', gap: 10 }}>
          {canOpen && (
            <button onClick={() => { setSheetMode('open'); setSheetOpen(true); }} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', background: 'var(--accent)', color: 'white', border: 'none', borderRadius: 'var(--radius-md)', fontSize: 13, fontWeight: 500, cursor: 'pointer' }}>
              <Plus size={15} /> Open Operation
            </button>
          )}
          {canRollover && (
            <button onClick={() => { setSheetMode('rollover'); setSheetOpen(true); }} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', background: 'var(--surface)', color: 'var(--foreground)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', fontSize: 13, fontWeight: 500, cursor: 'pointer' }}>
              <Plus size={15} /> Rollover
            </button>
          )}
        </div>
`;
opIdx = opIdx.replace(/\{canCreate && \([\s\S]*?\)\}/, opButtons);
opIdx = opIdx.replace(/\{canEdit && <button onClick=\{\(\) => \{ setEditData\(item\); setSheetOpen\(true\); \}\} style=\{actionBtnStyle\} title="Edit"><Pencil size=\{14\} \/><\/button>\}/, '');
opIdx = opIdx.replace(/\{canDelete && <button onClick=\{\(\) => setDeleteConfirmId\(item\.id\)\} style=\{\{ \.\.\.actionBtnStyle, color: 'var\(--destructive\)' \}\} title="Delete"><Trash2 size=\{14\} \/><\/button>\}/, '');
opIdx = opIdx.replace(/<OperationSheet open=\{sheetOpen\} onClose=\{\(\) => \{ setSheetOpen\(false\); setEditData\(null\); \}\} editData=\{editData\} \/>/, '<OperationSheet open={sheetOpen} onClose={() => setSheetOpen(false)} mode={sheetMode} />');

fs.writeFileSync(opIndex, opIdx);

const opSheetFile = path.join(__dirname, 'src/views/Operations/OperationSheet.tsx');
let opSheet = fs.readFileSync(opSheetFile, 'utf8');

opSheet = opSheet.replace('editData?: any | null', 'mode: "open" | "rollover"');
opSheet = opSheet.replace('editData }: OperationSheetProps', 'mode }: OperationSheetProps');

const opMutations = `
  const openMutation = useMutation({
    mutationFn: (data: FormValues) => operationsService.open(data as any),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['operations'] })
      toast.success('Operation opened')
      onClose()
    },
    onError: () => toast.error('Failed to open Operation'),
  })

  const rolloverMutation = useMutation({
    mutationFn: (data: FormValues) => operationsService.rollover(data as any),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['operations'] })
      toast.success('Operation rolled over')
      onClose()
    },
    onError: () => toast.error('Failed to rollover Operation'),
  })

  const onSubmit = (data: FormValues) => {
    if (mode === 'open') openMutation.mutate(data)
    else rolloverMutation.mutate(data)
  }

  const isPending = openMutation.isPending || rolloverMutation.isPending
`;
opSheet = opSheet.replace(/const createMutation = useMutation\(\{[\s\S]*?const isPending = createMutation\.isPending \|\| updateMutation\.isPending/, opMutations);
opSheet = opSheet.replace(/{editData \? 'Edit Operation' : 'New Operation'}/, '{mode === "open" ? "Open Operation" : "Rollover Operation"}');
opSheet = opSheet.replace(/{editData \? 'Update' : 'Create'}/, '{mode === "open" ? "Open" : "Rollover"}');
fs.writeFileSync(opSheetFile, opSheet);


// --- Shifts ---
const shiftIndex = path.join(__dirname, 'src/views/Shifts/index.tsx');
let shIdx = fs.readFileSync(shiftIndex, 'utf8');

shIdx = shIdx.replace('const canCreate = true;', 'const canStart = true;\n  const canRollover = true;\n  const [sheetMode, setSheetMode] = useState<"start" | "rollover">("start");');
shIdx = shIdx.replace('const canEdit = true;', '');
shIdx = shIdx.replace('const canDelete = true;', '');

const shButtons = `
        <div style={{ display: 'flex', gap: 10 }}>
          {canStart && (
            <button onClick={() => { setSheetMode('start'); setSheetOpen(true); }} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', background: 'var(--accent)', color: 'white', border: 'none', borderRadius: 'var(--radius-md)', fontSize: 13, fontWeight: 500, cursor: 'pointer' }}>
              <Plus size={15} /> Start Shift
            </button>
          )}
          {canRollover && (
            <button onClick={() => { setSheetMode('rollover'); setSheetOpen(true); }} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', background: 'var(--surface)', color: 'var(--foreground)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', fontSize: 13, fontWeight: 500, cursor: 'pointer' }}>
              <Plus size={15} /> Rollover
            </button>
          )}
        </div>
`;
shIdx = shIdx.replace(/\{canCreate && \([\s\S]*?\)\}/, shButtons);
shIdx = shIdx.replace(/\{canEdit && <button onClick=\{\(\) => \{ setEditData\(item\); setSheetOpen\(true\); \}\} style=\{actionBtnStyle\} title="Edit"><Pencil size=\{14\} \/><\/button>\}/, '');
shIdx = shIdx.replace(/\{canDelete && <button onClick=\{\(\) => setDeleteConfirmId\(item\.id\)\} style=\{\{ \.\.\.actionBtnStyle, color: 'var\(--destructive\)' \}\} title="Delete"><Trash2 size=\{14\} \/><\/button>\}/, '');
shIdx = shIdx.replace(/<ShiftSheet open=\{sheetOpen\} onClose=\{\(\) => \{ setSheetOpen\(false\); setEditData\(null\); \}\} editData=\{editData\} \/>/, '<ShiftSheet open={sheetOpen} onClose={() => setSheetOpen(false)} mode={sheetMode} />');

fs.writeFileSync(shiftIndex, shIdx);

const shSheetFile = path.join(__dirname, 'src/views/Shifts/ShiftSheet.tsx');
let shSheet = fs.readFileSync(shSheetFile, 'utf8');

shSheet = shSheet.replace('editData?: any | null', 'mode: "start" | "rollover"');
shSheet = shSheet.replace('editData }: ShiftSheetProps', 'mode }: ShiftSheetProps');

const shMutations = `
  const startMutation = useMutation({
    mutationFn: (data: FormValues) => shiftsService.start(data as any),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['shifts'] })
      toast.success('Shift started')
      onClose()
    },
    onError: () => toast.error('Failed to start Shift'),
  })

  const rolloverMutation = useMutation({
    mutationFn: (data: FormValues) => shiftsService.rollover(data as any),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['shifts'] })
      toast.success('Shift rolled over')
      onClose()
    },
    onError: () => toast.error('Failed to rollover Shift'),
  })

  const onSubmit = (data: FormValues) => {
    if (mode === 'start') startMutation.mutate(data)
    else rolloverMutation.mutate(data)
  }

  const isPending = startMutation.isPending || rolloverMutation.isPending
`;
shSheet = shSheet.replace(/const createMutation = useMutation\(\{[\s\S]*?const isPending = createMutation\.isPending \|\| updateMutation\.isPending/, shMutations);
shSheet = shSheet.replace(/{editData \? 'Edit Shift' : 'New Shift'}/, '{mode === "start" ? "Start Shift" : "Rollover Shift"}');
shSheet = shSheet.replace(/{editData \? 'Update' : 'Create'}/, '{mode === "start" ? "Start" : "Rollover"}');

// Since we use shiftsService.start and shiftsService.rollover, we need to make sure those exist in the service.
fs.writeFileSync(shSheetFile, shSheet);

// Now update the services
const opService = path.join(__dirname, 'src/services/operations.service.ts');
let opServiceContent = fs.readFileSync(opService, 'utf8');
opServiceContent = opServiceContent.replace(/create:[\s\S]*?update:[\s\S]*?delete:[\s\S]*?\},/, '}');
fs.writeFileSync(opService, opServiceContent);

const shService = path.join(__dirname, 'src/services/shifts.service.ts');
let shServiceContent = fs.readFileSync(shService, 'utf8');
shServiceContent = shServiceContent.replace(/create:[\s\S]*?update:[\s\S]*?delete:[\s\S]*?\},/, '}');
// Add start and rollover and current
if (!shServiceContent.includes('start:')) {
  shServiceContent = shServiceContent.replace('}', `
  current: (params?: { include?: string }) =>
    api.get<ApiResponse<any>>('/shifts/current', { params }),

  start: (data: any) =>
    api.post<ApiResponse<any>>('/shifts/start', data),

  rollover: (data: any) =>
    api.post<ApiResponse<any>>('/shifts/rollover', data),
}
`);
}
fs.writeFileSync(shService, shServiceContent);

console.log('Update Complete');
