function collectPageData() {
    let pageTotal = 0;

    const rows = document.querySelectorAll('tbody.bn-web-table-tbody tr[role="row"]');
    rows.forEach(row => {
        const typeCell = row.querySelector('td[aria-colindex="4"] div');   // Cột Loại (Mua/Bán)
        const statusCell = row.querySelector('td[aria-colindex="11"] div'); // Cột Trạng thái
        const amountCell = row.querySelector('td[aria-colindex="9"] div');  // Cột Số tiền USDT

        const typeText = typeCell ? typeCell.textContent.trim() : '';
        const statusText = statusCell ? statusCell.textContent.trim() : '';
        const amountText = amountCell ? amountCell.textContent.trim() : '';

        if (typeText === 'Mua' && statusText === 'Đã khớp') {
            // Ví dụ "1.024,89671 USDT" → "1024.89671"
            const normalized = amountText
                .replace(/\s*USDT\s*/i, '')  // bỏ chữ USDT
                .replace(/\./g, '')          // bỏ dấu . ngăn cách phần nghìn
                .replace(/,/g, '.');         // đổi dấu phẩy thành chấm

            const num = parseFloat(normalized);
            if (!isNaN(num)) {
                pageTotal += num * 4; // ✅ Nhân 4
            } else {
                console.warn('Không parse được số:', amountText);
            }
        }
    });

    return pageTotal;
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg.type === 'COLLECT_PAGE') {
        const total = collectPageData();
        sendResponse({ pageTotal: total });
    }
});
t