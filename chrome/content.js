function collectPageData() {
    let pageTotal = 0;

    // YYYY-MM-DD theo local time
    const todayStr = (() => {
        const d = new Date();
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${y}-${m}-${day}`;
    })();

    // Lấy tất cả hàng dữ liệu trong tbody (chỉ row thật)
    const rows = document.querySelectorAll(
        '#trd-order-history tbody.bn-web-table-tbody tr[role="row"]'
    );

    rows.forEach((row) => {
        // Thời gian tạo (col 1): "2025-12-24 17:50:35"
        const timeCell = row.querySelector('td[aria-colindex="1"]');
        const createdAt = timeCell ? timeCell.textContent.trim() : '';
        const createdDate = createdAt.slice(0, 10); // lấy phần YYYY-MM-DD

        // ✅ Chỉ tính row của ngày hiện tại và sau 7h sáng
        if (createdDate !== todayStr) return;
        const createdHour = parseInt(createdAt.slice(11, 13), 10);
        if (createdHour < 7) return;

        const typeCell = row.querySelector('td[aria-colindex="4"] div');     // Hướng (Mua/Bán)
        const statusCell = row.querySelector('td[aria-colindex="13"] div');  // Trạng thái (HTML mới)
        const amountCell = row.querySelector('td[aria-colindex="9"] div');   // Tổng (USDT)

        const typeText = typeCell ? typeCell.textContent.trim() : '';
        const statusText = statusCell ? statusCell.textContent.trim() : '';
        const amountText = amountCell ? amountCell.textContent.trim() : '';

        // Lọc điều kiện: Mua và (Đã khớp HOẶC Đã hủy nhưng khớp 1 phần có Tổng > 0)
        if (typeText === 'Mua' && (statusText === 'Đã khớp' || statusText === 'Đã hủy')) {
            // "1.024,94797 USDT" -> "1024.94797"
            const normalized = amountText
                .replace(/\s*USDT\s*/i, '')
                .replace(/\./g, '')
                .replace(/,/g, '.');

            const num = parseFloat(normalized);
            if (!isNaN(num) && num > 0) pageTotal += num * 4; // ✅ Nhân 4, chỉ tính khi Tổng > 0
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