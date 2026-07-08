export const parseDate = (dateStr?: string) => {
    if (!dateStr) return ''
    // Jika format awalnya YYYY-MM-DD
    if (dateStr.includes('-') && dateStr.split('-')[0].length === 4) {
        return dateStr.split('T')[0]
    }
    // Jika formatnya DD-MM-YYYY (contoh: 15-06-2026 04:55 WIB)
    const match = dateStr.match(/^(\d{2})-(\d{2})-(\d{4})/)
    if (match) {
        const [, d, m, y] = match
        return `${y}-${m}-${d}`
    }
    return ''
}