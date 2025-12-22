import sgMail from '@sendgrid/mail';
import dotenv from 'dotenv';

dotenv.config();

// Initialize SendGrid
if (process.env.SENDGRID_API_KEY) {
  sgMail.setApiKey(process.env.SENDGRID_API_KEY);
} else {
  console.warn('⚠️  SENDGRID_API_KEY not set. Email functionality will be disabled.');
}

const FROM_EMAIL = process.env.SENDGRID_FROM_EMAIL || 'noreply@coffeearts.fr';
const FROM_NAME = process.env.SENDGRID_FROM_NAME || 'Coffee Arts Paris';

// Email templates
const templates = {
  orderConfirmation: (orderData) => ({
    subject: `Confirmation de commande #${orderData.orderId.substring(0, 8)}`,
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #8B7355; color: white; padding: 20px; text-align: center; }
          .content { padding: 20px; background: #f9f9f9; }
          .order-details { background: white; padding: 15px; margin: 15px 0; border-radius: 5px; }
          .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Coffee Arts Paris</h1>
            <p>Confirmation de commande</p>
          </div>
          <div class="content">
            <p>Bonjour ${orderData.customerName},</p>
            <p>Merci pour votre commande !</p>
            <div class="order-details">
              <h3>Détails de la commande</h3>
              <p><strong>Numéro de commande:</strong> ${orderData.orderId.substring(0, 8)}</p>
              <p><strong>Date:</strong> ${new Date(orderData.createdAt).toLocaleDateString('fr-FR')}</p>
              <p><strong>Total:</strong> ${orderData.total.toFixed(2)}€</p>
            </div>
            <p>Nous vous tiendrons informé de l'avancement de votre commande.</p>
            <p>Cordialement,<br>L'équipe Coffee Arts Paris</p>
          </div>
          <div class="footer">
            <p>Coffee Arts Paris - Votre espace créatif à Paris</p>
          </div>
        </div>
      </body>
      </html>
    `,
    text: `
      Coffee Arts Paris - Confirmation de commande
      
      Bonjour ${orderData.customerName},
      
      Merci pour votre commande !
      
      Numéro de commande: ${orderData.orderId.substring(0, 8)}
      Date: ${new Date(orderData.createdAt).toLocaleDateString('fr-FR')}
      Total: ${orderData.total.toFixed(2)}€
      
      Nous vous tiendrons informé de l'avancement de votre commande.
      
      Cordialement,
      L'équipe Coffee Arts Paris
    `
  }),

  workshopConfirmation: (workshopData) => ({
    subject: `Confirmation d'inscription - ${workshopData.workshopTitle}`,
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #8B7355; color: white; padding: 20px; text-align: center; }
          .content { padding: 20px; background: #f9f9f9; }
          .workshop-details { background: white; padding: 15px; margin: 15px 0; border-radius: 5px; }
          .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Coffee Arts Paris</h1>
            <p>Confirmation d'inscription</p>
          </div>
          <div class="content">
            <p>Bonjour ${workshopData.participantName},</p>
            <p>Votre inscription à l'atelier a été confirmée !</p>
            <div class="workshop-details">
              <h3>${workshopData.workshopTitle}</h3>
              <p><strong>Date:</strong> ${new Date(workshopData.sessionDate).toLocaleDateString('fr-FR')}</p>
              <p><strong>Heure:</strong> ${workshopData.sessionTime}</p>
              <p><strong>Durée :</strong> ${workshopData.duration} minutes</p>
              <p><strong>Niveau:</strong> ${workshopData.level}</p>
            </div>
            <p>Nous avons hâte de vous accueillir !</p>
            <p>Cordialement,<br>L'équipe Coffee Arts Paris</p>
          </div>
          <div class="footer">
            <p>Coffee Arts Paris - Votre espace créatif à Paris</p>
          </div>
        </div>
      </body>
      </html>
    `,
    text: `
      Coffee Arts Paris - Confirmation d'inscription
      
      Bonjour ${workshopData.participantName},
      
      Votre inscription à l'atelier a été confirmée !
      
      ${workshopData.workshopTitle}
      Date: ${new Date(workshopData.sessionDate).toLocaleDateString('fr-FR')}
      Heure: ${workshopData.sessionTime}
      Durée : ${workshopData.duration} minutes
      Niveau: ${workshopData.level}
      
      Nous avons hâte de vous accueillir !
      
      Cordialement,
      L'équipe Coffee Arts Paris
    `
  }),

  workshopCancellation: (workshopData) => ({
    subject: `Annulation - ${workshopData.workshopTitle}`,
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #8B7355; color: white; padding: 20px; text-align: center; }
          .content { padding: 20px; background: #f9f9f9; }
          .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Coffee Arts Paris</h1>
            <p>Annulation d'atelier</p>
          </div>
          <div class="content">
            <p>Bonjour ${workshopData.participantName},</p>
            <p>Nous vous informons que l'atelier "${workshopData.workshopTitle}" prévu le ${new Date(workshopData.sessionDate).toLocaleDateString('fr-FR')} a été annulé.</p>
            ${workshopData.reason ? `<p><strong>Raison:</strong> ${workshopData.reason}</p>` : ''}
            ${workshopData.refundAmount ? `<p>Un remboursement de ${workshopData.refundAmount.toFixed(2)}€ sera effectué sous peu.</p>` : ''}
            <p>Nous sommes désolés pour ce désagrément.</p>
            <p>Cordialement,<br>L'équipe Coffee Arts Paris</p>
          </div>
          <div class="footer">
            <p>Coffee Arts Paris - Votre espace créatif à Paris</p>
          </div>
        </div>
      </body>
      </html>
    `,
    text: `
      Coffee Arts Paris - Annulation d'atelier
      
      Bonjour ${workshopData.participantName},
      
      Nous vous informons que l'atelier "${workshopData.workshopTitle}" prévu le ${new Date(workshopData.sessionDate).toLocaleDateString('fr-FR')} a été annulé.
      
      ${workshopData.reason ? `Raison: ${workshopData.reason}` : ''}
      ${workshopData.refundAmount ? `Un remboursement de ${workshopData.refundAmount.toFixed(2)}€ sera effectué sous peu.` : ''}
      
      Nous sommes désolés pour ce désagrément.
      
      Cordialement,
      L'équipe Coffee Arts Paris
    `
  })
};

// Send email function
export async function sendEmail(to, templateName, data) {
  if (!process.env.SENDGRID_API_KEY) {
    console.warn('⚠️  Email not sent - SENDGRID_API_KEY not configured');
    return { success: false, message: 'Email service not configured' };
  }

  try {
    const template = templates[templateName];
    if (!template) {
      throw new Error(`Template ${templateName} not found`);
    }

    const emailContent = template(data);

    const msg = {
      to,
      from: {
        email: FROM_EMAIL,
        name: FROM_NAME
      },
      subject: emailContent.subject,
      text: emailContent.text,
      html: emailContent.html,
    };

    await sgMail.send(msg);
    console.log(`✅ Email sent to ${to}: ${templateName}`);
    return { success: true };
  } catch (error) {
    console.error('❌ Error sending email:', error);
    return { success: false, error: error.message };
  }
}

// Convenience functions
export async function sendOrderConfirmation(email, orderData) {
  return sendEmail(email, 'orderConfirmation', orderData);
}

export async function sendWorkshopConfirmation(email, workshopData) {
  return sendEmail(email, 'workshopConfirmation', workshopData);
}

export async function sendWorkshopCancellation(email, workshopData) {
  return sendEmail(email, 'workshopCancellation', workshopData);
}

