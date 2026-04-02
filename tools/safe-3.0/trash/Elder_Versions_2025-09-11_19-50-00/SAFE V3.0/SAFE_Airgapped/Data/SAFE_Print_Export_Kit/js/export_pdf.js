/* Requires html2pdf.bundle.min.js on the page */
window.exportPDF = function () {
  const source = document.querySelector('.container') || document.body;
  const opt = {
    margin:       [0.5, 0.5, 0.5, 0.5],          // inches: top,right,bottom,left
    filename:     'SAFE_V3_Report.pdf',
    image:        { type: 'jpeg', quality: 0.95 },
    html2canvas:  { scale: 2, useCORS: true, letterRendering: true },
    jsPDF:        { unit: 'in', format: 'letter', orientation: 'portrait' },
    pagebreak:    { mode: ['css', 'legacy'] }     // .html2pdf__page-break, old page-break rules
  };
  window.html2pdf().set(opt).from(source).save();
};