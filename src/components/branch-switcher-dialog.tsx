import { IBranch } from '@/@types/branch';
import { useState } from 'react';
import { Button } from './ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';
import { SearchableSelect } from './ui/searchable-select';

interface Props {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    branches: IBranch[]
    currentBranchId?: number;
    onSelect: (branchId: number) => void;
    isLoading: boolean;
}

const BranchSwitcherDialog = ({ branches, isLoading, onOpenChange, onSelect, open, currentBranchId }: Props) => {
    const branchOptions = branches.map(b => ({ value: b.id, label: b.name ?? '' }))
    const [selected, setSelected] = useState<number | null>(currentBranchId ?? null)
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Change Branch?</DialogTitle>
                </DialogHeader>
                <div>
                    <SearchableSelect
                        key={`change-branch`}
                        placeholder="search branch"
                        options={branchOptions ?? []}
                        defaultValue={branchOptions.find(b => b.value === currentBranchId)}
                        onChange={(selected) => {
                            const options = selected as { value: number } | null
                            setSelected(options?.value ?? null)
                        }}
                    />
                </div>
                <div className="flex justify-end gap-2">
                    <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isLoading}>
                        Cancel
                    </Button>
                    <Button
                        onClick={() => selected !== null && onSelect(selected)}
                        disabled={isLoading || selected === null}
                        className='cursor-pointer'
                    >
                        Confirm
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    )
}

export default BranchSwitcherDialog
