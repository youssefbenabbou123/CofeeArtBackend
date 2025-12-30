import nodemailer from 'nodemailer';
import dotenv from 'dotenv';

dotenv.config();

// SMTP Configuration
// Supports Gmail, Outlook, custom SMTP servers, etc.
// For Gmail: Enable "Less secure apps" or use App Password
// For Outlook: Use your normal credentials

const SMTP_CONFIG = {
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: parseInt(process.env.SMTP_PORT) || 587,
  secure: process.env.SMTP_SECURE === 'true', // true for 465, false for other ports
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
};

const FROM_EMAIL = process.env.SMTP_FROM_EMAIL || process.env.SMTP_USER || 'noreply@coffeearts.fr';
const FROM_NAME = process.env.SMTP_FROM_NAME || 'Coffee Arts Paris';

// Create transporter
let transporter = null;

function getTransporter() {
  if (!transporter) {
    if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
      console.warn('⚠️  SMTP credentials not set. Email functionality will be disabled.');
      console.warn('   Set SMTP_USER and SMTP_PASS in your environment variables.');
      return null;
    }

    transporter = nodemailer.createTransport(SMTP_CONFIG);
    console.log(`📧 Email transporter configured with ${SMTP_CONFIG.host}:${SMTP_CONFIG.port}`);
  }
  return transporter;
}

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
  }),

  orderRefund: (refundData) => ({
    subject: `Remboursement de votre commande #${refundData.orderId.substring(0, 8)}`,
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
          .refund-details { background: white; padding: 15px; margin: 15px 0; border-radius: 5px; }
          .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Coffee Arts Paris</h1>
            <p>Confirmation de remboursement</p>
          </div>
          <div class="content">
            <p>Bonjour ${refundData.customerName},</p>
            <p>Nous vous confirmons le remboursement de votre commande.</p>
            <div class="refund-details">
              <h3>Détails du remboursement</h3>
              <p><strong>Numéro de commande:</strong> ${refundData.orderId.substring(0, 8)}</p>
              <p><strong>Montant remboursé:</strong> ${refundData.amount.toFixed(2)}€</p>
              ${refundData.reason ? `<p><strong>Raison:</strong> ${refundData.reason}</p>` : ''}
            </div>
            <p>Le remboursement sera visible sur votre compte dans 5 à 10 jours ouvrés.</p>
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
      Coffee Arts Paris - Confirmation de remboursement
      
      Bonjour ${refundData.customerName},
      
      Nous vous confirmons le remboursement de votre commande.
      
      Numéro de commande: ${refundData.orderId.substring(0, 8)}
      Montant remboursé: ${refundData.amount.toFixed(2)}€
      ${refundData.reason ? `Raison: ${refundData.reason}` : ''}
      
      Le remboursement sera visible sur votre compte dans 5 à 10 jours ouvrés.
      
      Cordialement,
      L'équipe Coffee Arts Paris
    `
  }),

  contactForm: (contactData) => ({
    subject: `Nouveau message de contact - ${contactData.subject || 'Sans sujet'}`,
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
          .message-details { background: white; padding: 15px; margin: 15px 0; border-radius: 5px; }
          .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Coffee Arts Paris</h1>
            <p>Nouveau message de contact</p>
          </div>
          <div class="content">
            <div class="message-details">
              <p><strong>De:</strong> ${contactData.name}</p>
              <p><strong>Email:</strong> ${contactData.email}</p>
              ${contactData.phone ? `<p><strong>Téléphone:</strong> ${contactData.phone}</p>` : ''}
              <p><strong>Sujet:</strong> ${contactData.subject || 'Sans sujet'}</p>
              <hr>
              <p><strong>Message:</strong></p>
              <p>${contactData.message}</p>
            </div>
          </div>
          <div class="footer">
            <p>Ce message a été envoyé depuis le formulaire de contact du site.</p>
          </div>
        </div>
      </body>
      </html>
    `,
    text: `
      Nouveau message de contact
      
      De: ${contactData.name}
      Email: ${contactData.email}
      ${contactData.phone ? `Téléphone: ${contactData.phone}` : ''}
      Sujet: ${contactData.subject || 'Sans sujet'}
      
      Message:
      ${contactData.message}
    `
  }),

  contactAutoReply: (contactData) => ({
    subject: `Nous avons bien reçu votre message - Coffee Arts Paris`,
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
          </div>
          <div class="content">
            <p>Bonjour ${contactData.name},</p>
            <p>Nous avons bien reçu votre message et nous vous répondrons dans les plus brefs délais.</p>
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
      Bonjour ${contactData.name},
      
      Nous avons bien reçu votre message et nous vous répondrons dans les plus brefs délais.
      
      Cordialement,
      L'équipe Coffee Arts Paris
    `
  })
};

// Send email function
export async function sendEmail(to, templateName, data) {
  const transport = getTransporter();
  
  if (!transport) {
    console.warn('⚠️  Email not sent - SMTP not configured');
    return { success: false, message: 'Email service not configured' };
  }

  try {
    const template = templates[templateName];
    if (!template) {
      throw new Error(`Template ${templateName} not found`);
    }

    const emailContent = template(data);

    const mailOptions = {
      from: `"${FROM_NAME}" <${FROM_EMAIL}>`,
      to,
      subject: emailContent.subject,
      text: emailContent.text,
      html: emailContent.html,
    };

    const info = await transport.sendMail(mailOptions);
    console.log(`✅ Email sent to ${to}: ${templateName} (ID: ${info.messageId})`);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('❌ Error sending email:', error);
    return { success: false, error: error.message };
  }
}

// Send raw email (for custom emails)
export async function sendRawEmail(to, subject, html, text) {
  const transport = getTransporter();
  
  if (!transport) {
    console.warn('⚠️  Email not sent - SMTP not configured');
    return { success: false, message: 'Email service not configured' };
  }

  try {
    const mailOptions = {
      from: `"${FROM_NAME}" <${FROM_EMAIL}>`,
      to,
      subject,
      text: text || '',
      html,
    };

    const info = await transport.sendMail(mailOptions);
    console.log(`✅ Email sent to ${to}: ${subject} (ID: ${info.messageId})`);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('❌ Error sending email:', error);
    return { success: false, error: error.message };
  }
}

// Verify SMTP connection
export async function verifyEmailConnection() {
  const transport = getTransporter();
  
  if (!transport) {
    return { success: false, message: 'SMTP not configured' };
  }

  try {
    await transport.verify();
    console.log('✅ SMTP connection verified');
    return { success: true };
  } catch (error) {
    console.error('❌ SMTP connection failed:', error);
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

export async function sendOrderRefund(email, refundData) {
  return sendEmail(email, 'orderRefund', refundData);
}

export async function sendContactForm(adminEmail, contactData) {
  return sendEmail(adminEmail, 'contactForm', contactData);
}

export async function sendContactAutoReply(email, contactData) {
  return sendEmail(email, 'contactAutoReply', contactData);
}
