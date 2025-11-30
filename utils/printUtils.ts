export const printElement = (element: HTMLElement | null) => {
    if (!element) {
        console.error("Print Error: Provided element is null.");
        return;
    }

    const printWindow = window.open('', '', 'height=800,width=1000');

    if (!printWindow) {
        alert('يرجى السماح بالنوافذ المنبثقة لطباعة التقارير.');
        return;
    }

    printWindow.document.write(`
        <!DOCTYPE html>
        <html lang="ar" dir="rtl">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>طباعة تقرير</title>
            <script src="https://cdn.tailwindcss.com"></script>
            <style>
                @import url('https://fonts.googleapis.com/css2?family=Tajawal:wght@400;500;700;800&display=swap');
                body {
                    font-family: 'Tajawal', sans-serif;
                }
                @page {
                    size: A4;
                    margin: 20mm;
                }
                body {
                    -webkit-print-color-adjust: exact !important;
                    print-color-adjust: exact !important;
                }
            </style>
        </head>
        <body>
            ${element.innerHTML}
        </body>
        </html>
    `);

    printWindow.document.close();
    printWindow.focus(); // Necessary for some browsers
    
    // Use a timeout to ensure styles are loaded before printing
    setTimeout(() => {
        printWindow.print();
        printWindow.close();
    }, 500);
};
