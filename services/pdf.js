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
         
         // Payment information
         let paymentY = invoiceY + 45;
         if (orderData.payment_status) {
            const paymentStatusText = orderData.payment_status === 'paid' ? 'Payé' : 
                                     orderData.payment_status === 'pending' ? 'En attente' : 
                                     orderData.payment_status;
            doc.text(`Paiement: ${paymentStatusText}`, 400, paymentY, { align: 'right' });
            paymentY += 15;
         }
         if (orderData.payment_method) {
            doc.text(`Méthode: ${orderData.payment_method}`, 400, paymentY, { align: 'right' });
            paymentY += 15;
         }
         if (orderData.square_payment_id || orderData.stripe_payment_intent_id) {
            const paymentId = orderData.square_payment_id || orderData.stripe_payment_intent_id;
            doc.fontSize(8)
              .text(`ID Transaction: ${paymentId.substring(0, 20)}...`, 400, paymentY, { align: 'right' });
         }

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
            const price = parseFloat(item.price) || 0;
            const quantity = parseInt(item.quantity) || 0;
            const itemTotal = price * quantity;
            subtotal += itemTotal;

            doc.fontSize(9)
               .text(item.title || 'Produit', 50, itemsY, { width: 200 })
               .text(quantity.toString(), 250, itemsY)
               .text(`${price.toFixed(2)}€`, 300, itemsY)
               .text(`${itemTotal.toFixed(2)}€`, 450, itemsY, { align: 'right' });

            itemsY += 20;
         });

         itemsY += 10;
         doc.moveTo(50, itemsY).lineTo(550, itemsY).stroke();
         itemsY += 20;

         // Total (sans TVA)
         const total = subtotal;

         doc.fontSize(12).font('Helvetica-Bold');
         doc.text('Total:', 350, itemsY);
         doc.text(`${total.toFixed(2)}€`, 480, itemsY);

         // Payment section (if paid)
         if (orderData.payment_status === 'paid') {
            let paymentSectionY = itemsY + 60;
            doc.fontSize(10).font('Helvetica-Bold')
               .text('Informations de paiement', 50, paymentSectionY);
            paymentSectionY += 20;
            
            doc.fontSize(9).font('Helvetica');
            if (orderData.payment_method) {
               doc.text(`Méthode de paiement: ${orderData.payment_method}`, 50, paymentSectionY);
               paymentSectionY += 15;
            }
            if (orderData.square_payment_id || orderData.stripe_payment_intent_id) {
               const paymentId = orderData.square_payment_id || orderData.stripe_payment_intent_id;
               doc.text(`Transaction ID: ${paymentId}`, 50, paymentSectionY);
               paymentSectionY += 15;
            }
            doc.text(`Statut: Payé`, 50, paymentSectionY);
            paymentSectionY += 15;
            doc.text(`Date de paiement: ${new Date(createdAt).toLocaleDateString('fr-FR')}`, 50, paymentSectionY);
         }

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

