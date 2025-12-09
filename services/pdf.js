import PDFDocument from 'pdfkit';
import dotenv from 'dotenv';

dotenv.config();

/**
 * Generate invoice PDF
 * @param {Object} orderData - Order information
 * @returns {Promise<Buffer>} PDF buffer
 */
export async function generateInvoicePDF(orderData) {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ margin: 50 });
      const chunks = [];

      doc.on('data', chunk => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      // Header
      doc.fontSize(20).text('Coffee Arts Paris', { align: 'center' });
      doc.fontSize(12).text('Facture', { align: 'center' });
      doc.moveDown();

      // Company info
      doc.fontSize(10)
         .text('Coffee Arts Paris', 50, 100)
         .text('25 Boulevard du Temple', 50, 115)
         .text('75003 PARIS', 50, 130)
         .text('SIRET: 123 456 789 00012', 50, 145);

      // Invoice details
      const invoiceY = 100;
      const orderId = orderData.orderId || orderData.id || '';
      const createdAt = orderData.createdAt || orderData.created_at || new Date();
      doc.fontSize(10)
         .text(`Facture N°: ${orderId ? orderId.substring(0, 8) : 'N/A'}`, 400, invoiceY, { align: 'right' })
         .text(`Date: ${new Date(createdAt).toLocaleDateString('fr-FR')}`, 400, invoiceY + 15, { align: 'right' })
         .text(`Statut: ${orderData.status || 'N/A'}`, 400, invoiceY + 30, { align: 'right' });

      // Customer info
      const customerY = 200;
      doc.fontSize(12).text('Facturé à:', 50, customerY);
      doc.fontSize(10)
         .text(orderData.customerName || orderData.guest_name || 'Client', 50, customerY + 20);
      
      if (orderData.customerEmail || orderData.guest_email) {
        doc.text(orderData.customerEmail || orderData.guest_email, 50, customerY + 35);
      }
      
      if (orderData.shipping_address) {
        doc.text(orderData.shipping_address, 50, customerY + 50);
        if (orderData.shipping_city && orderData.shipping_postal_code) {
          doc.text(`${orderData.shipping_postal_code} ${orderData.shipping_city}`, 50, customerY + 65);
        }
      }

      // Items table
      let itemsY = customerY + 100;
      doc.fontSize(12).text('Articles', 50, itemsY);
      itemsY += 20;

      // Table header
      doc.fontSize(10)
         .text('Produit', 50, itemsY)
         .text('Qté', 250, itemsY)
         .text('Prix unitaire', 300, itemsY)
         .text('Total', 450, itemsY, { align: 'right' });
      
      itemsY += 15;
      doc.moveTo(50, itemsY).lineTo(550, itemsY).stroke();
      itemsY += 10;

      // Items
      let subtotal = 0;
      orderData.items.forEach(item => {
        const itemTotal = item.price * item.quantity;
        subtotal += itemTotal;

        doc.fontSize(9)
           .text(item.title || 'Produit', 50, itemsY, { width: 200 })
           .text(item.quantity.toString(), 250, itemsY)
           .text(`${item.price.toFixed(2)}€`, 300, itemsY)
           .text(`${itemTotal.toFixed(2)}€`, 450, itemsY, { align: 'right' });
        
        itemsY += 20;
      });

      itemsY += 10;
      doc.moveTo(50, itemsY).lineTo(550, itemsY).stroke();
      itemsY += 20;

      // Totals
      const tvaRate = orderData.tva_rate || 20;
      const tvaAmount = subtotal * (tvaRate / 100);
      const total = subtotal + tvaAmount;

      doc.fontSize(10)
         .text('Sous-total HT:', 400, itemsY, { align: 'right' })
         .text(`${subtotal.toFixed(2)}€`, 500, itemsY, { align: 'right' });
      itemsY += 15;

      doc.text(`TVA (${tvaRate}%):`, 400, itemsY, { align: 'right' })
         .text(`${tvaAmount.toFixed(2)}€`, 500, itemsY, { align: 'right' });
      itemsY += 15;

      doc.fontSize(12).font('Helvetica-Bold')
         .text('Total TTC:', 400, itemsY, { align: 'right' })
         .text(`${total.toFixed(2)}€`, 500, itemsY, { align: 'right' });

      // Footer
      const footerY = 700;
      doc.fontSize(8).font('Helvetica')
         .text('Merci pour votre commande !', 50, footerY, { align: 'center' })
         .text('Coffee Arts Paris - Votre espace créatif à Paris', 50, footerY + 15, { align: 'center' });

      doc.end();
    } catch (error) {
      reject(error);
    }
  });
}

